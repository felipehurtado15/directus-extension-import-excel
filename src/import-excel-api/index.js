import multer from "multer";
import * as XLSX from "xlsx";
import { backendMessages } from "../shared/i18nApi.js";

function formatMessage(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] || "");
}

function handleItemError(row, error, logger, errors, item = {}) {
  const detail =
    error?.map?.((e) => {
        const field = e.extensions?.field || e.path || "inconnu";
        const type = e.extensions?.type || "validation";
        const code = e.code || "UNKNOWN_ERROR";
        const value = item?.[field];
        return `Champ "${field}" : ${type} (${code})` + (value !== undefined ? ` | valeur : "${value}"` : "");
      })
      .join("; ") ||
    error?.message ||
    error ||
    "Validation failed";

  const code =
    error?.errors?.[0]?.code || error?.[0]?.code || error?.code || "UNKNOWN";

  logger.error(`Erreur ligne ${row} : ${detail}`);
  logger.error({ row, error: detail, code });

  errors.push({ row, error: detail, code });
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
      const keyField = req.body.keyField || null;
      const firstRowIsHeader = req.body.firstRowIsHeader === 'true';

      logger.info(`Importando a colección: ${collectionName}`);
      logger.info(`Primera fila es header: ${firstRowIsHeader}`);
      logger.info(`Campo clave: ${keyField || 'ninguno'}`);

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
              
              if (fieldType === 'date' && dateFormat && value !== undefined && value !== null) {
                // Transformar la fecha
                value = transformDate(value, dateFormat);
                logger.info(`Fecha transformada en fila ${excelRowNumber}, columna ${colIndex}: ${row[colIndex]} → ${value}`);
              }
              
              // Convertir a string y limpiar espacios
              const stringValue = value !== undefined && value !== null ? String(value).trim() : "";
              
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

      const results = [];
      const errors = [];
      let createdCount = 0;
      let updatedCount = 0;

      if (keyField) {
        // Modo UPSERT: crear o actualizar según campo clave
        const missingKey = items.find((item) => !(keyField in item));
        if (missingKey)
          return res.status(400).json({
            message: formatMessage(messages.missingKeyForUpsert, { keyField }),
          });

        const keyValues = [...new Set(items.map((item) => item[keyField]))];
        logger.info(`Buscando items existentes con valores de clave: ${keyValues.join(', ')}`);

        const existingItems = await itemsService.readByQuery({
          filter: { [keyField]: { _in: keyValues } },
          limit: keyValues.length,
        });

        const existingMap = new Map(
          existingItems.map((item) => [item[keyField], item])
        );

        logger.info(`Encontrados ${existingMap.size} items existentes`);

        for (const item of items) {
          const row = item.__rowIndex;
          const keyValue = item[keyField];
          delete item.__rowIndex; // Remover antes de insertar/actualizar

          try {
            if (existingMap.has(keyValue)) {
              const existing = existingMap.get(keyValue);
              await itemsService.updateOne(existing.id, item);
              results.push({ id: existing.id, action: "updated", row, key: keyValue });
              updatedCount++;
              logger.info(`✅ Fila ${row}: Actualizado (${keyField} = ${keyValue})`);
            } else {
              const newId = await itemsService.createOne(item);
              results.push({ id: newId, action: "created", row, key: keyValue });
              createdCount++;
              logger.info(`✅ Fila ${row}: Creado (${keyField} = ${keyValue})`);
            }
          } catch (error) {
            handleItemError(row, error, logger, errors, item);
          }
        }
      } else {
        // Modo INSERT: solo crear nuevos registros
        for (const item of items) {
          const row = item.__rowIndex;
          delete item.__rowIndex; // Remover antes de insertar

          try {
            const newId = await itemsService.createOne(item);
            results.push({ id: newId, action: "created", row });
            createdCount++;
            logger.info(`✅ Fila ${row}: Creado`);
          } catch (error) {
            handleItemError(row, error, logger, errors, item);
          }
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
          key: results.find(r => r.row === err.row)?.key
        })),
      });
    } catch (error) {
      const lang = (req.headers["accept-language"] || "en-US").split(",")[0];
      const messages = backendMessages[lang] || backendMessages["en-US"];

      const detail =
        error?.map?.((e) => {
            const field = e.extensions?.field || e.path || "inconnu";
            const type = e.extensions?.type || "validation";
            const code = e.code || "UNKNOWN_ERROR";
            return `Champ "${field}" : ${type} (${code})`;
          })
          .join("; ") ||
        error?.message ||
        error ||
        "Internal error";

      const code = error?.[0]?.code || error?.code || "UNKNOWN";

      logger.error(`Unexpected error: ${detail}`);
      logger.error({ code, error: detail });

      return res.status(error.statusCode || 500).json({
        message: formatMessage(messages.internalError, { error: detail }),
        code,
      });
    }
  });
}