<template>
  <private-view :title="t('title')" class="import-excel-ui">
    <div v-if="collections.length === 0" class="alert warning">
      <strong>⚠️ {{ t('noCollectionsWithPermissions') }}</strong>
      <p>{{ t('noCollectionsWithPermissionsHelp') }}</p>
    </div>

    <div class="step">
      <h2>{{ t('chooseCollection') }}</h2>
      <VSelect
        v-model="selectedCollection"
        :items="collections"
        item-text="label"
        item-value="value"
        :label="t('selectCollectionPlaceholder')"
        @update:modelValue="fetchFields"
        :disabled="collections.length === 0"
      />
    </div>

    <div class="step">
      <h2>{{ t('uploadExcelFile') }}</h2>
      <VInput
        type="file"
        @change="handleFileUpload"
        accept=".xlsx, .xls"
        :label="t('fileLabel')"
        :placeholder="t('filePlaceholder')"
      />
      <p class="info-text">{{ t('acceptedFormats') }}</p>
      
      <div class="checkbox-container" v-if="selectedFile">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            v-model="firstRowIsHeader"
            @change="handleHeaderCheckChange"
          />
          <span>{{ t('firstRowIsHeader') }}</span>
        </label>
      </div>
    </div>

    <div v-if="previewData.length" class="step">
      <h2>{{ t('columnMapping') }}</h2>
      <p class="info-text">{{ t('columnMappingHelp') }}</p>

      <div class="mapping-table">
        <div class="mapping-row header">
          <div class="column col-source">{{ t('sourceColumn') }}</div>
          <div class="column col-example">{{ t('exampleData') }}</div>
          <div class="column col-target">{{ t('targetField') }}</div>
          <div class="column col-type">{{ t('dataType') }}</div>
          <div class="column col-format">{{ t('dateFormat') }}</div>
        </div>

        <div v-for="(col, index) in previewData[0]" :key="'mapping-row-' + index" class="mapping-row">
          <div class="column col-source">
            <strong>{{ t('Column') }} {{ index + 1 }}</strong>
          </div>

          <div class="column col-example">
            <div class="example-preview">
              <div v-for="(example, exIdx) in getColumnExamples(index)" :key="exIdx" class="example-item">
                {{ example }}
              </div>
            </div>
          </div>

          <div class="column col-target">
            <VSelect
              v-model="mapping[index]"
              :items="getAvailableFields(index)"
              item-text="label"
              item-value="value"
              clearable
              :placeholder="t('selectFieldPlaceholder')"
            />
          </div>

          <div class="column col-type">
            <VSelect
              v-model="fieldTypes[index]"
              :items="dataTypes"
              item-text="label"
              item-value="value"
              :placeholder="t('selectType')"
              @update:modelValue="() => handleTypeChange(index)"
            />
          </div>

          <div class="column col-format">
            <VSelect
              v-if="fieldTypes[index] === 'date'"
              v-model="dateFormats[index]"
              :items="dateFormatOptions"
              item-text="label"
              item-value="value"
              :placeholder="t('selectDateFormat')"
            />
            <span v-else class="format-placeholder">—</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="previewData.length && contactFields.length" class="step compact-step">
      <h2>{{ t('keyFieldTitle') }}</h2>
      <div class="key-field-container">
        <VSelect
          v-model="keyField"
          :items="contactFields"
          item-text="label"
          item-value="value"
          :label="t('keyFieldLabel')"
          :placeholder="t('selectKeyFieldPlaceholder')"
          clearable
          class="key-field-select"
        />
        <p class="info-text compact">{{ t('keyFieldHelp1') }}</p>
      </div>
    </div>

    <div v-if="selectedFile" class="step action-step">
      <VButton
        @click="importFile"
        :disabled="!selectedCollection || isLoading"
        :loading="isLoading"
        color="primary"
        :xLarge="true"
      >
        {{ t('importButton') }}
      </VButton>
    </div>

    <div
      v-if="successMessage || errorMessage"
      :class="['alert', alertType]"
    >
      {{ successMessage || errorMessage }}
    </div>

    <div v-if="failedRows.length > 0" class="alert info">
      <div class="alert-header">
        <strong>{{ t('errorsDetected') }} ({{ failedRows.length }})</strong>
        <VButton
          @click="copyErrors"
          :xSmall="true"
          :secondary="true"
        >
          {{ t('copyErrors') }}
        </VButton>
      </div>

      <!-- Permission errors section -->
      <div v-if="permissionErrors.length > 0" class="error-section">
        <h4 class="error-section-title">🔒 {{ t('permissionErrors') }} ({{ permissionErrors.length }})</h4>
        <ul class="error-list permission-errors">
          <li v-for="row in permissionErrors" :key="row.row" class="error-item permission-error">
            <span class="error-icon">🔒</span>
            <div class="error-content">
              <strong>{{ t('row') }} {{ row.row }}{{ row.key ? ` (${t('key')}: ${row.key})` : '' }}</strong>
              <p class="error-detail">{{ row.error }}</p>
              <span class="error-code">{{ t('errorCode') }}: {{ row.code }}</span>
            </div>
          </li>
        </ul>
      </div>

      <!-- Validation errors section -->
      <div v-if="validationErrors.length > 0" class="error-section">
        <h4 class="error-section-title">⚠️ {{ t('validationErrors') }} ({{ validationErrors.length }})</h4>
        <ul class="error-list validation-errors">
          <li v-for="row in validationErrors" :key="row.row" class="error-item validation-error">
            <span class="error-icon">⚠️</span>
            <div class="error-content">
              <strong>{{ t('row') }} {{ row.row }}{{ row.key ? ` (${t('key')}: ${row.key})` : '' }}</strong>
              <p class="error-detail">{{ row.error }}</p>
              <span class="error-code">{{ t('errorCode') }}: {{ row.code }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>

  </private-view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import * as XLSX from 'xlsx';
import { useI18n } from 'vue-i18n';
import { messages } from '../shared/i18nModule';

// Stores et API
const api = useApi();
const { useCollectionsStore, usePermissionsStore } = useStores();
const collectionsStore = useCollectionsStore();
const permissionsStore = usePermissionsStore();

// État
const selectedCollection = ref(null);
const collections = ref([]);
const contactFields = ref([]);
const selectedFile = ref(null);
const previewData = ref([]);
const mapping = ref({});
const fieldTypes = ref({});
const dateFormats = ref({});
const importResult = ref(null); 
const successMessage = ref('');
const errorMessage = ref('');
const failedRows = ref([]);
const projectLanguage = ref('');
const isLoading = ref(false);
const keyField = ref('');
const firstRowIsHeader = ref(false);
const allRowsData = ref([]);

// Opciones de tipo de datos
const dataTypes = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' }
];

// Opciones de formato de fecha
const dateFormatOptions = [
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY (31/12/2023)' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY (12/31/2023)' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD (2023-12-31)' },
  { value: 'excel', label: 'Excel Serial (45063)' }
];

// 🔄 Retrieves the project language
async function fetchProjectInfo() {
  try {
    const response = await api.get('/server/info');
    projectLanguage.value = response.data.data.project.default_language || 'en-US';
    console.log('✅ Project language :', projectLanguage.value);
  } catch (err) {
    console.error('❌ Unable to retrieve the project language', err);
  }
}

const { t } = useI18n({
  locale: projectLanguage.value,
  messages,
});

// 🔄 Retrieves visible collections with create permissions
const availableCollections = computed(() =>
  collectionsStore.visibleCollections
    .filter((col) => {
      // Filter only collections with schema
      if (!col.schema || !col.schema.name) return false;

      // Check if user has create permission on this collection
      const hasCreatePermission = permissionsStore.hasPermission(col.collection, 'create');

      return hasCreatePermission;
    })
    .map((col) => ({
      value: col.collection,
      label: col.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

// 🔄 Retrieves fields from the selected collection
async function fetchFields(collection) {
  try {
    const response = await api.get(`/fields/${collection}`);
    contactFields.value = response.data.data
      .filter((f) => !f.field.startsWith('$'))
      .map((f) => {
        let label = f.field;
        const translations = f.meta?.translations;
        if (Array.isArray(translations)) {
          const match = translations.find((t) => t.language === projectLanguage.value);
          if (match?.translation) label = match.translation;
        }
        return { value: f.field, label };
      });

    console.log(`✅ Fields recovered for ${collection} :`, contactFields.value);
  } catch (err) {
    console.error(`❌ Error retrieving fields for ${collection} :`, err);
  }
}

// ⚙️ Filter fields to avoid duplicate mapping
function getAvailableFields(currentIndex) {
  const usedFields = Object.entries(mapping.value)
    .filter(([index, value]) => value && Number(index) !== currentIndex)
    .map(([, value]) => value);

  return contactFields.value
    .filter(field => !usedFields.includes(field.value))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// 📊 Get column examples (up to 3)
function getColumnExamples(columnIndex) {
  const examples = [];
  const maxExamples = 3;
  
  // Determinar desde qué fila empezar (si hay header, desde la segunda fila)
  const startRow = firstRowIsHeader.value ? 1 : 0;
  
  for (let i = startRow; i < allRowsData.value.length && examples.length < maxExamples; i++) {
    const value = allRowsData.value[i][columnIndex];
    if (value !== undefined && value !== null && value !== '') {
      examples.push(value);
    }
  }
  
  return examples;
}

// 🔄 Handle type change
function handleTypeChange(index) {
  if (fieldTypes.value[index] !== 'date') {
    dateFormats.value[index] = '';
  }
}

// 🔄 Auto-match fields based on headers
function autoMatchFields() {
  if (!firstRowIsHeader.value || previewData.value.length === 0) return;
  
  const headers = previewData.value[0];
  
  headers.forEach((header, index) => {
    if (!header) return;
    
    const headerLower = String(header).toLowerCase().trim();
    
    // Buscar coincidencia exacta en los campos disponibles
    const matchedField = contactFields.value.find(field => {
      const fieldLower = field.value.toLowerCase().trim();
      const labelLower = field.label.toLowerCase().trim();
      return fieldLower === headerLower || labelLower === headerLower;
    });
    
    if (matchedField && !Object.values(mapping.value).includes(matchedField.value)) {
      mapping.value[index] = matchedField.value;
      console.log(`✅ Auto-matched: "${header}" → "${matchedField.label}"`);
    }
  });
}

// 🔄 Handle header checkbox change
function handleHeaderCheckChange() {
  if (firstRowIsHeader.value) {
    // Auto-match fields when header is enabled
    autoMatchFields();
  }
}

// 📅 Transform date based on format
function transformDate(value, format) {
  if (!value || !format) return value;

  try {
    // Handle Excel serial date
    if (format === 'excel') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Handle text date formats
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
      return dateStr; // Already in correct format
    }

    if (day && month && year) {
      return `${year}-${month}-${day}`;
    }
  } catch (err) {
    console.error('Error transforming date:', err);
  }

  return value;
}

// 📤 Import Excel file
async function importFile() {
  try {
    isLoading.value = true; 
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('collection', selectedCollection.value);
    formData.append('mapping', JSON.stringify(mapping.value));
    formData.append('fieldTypes', JSON.stringify(fieldTypes.value));
    formData.append('dateFormats', JSON.stringify(dateFormats.value));
    formData.append('firstRowIsHeader', firstRowIsHeader.value ? 'true' : 'false');
    
    if (keyField.value) {
      formData.append('keyField', keyField.value);
    }

    const response = await api.post('/import-excel-api', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    importResult.value = response.data;
    successMessage.value = response.data.message || 'Import OK.';
    errorMessage.value = '';
    failedRows.value = response.data.failed || [];

    console.log('✅ Successful import', response);
  } catch (err) {
    errorMessage.value = err?.response?.data?.message || 'An error has occurred during import.';
    successMessage.value = '';
    failedRows.value = [];
    importResult.value = null;

    console.error('❌ Error when importing :', err);
  } finally {
    isLoading.value = false;
  }
}

// 📁 Manage file upload
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile.value = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Guardar todos los datos
    allRowsData.value = rows;
    
    // Mostrar preview (primeras 5 filas)
    previewData.value = rows.slice(0, 5);

    const cols = previewData.value[0]?.length || 0;
    mapping.value = {};
    fieldTypes.value = {};
    dateFormats.value = {};
    
    for (let i = 0; i < cols; i++) {
      mapping.value[i] = '';
      fieldTypes.value[i] = 'text'; // Default to text
      dateFormats.value[i] = '';
    }
    
    // Reset header checkbox
    firstRowIsHeader.value = false;
  };
  reader.readAsArrayBuffer(file);
}

// 📋 Copy errors to clipboard
function copyErrors() {
  const errorText = failedRows.value.map(row => {
    return `Ligne ${row.row}${row.key ? ` (clé : ${row.key})` : ''} : ${row.error}`;
  }).join('\n');

  navigator.clipboard.writeText(errorText).then(() => {
    alert('Les erreurs ont été copiées dans le presse-papiers.');
  }).catch(() => {
    alert('Impossible de copier les erreurs dans le presse-papiers.');
  });
}

const alertType = computed(() => {
  if (!importResult.value) return null;

  const hasFailed = (importResult.value.failed || []).length > 0;
  const hasCreatedOrUpdated =
    (importResult.value.created || 0) > 0 || (importResult.value.updated || 0) > 0;

  if (hasFailed && !hasCreatedOrUpdated) return 'error';
  if (hasFailed && hasCreatedOrUpdated) return 'warning';
  if (!hasFailed && hasCreatedOrUpdated) return 'success';

  return 'info';
});

// Separate permission errors from validation errors
const permissionErrors = computed(() => {
  return failedRows.value.filter(row =>
    row.type === 'permission' ||
    row.code === 'FORBIDDEN' ||
    row.error?.includes('permisos')
  );
});

const validationErrors = computed(() => {
  return failedRows.value.filter(row =>
    row.type !== 'permission' &&
    row.code !== 'FORBIDDEN' &&
    !row.error?.includes('permisos')
  );
});

// 🔁 Initialisation
onMounted(async () => {
  await fetchProjectInfo();
  collections.value = availableCollections.value;
  selectedCollection.value = collections.value[0]?.value || null;
  if (selectedCollection.value) {
    await fetchFields(selectedCollection.value);
  }
});
</script>

<style scoped>
.checkbox-container {
  margin-top: 16px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9375rem;
  color: var(--theme--foreground);
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-label span {
  user-select: none;
}

.step {
  margin-bottom: 24px;
  padding: 0 46px;
}

.compact-step {
  margin-bottom: 16px;
}

.action-step {
  margin-top: 20px;
  margin-bottom: 20px;
}

.key-field-container {
  max-width: 500px;
}

.key-field-select {
  margin-bottom: 8px;
}

.info-text {
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
  margin-top: 8px;
}

.info-text.compact {
  margin-top: 4px;
  margin-bottom: 0;
}

.mapping-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  width: 100%;
  max-width: 100%;
}

.mapping-row {
  display: grid;
  grid-template-columns: 100px 200px 2fr 120px 180px;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.mapping-row.header {
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 2px solid var(--theme--border-color);
  padding-bottom: 8px;
  color: var(--theme--foreground-subdued);
}

.column {
  overflow: hidden;
}

.col-source strong {
  font-size: 0.875rem;
  color: var(--theme--foreground);
}

.example-preview {
  font-family: var(--theme--fonts--monospace);
  font-size: 0.8125rem;
  color: var(--theme--foreground-subdued);
  padding: 6px 8px;
  background: var(--theme--background-subdued);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.example-item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 0;
}

.example-item:not(:last-child) {
  border-bottom: 1px solid var(--theme--border-color-subdued);
  padding-bottom: 4px;
}

.format-placeholder {
  color: var(--theme--foreground-subdued);
  font-size: 0.875rem;
  text-align: center;
  display: block;
}

/* Alertes */
.alert {
  padding: 16px 46px;
  border-radius: 6px;
  margin-top: 16px;
  margin-bottom: 8px;
}

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.error-section {
  margin-top: 16px;
}

.error-section:first-child {
  margin-top: 8px;
}

.error-section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--theme--foreground);
}

.error-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 400px;
  overflow-y: auto;
}

.error-item {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 6px;
  background: var(--theme--background);
  border-left: 4px solid var(--theme--border-color);
}

.error-item.permission-error {
  border-left-color: #d32f2f;
  background: rgba(211, 47, 47, 0.05);
}

.error-item.validation-error {
  border-left-color: #f57c00;
  background: rgba(245, 124, 0, 0.05);
}

.error-icon {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
}

.error-content strong {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 4px;
  color: var(--theme--foreground);
}

.error-detail {
  margin: 4px 0;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--theme--foreground-subdued);
}

.error-code {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-family: var(--theme--fonts--monospace);
  background: var(--theme--background-subdued);
  border-radius: 3px;
  color: var(--theme--foreground-subdued);
}

.alert.success {
  background: var(--theme--success-background, #e0ffe0);
  color: var(--theme--success-foreground, #067d06);
  border: 1px solid var(--theme--success-border, #9de89d);
}

.alert.error {
  background: var(--theme--danger-background, #ffe0e0);
  color: var(--theme--danger-foreground, #c00);
  border: 1px solid var(--theme--danger-border, #ef9a9a);
}

.alert.warning {
  background: var(--theme--warning-background, #fffbe6);
  color: var(--theme--warning-foreground, #8a6d3b);
  border: 1px solid var(--theme--warning-border, #ffecb5);
}

.alert.info {
  background: var(--theme--primary-background, #e3f2fd);
  color: var(--theme--primary-foreground, #1976d2);
  border: 1px solid var(--theme--primary-border, #90caf9);
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .mapping-row {
    grid-template-columns: 80px 160px 1.5fr 100px 160px;
    gap: 10px;
  }
}

@media (max-width: 900px) {
  .mapping-row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px;
    background: var(--theme--background-subdued);
    border-radius: 6px;
  }

  .mapping-row.header {
    display: none;
  }

  .column::before {
    content: attr(data-label);
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
    font-size: 0.75rem;
    color: var(--theme--foreground-subdued);
  }
  
  .example-preview {
    max-height: 150px;
    overflow-y: auto;
  }
}
</style>