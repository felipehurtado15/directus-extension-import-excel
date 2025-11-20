import multer from "multer";
import * as XLSX from "xlsx";
import { backendMessages } from "../shared/i18nApi.js";

function formatMessage(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] || "");
}

function getErrorTypeDescription(code, type) {
  // Map error codes to human-readable descriptions
  const errorDescriptions = {
    'FORBIDDEN': 'No tiene permisos para esta operación',
    'RECORD_NOT_UNIQUE': 'El valor ya existe (debe ser único)',
    'VALUE_TOO_LONG': 'El valor es demasiado largo',
    'INVALID_PAYLOAD': 'Datos inválidos o mal formateados',
    'FAILED_VALIDATION': 'Error de validación',
    'FIELD_INVALID': 'Campo inválido o no permitido',
    'CONTAINS_NULL_VALUES': 'El campo no puede estar vacío (requerido)',
    'VALUE_OUT_OF_RANGE': 'El valor está fuera del rango permitido',
  };

  return errorDescriptions[code] || type || 'Error de validación';
}

function handleItemError(row, error, logger, errors, item = {}) {
  let detail = '';
  let code = 'UNKNOWN';
  let errorType = 'validation';

  // Check if it's a permission error
  if (error?.code === 'FORBIDDEN' || error?.message?.includes('FORBIDDEN')) {
    detail = 'No tiene permisos para crear o actualizar elementos en esta colección. Contacte al administrador del sistema.';
    code = 'FORBIDDEN';
    errorType = 'permission';
  }
  // Handle array of errors
  else if (Array.isArray(error)) {
    detail = error.map((e) => {
      const field = e.extensions?.field || e.path || "desconocido";
      const fieldType = e.extensions?.type || "validation";
      const fieldCode = e.code || "UNKNOWN_ERROR";
      const value = item?.[field];
      const description = getErrorTypeDescription(fieldCode, fieldType);

      let errorMsg = `Campo "${field}": ${description}`;
      if (value !== undefined && value !== null) {
        errorMsg += ` | Valor proporcionado: "${value}"`;
      }
      return errorMsg;
    }).join("; ");
    code = error[0]?.code || "UNKNOWN";
    errorType = error[0]?.extensions?.type || "validation";
  }
  // Handle error with errors property
  else if (error?.errors && Array.isArray(error.errors)) {
    detail = error.errors.map((e) => {
      const field = e.extensions?.field || e.path || "desconocido";
      const fieldType = e.extensions?.type || "validation";
      const fieldCode = e.code || "UNKNOWN_ERROR";
      const value = item?.[field];
      const description = getErrorTypeDescription(fieldCode, fieldType);

      let errorMsg = `Campo "${field}": ${description}`;
      if (value !== undefined && value !== null) {
        errorMsg += ` | Valor: "${value}"`;
      }
      return errorMsg;
    }).join("; ");
    code = error.errors[0]?.code || "UNKNOWN";
    errorType = error.errors[0]?.extensions?.type || "validation";
  }
  // Handle single error object
  else {
    detail = error?.message || error?.toString() || "Error de validación";
    code = error?.code || "UNKNOWN";

    // Add field information if available
    if (error?.extensions?.field) {
      const field = error.extensions.field;
      const value = item?.[field];
      const description = getErrorTypeDescription(code, error.extensions.type);
      detail = `Campo "${field}": ${description}`;
      if (value !== undefined && value !== null) {
        detail += ` | Valor: "${value}"`;
      }
    }
  }

  logger.error(`Error línea ${row} [${code}]: ${detail}`);
  logger.error({ row, error: detail, code, type: errorType });

  errors.push({ row, error: detail, code, type: errorType });
}

// 📅 Función para transformar fechas
function transformDate(value, format) {
  if (!value || !format) return value;

  try {
    // Manejar formato serial de Excel
    if (format === 'excel') {
      const numValue = Number(value);
      if (isNaN(numValue)) return value;

      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + numValue * 86400000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Manejar formatos de texto
    const dateStr = String(value).trim();
    let day, month, year;

    if (format === 'dd/mm/yyyy') {
      const parts = dateStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        day = parts[0].padStart(2, '0');
        month = parts[1].padStart(2, '0');
        year = parts[2];
      }
    } else if (format === 'mm/dd/yyyy') {
      const parts = dateStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        month = parts[0].padStart(2, '0');
        day = parts[1].padStart(2, '0');
        year = parts[2];
      }
    } else if (format === 'yyyy-mm-dd') {
      return dateStr; // Ya está en formato correcto
    }

    if (day && month && year) {
      return `${year}-${month}-${day}`;
    }
  } catch (err) {
    console.error('Error transformando fecha:', err);
  }

  return value;
}

// 🔄 Función para aplicar transformaciones de datos
function applyTransformations(value, transformations) {
  if (!value || !transformations || transformations.length === 0) return value;

  let result = String(value);

  transformations.forEach(transform => {
    switch (transform) {
      case 'trim':
        result = result.trim();
        break;
      case 'uppercase':
        result = result.toUpperCase();
        break;
      case 'lowercase':
        result = result.toLowerCase();
        break;
      case 'capitalize':
        result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
        break;
      default:
        break;
    }
  });

  return result;
}

// 📦 Función para dividir array en chunks (batches)
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// 🔒 Función para agregar campos de auditoría automáticamente
// Estos campos se completan con información del usuario en sesión
function addAuditFields(item, userId, isUpdate = false) {
  const now = new Date().toISOString();
  const itemWithAudit = { ...item };

  // Remover cualquier valor que el usuario haya intentado mapear
  const auditFields = ['user_created', 'date_created', 'user_updated', 'date_updated', 'sort'];
  auditFields.forEach(field => {
    if (field in itemWithAudit) {
      delete itemWithAudit[field];
    }
  });

  if (isUpdate) {
    // Al actualizar, solo agregar campos de última modificación
    itemWithAudit.user_updated = userId;
    itemWithAudit.date_updated = now;
  } else {
    // Al crear, agregar todos los campos de auditoría
    itemWithAudit.user_created = userId;
    itemWithAudit.date_created = now;
    itemWithAudit.user_updated = userId;
    itemWithAudit.date_updated = now;
  }

  return itemWithAudit;
}

export default function registerEndpoint(router, { services, getSchema, logger }) {
  const { ItemsService } = services;

  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  router.post("/", upload.single("file"), async (req, res) => {
    try {
      const lang = (req.headers["accept-language"] || "en-US").split(",")[0];
      const messages = backendMessages[lang] || backendMessages["en-US"];

      if (!req.file)
        return res.status(400).json({ message: messages.missingFile });

      if (!req.body.collection)
        return res.status(400).json({ message: messages.missingCollection });

      if (!req.body.mapping)
        return res.status(400).json({ message: messages.missingMapping });

      const schema = await getSchema();
      const collectionName = req.body.collection;
      const mapping = JSON.parse(req.body.mapping);
      const fieldTypes = req.body.fieldTypes ? JSON.parse(req.body.fieldTypes) : {};
      const dateFormats = req.body.dateFormats ? JSON.parse(req.body.dateFormats) : {};
      const transformations = req.body.transformations ? JSON.parse(req.body.transformations) : {};
      const keyFields = req.body.keyFields ? JSON.parse(req.body.keyFields) : [];
      const firstRowIsHeader = req.body.firstRowIsHeader === 'true';
      const batchSize = req.body.batchSize ? parseInt(req.body.batchSize, 10) : 100;

      logger.info(`Importando a colección: ${collectionName}`);
      logger.info(`Primera fila es header: ${firstRowIsHeader}`);
      logger.info(`Campos clave: ${keyFields.length > 0 ? keyFields.join(', ') : 'ninguno'}`);
      logger.info(`Tamaño de lote: ${batchSize}`);

      const itemsService = new ItemsService(collectionName, {
        schema,
        accountability: req.accountability,
      });

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length === 0)
        return res.status(400).json({ message: messages.emptyFile });

      // Determinar desde qué fila empezar (omitir header si está marcado)
      const startRow = firstRowIsHeader ? 1 : 0;
      const dataRows = rows.slice(startRow);

      if (dataRows.length === 0)
        return res.status(400).json({ message: messages.noValidItems });

      logger.info(`Procesando ${dataRows.length} filas de datos (sin contar header)`);

      const items = dataRows
        .map((row, index) => {
          // El índice real en el Excel (sumando 1 por ser base-1, y startRow si hay header)
          const excelRowNumber = startRow + index + 1;
          
          const item = {};
          for (const [colIndex, fieldName] of Object.entries(mapping)) {
            if (fieldName) {
              let value = row[colIndex];

              // Verificar si el campo es de tipo fecha y tiene formato definido
              const fieldType = fieldTypes[colIndex];
              const dateFormat = dateFormats[colIndex];
              const columnTransformations = transformations[colIndex] || [];

              if (fieldType === 'date' && dateFormat && value !== undefined && value !== null) {
                // Transformar la fecha
                value = transformDate(value, dateFormat);
                logger.info(`Fecha transformada en fila ${excelRowNumber}, columna ${colIndex}: ${row[colIndex]} → ${value}`);
              }

              // Convertir a string
              let stringValue = value !== undefined && value !== null ? String(value) : "";

              // Aplicar transformaciones de datos
              if (columnTransformations.length > 0 && stringValue !== "") {
                const originalValue = stringValue;
                stringValue = applyTransformations(stringValue, columnTransformations);
                logger.info(`Transformación aplicada en fila ${excelRowNumber}, columna ${colIndex}: "${originalValue}" → "${stringValue}" [${columnTransformations.join(', ')}]`);
              } else {
                // Solo trim por defecto si no hay transformaciones específicas
                stringValue = stringValue.trim();
              }

              if (stringValue !== "") {
                item[fieldName] = stringValue;
              }
            }
          }
          
          item.__rowIndex = excelRowNumber;
          return item;
        })
        .filter((item) => Object.keys(item).length > 1); // Al menos un campo además de __rowIndex

      if (items.length === 0)
        return res.status(400).json({ message: messages.noValidItems });

      logger.info(`${items.length} items válidos para procesar`);

      // 📦 Batch processing configuration
      const batches = chunkArray(items, batchSize);

      logger.info(`🔄 Procesando en ${batches.length} lotes de hasta ${batchSize} items`);

      const results = [];
      const errors = [];
      let createdCount = 0;
      let updatedCount = 0;

      // Obtener el ID del usuario en sesión
      const userId = req.accountability?.user || null;

      if (!userId) {
        logger.warn('⚠️ No se pudo obtener el ID del usuario. Los campos de auditoría no se completarán.');
      }

      if (keyFields.length > 0) {
        // Modo UPSERT: crear o actualizar según campos clave (soporta múltiples campos)
        // Validar que todos los items tengan todos los campos clave
        for (const keyField of keyFields) {
          const missingKey = items.find((item) => !(keyField in item));
          if (missingKey) {
            return res.status(400).json({
              message: formatMessage(messages.missingKeyForUpsert, { keyField }),
            });
          }
        }

        // Función auxiliar para crear clave compuesta
        const createCompositeKey = (item) => {
          return keyFields.map(field => String(item[field] || '')).join('|');
        };

        // Procesar cada batch
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];

          logger.info(`📦 Lote ${batchIndex + 1}/${batches.length}: Procesando ${batch.length} items`);

          // Construir filtro para múltiples campos clave
          // Si tenemos múltiples campos, usamos _or con combinaciones _and
          const batchFilters = batch.map(item => {
            const andConditions = {};
            keyFields.forEach(field => {
              andConditions[field] = { _eq: item[field] };
            });
            return andConditions;
          });

          // Buscar items existentes para este batch
          const existingItems = await itemsService.readByQuery({
            filter: { _or: batchFilters },
            limit: batch.length * 2, // Margen de seguridad
          });

          // Crear mapa usando clave compuesta
          const existingMap = new Map(
            existingItems.map((item) => [createCompositeKey(item), item])
          );

          logger.info(`📦 Lote ${batchIndex + 1}: Encontrados ${existingMap.size} items existentes`);

          // Procesar items del batch
          for (const item of batch) {
            const row = item.__rowIndex;
            const compositeKey = createCompositeKey(item);
            const keyDisplay = keyFields.map(f => `${f}=${item[f]}`).join(', ');
            delete item.__rowIndex; // Remover antes de insertar/actualizar

            try {
              if (existingMap.has(compositeKey)) {
                // 🔒 Agregar campos de auditoría para actualización
                const itemWithAudit = userId ? addAuditFields(item, userId, true) : item;

                const existing = existingMap.get(compositeKey);
                await itemsService.updateOne(existing.id, itemWithAudit);
                results.push({ id: existing.id, action: "updated", row, key: keyDisplay });
                updatedCount++;
                logger.info(`✅ Fila ${row}: Actualizado (${keyDisplay})`);
              } else {
                // 🔒 Agregar campos de auditoría para creación
                const itemWithAudit = userId ? addAuditFields(item, userId, false) : item;

                const newId = await itemsService.createOne(itemWithAudit);
                results.push({ id: newId, action: "created", row, key: keyDisplay });
                createdCount++;
                logger.info(`✅ Fila ${row}: Creado (${keyDisplay})`);
              }
            } catch (error) {
              handleItemError(row, error, logger, errors, item);
            }
          }

          logger.info(`✅ Lote ${batchIndex + 1}/${batches.length} completado: ${batch.length} items procesados`);
        }
      } else {
        // Modo INSERT: solo crear nuevos registros (con batch processing)
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];

          logger.info(`📦 Lote ${batchIndex + 1}/${batches.length}: Procesando ${batch.length} items`);

          for (const item of batch) {
            const row = item.__rowIndex;
            delete item.__rowIndex; // Remover antes de insertar

            // 🔒 Agregar campos de auditoría para creación
            const itemWithAudit = userId ? addAuditFields(item, userId, false) : item;

            try {
              const newId = await itemsService.createOne(itemWithAudit);
              results.push({ id: newId, action: "created", row });
              createdCount++;
              logger.info(`✅ Fila ${row}: Creado`);
            } catch (error) {
              handleItemError(row, error, logger, errors, item);
            }
          }

          logger.info(`✅ Lote ${batchIndex + 1}/${batches.length} completado: ${batch.length} items procesados`);
        }
      }

      logger.info(
        `Import terminé : ${createdCount} créés, ${updatedCount} mis à jour, ${errors.length} erreurs.`
      );
      logger.info({ created: createdCount, updated: updatedCount, failed: errors });

      const parts = [];
      if (createdCount > 0) parts.push(`${createdCount} ${messages.created}`);
      if (updatedCount > 0) parts.push(`${updatedCount} ${messages.updated}`);
      if (errors.length > 0)  parts.push(`${errors.length} ${messages.failed}`);

      const summary = parts.length > 0 ? parts.join(', ') : messages.none;

      return res.status(errors.length > 0 ? 207 : 200).json({
        message: `${results.length + errors.length} ${messages.processedItemsPrefix} ${summary}.`,
        created: createdCount,
        updated: updatedCount,
        failed: errors.map(err => ({
          row: err.row,
          error: err.error,
          code: err.code,
          type: err.type || 'validation',
          key: results.find(r => r.row === err.row)?.key
        })),
        batchInfo: {
          totalBatches: batches.length,
          batchSize: batchSize,
          totalItems: items.length
        }
      });
    } catch (error) {
      const lang = (req.headers["accept-language"] || "en-US").split(",")[0];
      const messages = backendMessages[lang] || backendMessages["en-US"];

      let detail = '';
      let code = 'UNKNOWN';
      let statusCode = 500;

      // Handle permission errors
      if (error?.code === 'FORBIDDEN' || error?.message?.includes('FORBIDDEN')) {
        detail = 'No tiene permisos para acceder a esta colección. Verifique que tiene permisos de creación/actualización en la colección seleccionada.';
        code = 'FORBIDDEN';
        statusCode = 403;
      }
      // Handle array of errors
      else if (Array.isArray(error)) {
        detail = error.map((e) => {
          const field = e.extensions?.field || e.path || "desconocido";
          const fieldType = e.extensions?.type || "validation";
          const fieldCode = e.code || "UNKNOWN_ERROR";
          const description = getErrorTypeDescription(fieldCode, fieldType);
          return `Campo "${field}": ${description}`;
        }).join("; ");
        code = error[0]?.code || "UNKNOWN";
      }
      // Handle error with errors property
      else if (error?.errors && Array.isArray(error.errors)) {
        detail = error.errors.map((e) => {
          const field = e.extensions?.field || e.path || "desconocido";
          const fieldType = e.extensions?.type || "validation";
          const fieldCode = e.code || "UNKNOWN_ERROR";
          const description = getErrorTypeDescription(fieldCode, fieldType);
          return `Campo "${field}": ${description}`;
        }).join("; ");
        code = error.errors[0]?.code || "UNKNOWN";
      }
      // Handle single error
      else {
        detail = error?.message || error?.toString() || "Error interno del servidor";
        code = error?.code || "UNKNOWN";

        // Add more context for common errors
        if (error?.message?.includes('unique')) {
          detail += '. Este valor ya existe y debe ser único.';
        } else if (error?.message?.includes('required')) {
          detail += '. Faltan campos requeridos.';
        } else if (error?.message?.includes('invalid')) {
          detail += '. El formato de los datos no es válido.';
        }
      }

      statusCode = error.statusCode || statusCode;

      logger.error(`Error inesperado [${code}]: ${detail}`);
      logger.error({ code, statusCode, error: detail, stack: error?.stack });

      return res.status(statusCode).json({
        message: formatMessage(messages.internalError, { error: detail }),
        code,
        details: detail
      });
    }
  });
}