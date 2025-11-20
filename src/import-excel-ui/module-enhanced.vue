<template>
  <private-view :title="t('title')" class="import-excel-ui-enhanced">
    <!-- Warning when no collections available -->
    <div v-if="collections.length === 0" class="alert warning">
      <strong>⚠️ {{ t('noCollectionsWithPermissions') }}</strong>
      <p>{{ t('noCollectionsWithPermissionsHelp') }}</p>
    </div>

    <!-- Main content when collections are available -->
    <div v-else class="stepper-container">
      <!-- Stepper Navigation -->
      <div class="stepper-header">
        <div
          v-for="(step, index) in steps"
          :key="index"
          :class="['stepper-item', {
            'active': currentStep === index,
            'completed': currentStep > index,
            'disabled': currentStep < index && !canNavigateToStep(index)
          }]"
          @click="navigateToStep(index)"
        >
          <div class="stepper-circle">
            <span v-if="currentStep > index" class="icon">✓</span>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <div class="stepper-label">{{ step.label }}</div>
        </div>
      </div>

      <!-- Step Content -->
      <div class="stepper-content">

        <!-- Step 1: Select Collection -->
        <div v-show="currentStep === 0" class="step-panel">
          <div class="panel-card">
            <h2>{{ t('step1Title') }}</h2>
            <p class="step-description">{{ t('step1Description') }}</p>

            <VSelect
              v-model="selectedCollection"
              :items="collections"
              item-text="label"
              item-value="value"
              :label="t('selectCollectionPlaceholder')"
              @update:modelValue="onCollectionSelected"
            />

            <!-- Saved Configurations -->
            <div v-if="savedConfigs.length > 0 && selectedCollection" class="saved-configs">
              <h3>{{ t('savedConfigurations') }}</h3>
              <div class="config-list">
                <div
                  v-for="config in savedConfigs"
                  :key="config.id"
                  class="config-item"
                  @click="loadConfiguration(config)"
                >
                  <div class="config-info">
                    <strong>{{ config.name }}</strong>
                    <span class="config-date">{{ formatDate(config.date) }}</span>
                  </div>
                  <VButton
                    @click.stop="deleteConfiguration(config.id)"
                    icon
                    :xSmall="true"
                    secondary
                  >
                    <span class="icon-delete">🗑️</span>
                  </VButton>
                </div>
              </div>
            </div>

            <div class="step-actions">
              <VButton
                @click="nextStep"
                :disabled="!selectedCollection"
                large
              >
                {{ t('continue') }}
              </VButton>
            </div>
          </div>
        </div>

        <!-- Step 2: Upload File -->
        <div v-show="currentStep === 1" class="step-panel">
          <div class="panel-card">
            <h2>{{ t('step2Title') }}</h2>
            <p class="step-description">{{ t('step2Description') }}</p>

            <!-- Export Template Button -->
            <div class="template-actions">
              <VButton
                @click="exportTemplate"
                :disabled="!selectedCollection"
                secondary
              >
                📥 {{ t('downloadTemplate') }}
              </VButton>
            </div>

            <!-- Drag & Drop Zone -->
            <div
              :class="['dropzone', { 'dragover': isDragging, 'has-file': selectedFile }]"
              @drop.prevent="handleDrop"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
            >
              <div v-if="!selectedFile" class="dropzone-content">
                <div class="dropzone-icon">📁</div>
                <p class="dropzone-text">{{ t('dragDropText') }}</p>
                <p class="dropzone-subtext">{{ t('orClickToSelect') }}</p>
                <input
                  type="file"
                  ref="fileInput"
                  @change="handleFileUpload"
                  accept=".xlsx, .xls"
                  style="display: none"
                />
                <VButton @click="$refs.fileInput.click()" secondary>
                  {{ t('selectFile') }}
                </VButton>
              </div>
              <div v-else class="file-selected">
                <div class="file-icon">📄</div>
                <div class="file-info">
                  <strong>{{ selectedFile.name }}</strong>
                  <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
                  <span class="file-rows" v-if="allRowsData.length > 0">
                    {{ allRowsData.length }} {{ t('rows') }}
                  </span>
                </div>
                <VButton
                  @click="removeFile"
                  icon
                  secondary
                >
                  ✕
                </VButton>
              </div>
            </div>

            <div class="step-actions">
              <VButton @click="prevStep" secondary>{{ t('back') }}</VButton>
              <VButton
                @click="nextStep"
                :disabled="!selectedFile || previewData.length === 0"
                large
              >
                {{ t('continue') }}
              </VButton>
            </div>
          </div>
        </div>

        <!-- Step 3: Map Fields -->
        <div v-show="currentStep === 2" class="step-panel">
          <div class="panel-card">
            <h2>{{ t('step3Title') }}</h2>
            <p class="step-description">{{ t('step3Description') }}</p>

            <!-- First Row Header Checkbox -->
            <div class="checkbox-container">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="firstRowIsHeader"
                  @change="handleHeaderCheckChange"
                />
                <span>{{ t('firstRowIsHeader') }}</span>
              </label>
            </div>

            <!-- Mapping Table -->
            <div class="mapping-table">
              <div class="mapping-row header">
                <div class="column col-source">{{ t('sourceColumn') }}</div>
                <div class="column col-example">{{ t('exampleData') }}</div>
                <div class="column col-target">{{ t('targetField') }}</div>
                <div class="column col-type">{{ t('dataType') }}</div>
                <div class="column col-transform">{{ t('transformations') }}</div>
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
                  <VSelect
                    v-if="fieldTypes[index] === 'date'"
                    v-model="dateFormats[index]"
                    :items="dateFormatOptions"
                    item-text="label"
                    item-value="value"
                    :placeholder="t('selectDateFormat')"
                    class="date-format-select"
                  />
                </div>

                <div class="column col-transform">
                  <VSelect
                    v-model="transformations[index]"
                    :items="transformationOptions"
                    item-text="label"
                    item-value="value"
                    :placeholder="t('noTransformation')"
                    clearable
                    multiple
                  />
                </div>
              </div>
            </div>

            <!-- Save Configuration -->
            <div class="save-config-section">
              <h3>{{ t('saveThisMapping') }}</h3>
              <div class="save-config-input">
                <VInput
                  v-model="configName"
                  :placeholder="t('configurationName')"
                />
                <VButton
                  @click="saveConfiguration"
                  :disabled="!configName || Object.keys(mapping).length === 0"
                  secondary
                >
                  💾 {{ t('saveConfiguration') }}
                </VButton>
              </div>
            </div>

            <div class="step-actions">
              <VButton @click="prevStep" secondary>{{ t('back') }}</VButton>
              <VButton
                @click="nextStep"
                :disabled="!hasMappedFields"
                large
              >
                {{ t('continue') }}
              </VButton>
            </div>
          </div>
        </div>

        <!-- Step 4: Validate -->
        <div v-show="currentStep === 3" class="step-panel">
          <div class="panel-card">
            <h2>{{ t('step4Title') }}</h2>
            <p class="step-description">{{ t('step4Description') }}</p>

            <!-- Validation in progress -->
            <div v-if="isValidating" class="validation-loading">
              <div class="spinner"></div>
              <p>{{ t('validating') }}</p>
            </div>

            <!-- Validation Results -->
            <div v-else-if="validationResults" class="validation-results">
              <div class="validation-summary">
                <div class="summary-card success">
                  <div class="summary-icon">✓</div>
                  <div class="summary-content">
                    <h3>{{ validationResults.valid }}</h3>
                    <p>{{ t('validRows') }}</p>
                  </div>
                </div>
                <div class="summary-card warning">
                  <div class="summary-icon">⚠️</div>
                  <div class="summary-content">
                    <h3>{{ validationResults.warnings }}</h3>
                    <p>{{ t('warningRows') }}</p>
                  </div>
                </div>
                <div class="summary-card error">
                  <div class="summary-icon">✕</div>
                  <div class="summary-content">
                    <h3>{{ validationResults.errors }}</h3>
                    <p>{{ t('errorRows') }}</p>
                  </div>
                </div>
              </div>

              <!-- Validation Issues -->
              <div v-if="validationResults.issues.length > 0" class="validation-issues">
                <h3>{{ t('validationIssues') }}</h3>
                <div class="issues-list">
                  <div
                    v-for="(issue, idx) in validationResults.issues.slice(0, 10)"
                    :key="idx"
                    :class="['issue-item', issue.type]"
                  >
                    <span class="issue-icon">{{ issue.type === 'error' ? '✕' : '⚠️' }}</span>
                    <div class="issue-content">
                      <strong>{{ t('row') }} {{ issue.row }}</strong>
                      <p>{{ issue.message }}</p>
                    </div>
                  </div>
                </div>
                <p v-if="validationResults.issues.length > 10" class="more-issues">
                  {{ t('andMoreIssues', { count: validationResults.issues.length - 10 }) }}
                </p>
              </div>

              <!-- Optional Key Fields for Upsert (Multiple Selection) -->
              <!-- Only show if user has update permission on selected collection -->
              <div v-if="contactFields.length > 0 && hasUpdatePermission" class="key-field-section">
                <h3>{{ t('keyFieldTitle') }}</h3>
                <VSelect
                  v-model="keyField"
                  :items="contactFields"
                  item-text="label"
                  item-value="value"
                  :label="t('keyFieldLabel')"
                  :placeholder="t('selectKeyFieldPlaceholder')"
                  multiple
                  clearable
                />
                <p class="info-text">{{ t('keyFieldHelp1') }}</p>
              </div>
            </div>

            <div class="step-actions">
              <VButton @click="prevStep" secondary>{{ t('back') }}</VButton>
              <VButton
                v-if="!validationResults"
                @click="runValidation"
                large
              >
                {{ t('validateData') }}
              </VButton>
              <VButton
                v-else
                @click="nextStep"
                large
              >
                {{ t('continue') }}
              </VButton>
            </div>
          </div>
        </div>

        <!-- Step 5: Confirm & Import -->
        <div v-show="currentStep === 4" class="step-panel">
          <div class="panel-card">
            <h2>{{ t('step5Title') }}</h2>
            <p class="step-description">{{ t('step5Description') }}</p>

            <!-- Import Summary -->
            <div class="import-summary">
              <div class="summary-section">
                <h3>{{ t('importDetails') }}</h3>
                <div class="detail-row">
                  <span class="label">{{ t('collection') }}:</span>
                  <span class="value">{{ getCollectionLabel(selectedCollection) }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">{{ t('file') }}:</span>
                  <span class="value">{{ selectedFile?.name }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">{{ t('totalRows') }}:</span>
                  <span class="value">{{ getTotalDataRows() }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">{{ t('mappedFields') }}:</span>
                  <span class="value">{{ getMappedFieldsCount() }}</span>
                </div>
                <div class="detail-row" v-if="keyField.length > 0">
                  <span class="label">{{ t('operation') }}:</span>
                  <span class="value badge">{{ t('createOrUpdate') }}</span>
                </div>
                <div class="detail-row" v-if="keyField.length > 0">
                  <span class="label">{{ t('keyFields') }}:</span>
                  <span class="value">{{ keyField.join(', ') }}</span>
                </div>
                <div class="detail-row" v-else>
                  <span class="label">{{ t('operation') }}:</span>
                  <span class="value badge">{{ t('createOnly') }}</span>
                </div>
              </div>

              <div class="summary-section" v-if="validationResults">
                <h3>{{ t('validationSummary') }}</h3>
                <div class="validation-badges">
                  <span class="badge success">✓ {{ validationResults.valid }} {{ t('valid') }}</span>
                  <span class="badge warning" v-if="validationResults.warnings > 0">
                    ⚠️ {{ validationResults.warnings }} {{ t('warnings') }}
                  </span>
                  <span class="badge error" v-if="validationResults.errors > 0">
                    ✕ {{ validationResults.errors }} {{ t('errors') }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Import Progress -->
            <div v-if="isImporting" class="import-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: importProgress + '%' }"></div>
              </div>
              <div class="progress-stats">
                <span>{{ t('importing') }}... {{ importProgress }}%</span>
                <span>{{ processedRows }} / {{ getTotalDataRows() }} {{ t('rows') }}</span>
              </div>
              <div v-if="importSpeed > 0" class="progress-speed">
                <span>{{ importSpeed }} {{ t('rowsPerSecond') }}</span>
                <span v-if="estimatedTimeLeft > 0">{{ t('estimatedTime') }}: {{ formatTime(estimatedTimeLeft) }}</span>
              </div>
            </div>

            <!-- Import Results -->
            <div v-if="importResult" class="import-results">
              <div :class="['alert', getImportAlertType()]">
                <strong>{{ importResult.message }}</strong>
              </div>

              <div class="results-summary">
                <div class="result-stat success" v-if="importResult.created > 0">
                  <span class="stat-number">{{ importResult.created }}</span>
                  <span class="stat-label">{{ t('created') }}</span>
                </div>
                <div class="result-stat info" v-if="importResult.updated > 0">
                  <span class="stat-number">{{ importResult.updated }}</span>
                  <span class="stat-label">{{ t('updated') }}</span>
                </div>
                <div class="result-stat error" v-if="importResult.failed && importResult.failed.length > 0">
                  <span class="stat-number">{{ importResult.failed.length }}</span>
                  <span class="stat-label">{{ t('failed') }}</span>
                </div>
              </div>

              <!-- Batch Processing Info -->
              <div v-if="importResult.batchInfo && importResult.batchInfo.totalBatches > 1" class="batch-info">
                <div class="batch-info-header">
                  <span class="batch-icon">📦</span>
                  <strong>Batch Processing</strong>
                </div>
                <div class="batch-info-details">
                  <span>{{ importResult.batchInfo.totalItems }} items processed in {{ importResult.batchInfo.totalBatches }} batches</span>
                  <span class="batch-size-info">({{ importResult.batchInfo.batchSize }} items per batch)</span>
                </div>
              </div>

              <!-- Failed Rows Details -->
              <div v-if="importResult.failed && importResult.failed.length > 0" class="failed-details">
                <div class="alert-header">
                  <strong>{{ t('errorsDetected') }} ({{ importResult.failed.length }})</strong>
                  <VButton
                    @click="copyErrors"
                    :xSmall="true"
                    :secondary="true"
                  >
                    {{ t('copyErrors') }}
                  </VButton>
                </div>

                <!-- Permission errors -->
                <div v-if="getPermissionErrors(importResult.failed).length > 0" class="error-section">
                  <h4 class="error-section-title">🔒 {{ t('permissionErrors') }} ({{ getPermissionErrors(importResult.failed).length }})</h4>
                  <ul class="error-list">
                    <li v-for="row in getPermissionErrors(importResult.failed)" :key="row.row" class="error-item permission-error">
                      <span class="error-icon">🔒</span>
                      <div class="error-content">
                        <strong>{{ t('row') }} {{ row.row }}{{ row.key ? ` (${t('key')}: ${row.key})` : '' }}</strong>
                        <p class="error-detail">{{ row.error }}</p>
                        <span class="error-code">{{ t('errorCode') }}: {{ row.code }}</span>
                      </div>
                    </li>
                  </ul>
                </div>

                <!-- Validation errors -->
                <div v-if="getValidationErrors(importResult.failed).length > 0" class="error-section">
                  <h4 class="error-section-title">⚠️ {{ t('validationErrors') }} ({{ getValidationErrors(importResult.failed).length }})</h4>
                  <ul class="error-list">
                    <li v-for="row in getValidationErrors(importResult.failed)" :key="row.row" class="error-item validation-error">
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
            </div>

            <div class="step-actions">
              <VButton
                v-if="!isImporting && !importResult"
                @click="prevStep"
                secondary
              >
                {{ t('back') }}
              </VButton>
              <VButton
                v-if="!isImporting && !importResult"
                @click="startImport"
                :disabled="isImporting"
                large
                class="import-button"
              >
                🚀 {{ t('startImport') }}
              </VButton>
              <VButton
                v-if="importResult"
                @click="resetImport"
                large
              >
                {{ t('importAnother') }}
              </VButton>
            </div>
          </div>
        </div>

      </div>
    </div>
  </private-view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import * as XLSX from 'xlsx';
import { useI18n } from 'vue-i18n';
import { messages } from '../shared/i18nModule-enhanced';

// Stores and API
const api = useApi();
const { useCollectionsStore, usePermissionsStore } = useStores();
const collectionsStore = useCollectionsStore();
const permissionsStore = usePermissionsStore();

// Stepper state
const currentStep = ref(0);
const steps = computed(() => [
  { label: t('stepCollection') },
  { label: t('stepUpload') },
  { label: t('stepMapping') },
  { label: t('stepValidation') },
  { label: t('stepImport') }
]);

// State
const selectedCollection = ref(null);
const collections = ref([]);
const contactFields = ref([]);
const selectedFile = ref(null);
const previewData = ref([]);
const mapping = ref({});
const fieldTypes = ref({});
const dateFormats = ref({});
const transformations = ref({});
const importResult = ref(null);
const projectLanguage = ref('');
const keyField = ref([]);
const firstRowIsHeader = ref(false);
const allRowsData = ref([]);
const isDragging = ref(false);
const configName = ref('');
const savedConfigs = ref([]);
const validationResults = ref(null);
const isValidating = ref(false);
const isImporting = ref(false);
const importProgress = ref(0);
const processedRows = ref(0);
const importSpeed = ref(0);
const estimatedTimeLeft = ref(0);
const batchSize = ref(100); // Default batch size for large files

// Data type options
const dataTypes = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' }
];

// Date format options
const dateFormatOptions = [
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY (31/12/2023)' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY (12/31/2023)' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD (2023-12-31)' },
  { value: 'excel', label: 'Excel Serial (45063)' }
];


// Fetch project info
async function fetchProjectInfo() {
  try {
    const response = await api.get('/server/info');
    projectLanguage.value = response.data.data.project.default_language || 'en-US';
    console.log('✅ Project language:', projectLanguage.value);
  } catch (err) {
    console.error('❌ Unable to retrieve project language', err);
  }
}

const { t } = useI18n({
  locale: projectLanguage.value,
  messages,
});

// Transformation options
const transformationOptions = computed(() => [
  { value: 'trim', label: t('transformTrim') },
  { value: 'uppercase', label: t('transformUppercase') },
  { value: 'lowercase', label: t('transformLowercase') },
  { value: 'capitalize', label: t('transformCapitalize') }
]);

// Get collections with create permissions
const availableCollections = computed(() =>
  collectionsStore.visibleCollections
    .filter((col) => {
      if (!col.schema || !col.schema.name) return false;
      const hasCreatePermission = permissionsStore.hasPermission(col.collection, 'create');
      return hasCreatePermission;
    })
    .map((col) => ({
      value: col.collection,
      label: col.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

// Fetch fields from selected collection
async function fetchFields(collection) {
  try {
    // Campos de auditoría de Directus que se completan automáticamente
    const auditFields = ['sort', 'user_created', 'date_created', 'user_updated', 'date_updated'];

    const response = await api.get(`/fields/${collection}`);
    contactFields.value = response.data.data
      .filter((f) => !f.field.startsWith('$'))
      .filter((f) => !auditFields.includes(f.field)) // Excluir campos de auditoría
      .map((f) => {
        let label = f.field;
        const translations = f.meta?.translations;
        if (Array.isArray(translations)) {
          const match = translations.find((t) => t.language === projectLanguage.value);
          if (match?.translation) label = match.translation;
        }
        return {
          value: f.field,
          label,
          type: f.type,
          required: f.meta?.required || false
        };
      });

    console.log(`✅ Fields retrieved for ${collection}:`, contactFields.value);
    console.log(`🔒 Campos de auditoría excluidos del mapeo: ${auditFields.join(', ')}`);
  } catch (err) {
    console.error(`❌ Error retrieving fields for ${collection}:`, err);
  }
}

// Get available fields for mapping (avoiding duplicates)
function getAvailableFields(currentIndex) {
  const usedFields = Object.entries(mapping.value)
    .filter(([index, value]) => value && Number(index) !== currentIndex)
    .map(([, value]) => value);

  return contactFields.value
    .filter(field => !usedFields.includes(field.value))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Get column examples
function getColumnExamples(columnIndex) {
  const examples = [];
  const maxExamples = 3;
  const startRow = firstRowIsHeader.value ? 1 : 0;

  for (let i = startRow; i < allRowsData.value.length && examples.length < maxExamples; i++) {
    const value = allRowsData.value[i][columnIndex];
    if (value !== undefined && value !== null && value !== '') {
      examples.push(value);
    }
  }

  return examples;
}

// Handle type change
function handleTypeChange(index) {
  if (fieldTypes.value[index] !== 'date') {
    dateFormats.value[index] = '';
  }
}

// Auto-match fields
function autoMatchFields() {
  if (!firstRowIsHeader.value || previewData.value.length === 0) return;

  const headers = previewData.value[0];

  headers.forEach((header, index) => {
    if (!header) return;

    const headerLower = String(header).toLowerCase().trim();
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

// Handle header checkbox change
function handleHeaderCheckChange() {
  if (firstRowIsHeader.value) {
    autoMatchFields();
  }
}

// Handle file upload
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  processFile(file);
}

// Handle drag and drop
function handleDrop(e) {
  isDragging.value = false;
  const file = e.dataTransfer.files[0];
  if (!file) return;

  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    alert(t('invalidFileType'));
    return;
  }

  processFile(file);
}

// Process uploaded file
function processFile(file) {
  selectedFile.value = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    allRowsData.value = rows;
    previewData.value = rows.slice(0, 5);

    const cols = previewData.value[0]?.length || 0;
    mapping.value = {};
    fieldTypes.value = {};
    dateFormats.value = {};
    transformations.value = {};

    for (let i = 0; i < cols; i++) {
      mapping.value[i] = '';
      fieldTypes.value[i] = 'text';
      dateFormats.value[i] = '';
      transformations.value[i] = [];
    }

    firstRowIsHeader.value = false;
  };
  reader.readAsArrayBuffer(file);
}

// Remove file
function removeFile() {
  selectedFile.value = null;
  previewData.value = [];
  allRowsData.value = [];
  mapping.value = {};
  fieldTypes.value = {};
  dateFormats.value = {};
  transformations.value = {};
  firstRowIsHeader.value = false;
}

// Export Excel template
async function exportTemplate() {
  if (!selectedCollection.value) return;

  await fetchFields(selectedCollection.value);

  const headers = contactFields.value.map(f => f.label);
  const types = contactFields.value.map(f => f.type);
  const required = contactFields.value.map(f => f.required ? 'Required' : 'Optional');

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    types,
    required
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  XLSX.writeFile(wb, `${selectedCollection.value}_template.xlsx`);
}

// Save configuration
function saveConfiguration() {
  if (!configName.value) return;

  const config = {
    id: Date.now(),
    name: configName.value,
    collection: selectedCollection.value,
    mapping: { ...mapping.value },
    fieldTypes: { ...fieldTypes.value },
    dateFormats: { ...dateFormats.value },
    transformations: { ...transformations.value },
    date: new Date().toISOString()
  };

  const configs = JSON.parse(localStorage.getItem('import-excel-configs') || '[]');
  configs.push(config);
  localStorage.setItem('import-excel-configs', JSON.stringify(configs));

  loadSavedConfigurations();
  configName.value = '';

  alert(t('configurationSaved'));
}

// Load saved configurations
function loadSavedConfigurations() {
  const configs = JSON.parse(localStorage.getItem('import-excel-configs') || '[]');
  savedConfigs.value = configs.filter(c => c.collection === selectedCollection.value);
}

// Load configuration
function loadConfiguration(config) {
  mapping.value = { ...config.mapping };
  fieldTypes.value = { ...config.fieldTypes };
  dateFormats.value = { ...config.dateFormats };
  transformations.value = { ...config.transformations };

  alert(t('configurationLoaded'));
}

// Delete configuration
function deleteConfiguration(id) {
  if (!confirm(t('confirmDeleteConfig'))) return;

  const configs = JSON.parse(localStorage.getItem('import-excel-configs') || '[]');
  const filtered = configs.filter(c => c.id !== id);
  localStorage.setItem('import-excel-configs', JSON.stringify(filtered));

  loadSavedConfigurations();
}

// Run validation
async function runValidation() {
  isValidating.value = true;
  validationResults.value = null;

  // Simulate validation
  await new Promise(resolve => setTimeout(resolve, 1000));

  const startRow = firstRowIsHeader.value ? 1 : 0;
  const dataRows = allRowsData.value.slice(startRow);

  let valid = 0;
  let warnings = 0;
  let errors = 0;
  const issues = [];

  dataRows.forEach((row, index) => {
    const rowNumber = startRow + index + 1;
    let hasError = false;
    let hasWarning = false;

    // Check mapped fields
    Object.entries(mapping.value).forEach(([colIndex, fieldName]) => {
      if (!fieldName) return;

      const value = row[colIndex];
      const fieldType = fieldTypes.value[colIndex];
      const field = contactFields.value.find(f => f.value === fieldName);

      // Check required fields
      if (field?.required && (!value || String(value).trim() === '')) {
        hasError = true;
        issues.push({
          row: rowNumber,
          type: 'error',
          message: `Campo requerido "${field.label}" está vacío`
        });
      }

      // Validate data types
      if (value && fieldType === 'number' && isNaN(Number(value))) {
        hasWarning = true;
        issues.push({
          row: rowNumber,
          type: 'warning',
          message: `El valor "${value}" en "${field.label}" no es un número válido`
        });
      }

      if (value && fieldType === 'email' && !String(value).includes('@')) {
        hasWarning = true;
        issues.push({
          row: rowNumber,
          type: 'warning',
          message: `El valor "${value}" en "${field.label}" no parece ser un email válido`
        });
      }
    });

    if (hasError) errors++;
    else if (hasWarning) warnings++;
    else valid++;
  });

  validationResults.value = {
    valid,
    warnings,
    errors,
    issues: issues.slice(0, 50) // Limit to 50 issues
  };

  isValidating.value = false;
}

// Start import
async function startImport() {
  isImporting.value = true;
  importProgress.value = 0;
  processedRows.value = 0;
  importResult.value = null;

  const startTime = Date.now();

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('collection', selectedCollection.value);
    formData.append('mapping', JSON.stringify(mapping.value));
    formData.append('fieldTypes', JSON.stringify(fieldTypes.value));
    formData.append('dateFormats', JSON.stringify(dateFormats.value));
    formData.append('transformations', JSON.stringify(transformations.value));
    formData.append('firstRowIsHeader', firstRowIsHeader.value ? 'true' : 'false');
    formData.append('batchSize', batchSize.value.toString());

    if (keyField.value.length > 0) {
      formData.append('keyFields', JSON.stringify(keyField.value));
    }

    // Simulate progress
    const totalRows = getTotalDataRows();
    const progressInterval = setInterval(() => {
      if (importProgress.value < 90) {
        importProgress.value += 10;
        processedRows.value = Math.floor((importProgress.value / 100) * totalRows);

        const elapsed = (Date.now() - startTime) / 1000;
        importSpeed.value = Math.floor(processedRows.value / elapsed);
        const remaining = totalRows - processedRows.value;
        estimatedTimeLeft.value = importSpeed.value > 0 ? Math.ceil(remaining / importSpeed.value) : 0;
      }
    }, 500);

    const response = await api.post('/import-excel-api', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    clearInterval(progressInterval);
    importProgress.value = 100;
    processedRows.value = totalRows;

    importResult.value = response.data;
    console.log('✅ Import successful', response);
  } catch (err) {
    importResult.value = {
      message: err?.response?.data?.message || t('importError'),
      created: 0,
      updated: 0,
      failed: []
    };
    console.error('❌ Import error:', err);
  } finally {
    isImporting.value = false;
  }
}

// Reset import
function resetImport() {
  currentStep.value = 0;
  selectedCollection.value = null;
  selectedFile.value = null;
  previewData.value = [];
  allRowsData.value = [];
  mapping.value = {};
  fieldTypes.value = {};
  dateFormats.value = {};
  transformations.value = {};
  validationResults.value = null;
  importResult.value = null;
  keyField.value = [];
  firstRowIsHeader.value = false;
  importProgress.value = 0;
  processedRows.value = 0;
}

// Copy errors to clipboard
function copyErrors() {
  if (!importResult.value?.failed) return;

  const errorText = importResult.value.failed.map(row => {
    return `${t('row')} ${row.row}${row.key ? ` (${t('key')}: ${row.key})` : ''} : ${row.error}`;
  }).join('\n');

  navigator.clipboard.writeText(errorText).then(() => {
    alert(t('errorsCopied'));
  }).catch(() => {
    alert(t('errorsCopyFailed'));
  });
}

// Stepper navigation
function nextStep() {
  if (currentStep.value < steps.value.length - 1) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
}

function canNavigateToStep(index) {
  if (index === 0) return true;
  if (index === 1) return selectedCollection.value !== null;
  if (index === 2) return selectedFile.value !== null && previewData.value.length > 0;
  if (index === 3) return hasMappedFields.value;
  if (index === 4) return validationResults.value !== null;
  return false;
}

function navigateToStep(index) {
  if (canNavigateToStep(index) && index <= currentStep.value) {
    currentStep.value = index;
  }
}

// Collection selected
async function onCollectionSelected(collection) {
  await fetchFields(collection);
  loadSavedConfigurations();
  // Clear key fields when changing collection (will be hidden if no update permission)
  keyField.value = [];
}

// Computed properties
const hasMappedFields = computed(() => {
  return Object.values(mapping.value).some(v => v !== '');
});

const hasUpdatePermission = computed(() => {
  if (!selectedCollection.value) return false;
  return permissionsStore.hasPermission(selectedCollection.value, 'update');
});

// Helper functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function getCollectionLabel(value) {
  return collections.value.find(c => c.value === value)?.label || value;
}

function getTotalDataRows() {
  const startRow = firstRowIsHeader.value ? 1 : 0;
  return allRowsData.value.length - startRow;
}

function getMappedFieldsCount() {
  return Object.values(mapping.value).filter(v => v !== '').length;
}

function getImportAlertType() {
  if (!importResult.value) return 'info';
  const hasFailed = (importResult.value.failed || []).length > 0;
  const hasSuccess = (importResult.value.created || 0) > 0 || (importResult.value.updated || 0) > 0;

  if (hasFailed && !hasSuccess) return 'error';
  if (hasFailed && hasSuccess) return 'warning';
  if (!hasFailed && hasSuccess) return 'success';
  return 'info';
}

function getPermissionErrors(failed) {
  return failed.filter(row =>
    row.type === 'permission' ||
    row.code === 'FORBIDDEN' ||
    row.error?.includes('permisos')
  );
}

function getValidationErrors(failed) {
  return failed.filter(row =>
    row.type !== 'permission' &&
    row.code !== 'FORBIDDEN' &&
    !row.error?.includes('permisos')
  );
}

// Initialization
onMounted(async () => {
  await fetchProjectInfo();
  collections.value = availableCollections.value;
  selectedCollection.value = collections.value[0]?.value || null;
  if (selectedCollection.value) {
    await fetchFields(selectedCollection.value);
    loadSavedConfigurations();
  }
});
</script>

<style scoped>
.import-excel-ui-enhanced {
  margin: 0 auto;
}

/* Stepper Styles */
.stepper-container {
  background: var(--theme--background);
  border-radius: 8px;
  overflow: hidden;
}

.stepper-header {
  display: flex;
  justify-content: space-between;
  padding: 32px 48px;
  background: var(--theme--background-subdued);
  border-bottom: 2px solid var(--theme--border-color);
}

.stepper-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  position: relative;
  flex: 1;
}

.stepper-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 20px;
  left: calc(50% + 30px);
  width: calc(100% - 60px);
  height: 2px;
  background: var(--theme--border-color);
  z-index: 0;
}

.stepper-item.completed:not(:last-child)::after {
  background: var(--theme--primary);
}

.stepper-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--theme--background);
  border: 2px solid var(--theme--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  z-index: 1;
  transition: all 0.3s ease;
}

.stepper-item.active .stepper-circle {
  background: var(--theme--primary);
  color: white;
  border-color: var(--theme--primary);
  transform: scale(1.1);
}

.stepper-item.completed .stepper-circle {
  background: var(--theme--primary);
  color: white;
  border-color: var(--theme--primary);
}

.stepper-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stepper-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--theme--foreground-subdued);
  text-align: center;
}

.stepper-item.active .stepper-label {
  color: var(--theme--primary);
  font-weight: 600;
}

/* Step Content */
.stepper-content {
  padding: 48px;
  min-height: 500px;
}

.step-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-card {
  background: var(--theme--background);
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.panel-card h2 {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  color: var(--theme--foreground);
}

.step-description {
  color: var(--theme--foreground-subdued);
  margin-bottom: 24px;
  line-height: 1.5;
}

/* Compact Step 3 */
.step-panel:nth-child(3) .panel-card h2 {
  font-size: 1.25rem;
  margin-bottom: 6px;
}

.step-panel:nth-child(3) .step-description {
  font-size: 0.875rem;
  margin-bottom: 12px;
}

.step-panel:nth-child(3) .checkbox-container {
  margin: 8px 0;
}

.step-panel:nth-child(3) .checkbox-label {
  font-size: 0.8125rem;
}

.step-panel:nth-child(3) .checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

/* Drag & Drop Zone */
.dropzone {
  border: 2px dashed var(--theme--border-color);
  border-radius: 8px;
  padding: 48px;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
  background: var(--theme--background-subdued);
  margin: 24px 0;
}

.dropzone.dragover {
  border-color: var(--theme--primary);
  background: var(--theme--primary-background);
  transform: scale(1.02);
}

.dropzone.has-file {
  border-style: solid;
  border-color: var(--theme--primary);
  background: var(--theme--background);
  cursor: default;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.dropzone-icon {
  font-size: 4rem;
  opacity: 0.5;
}

.dropzone-text {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--theme--foreground);
  margin: 0;
}

.dropzone-subtext {
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
  margin: 0;
}

.file-selected {
  display: flex;
  align-items: center;
  gap: 16px;
}

.file-icon {
  font-size: 3rem;
}

.file-info {
  flex: 1;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-info strong {
  font-size: 1rem;
  color: var(--theme--foreground);
}

.file-size,
.file-rows {
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
}

/* Checkbox */
.checkbox-container {
  margin: 16px 0;
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

/* Mapping Table */
.mapping-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 0;
}

.mapping-row {
  display: grid;
  grid-template-columns: 80px 160px 1.5fr 160px 160px;
  gap: 10px;
  align-items: start;
  padding: 8px;
  background: var(--theme--background-subdued);
  border-radius: 4px;
  font-size: 0.8125rem;
}

.mapping-row.header {
  font-weight: 600;
  font-size: 0.75rem;
  background: transparent;
  border-bottom: 2px solid var(--theme--border-color);
  padding-bottom: 8px;
}

.col-source strong {
  font-size: 0.75rem;
  font-weight: 600;
}

.example-preview {
  font-family: var(--theme--fonts--monospace);
  font-size: 0.6875rem;
  color: var(--theme--foreground-subdued);
  padding: 6px;
  background: var(--theme--background);
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 80px;
  overflow-y: auto;
}

.example-item {
  padding: 2px 0;
  border-bottom: 1px solid var(--theme--border-color-subdued);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.example-item:last-child {
  border-bottom: none;
}

.date-format-select {
  margin-top: 6px;
}

/* Compact inputs and selects in mapping table */
.mapping-row .v-select,
.mapping-row .v-input {
  font-size: 0.8125rem;
}

.mapping-row .v-select :deep(.v-field__input) {
  min-height: 32px;
  padding: 4px 8px;
  font-size: 0.8125rem;
}

.mapping-row .v-select :deep(.v-field) {
  font-size: 0.8125rem;
}

.mapping-row :deep(.v-field__input) {
  min-height: 32px;
  padding: 4px 8px;
  font-size: 0.8125rem;
}

/* Saved Configurations */
.saved-configs {
  margin: 24px 0;
  padding: 20px;
  background: var(--theme--background-subdued);
  border-radius: 6px;
}

.saved-configs h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: var(--theme--foreground);
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--theme--background);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.config-item:hover {
  background: var(--theme--primary-background);
  transform: translateX(4px);
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-date {
  font-size: 0.75rem;
  color: var(--theme--foreground-subdued);
}

.save-config-section {
  margin: 16px 0;
  padding: 12px;
  background: var(--theme--background-subdued);
  border-radius: 6px;
}

.save-config-section h3 {
  margin: 0 0 8px 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.save-config-input {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.save-config-input > *:first-child {
  flex: 1;
}

/* Compact save config in Step 3 */
.step-panel:nth-child(3) .save-config-section {
  padding: 10px;
  margin: 12px 0;
}

.step-panel:nth-child(3) .save-config-section h3 {
  font-size: 0.8125rem;
  margin-bottom: 6px;
}

.step-panel:nth-child(3) .save-config-input :deep(.v-input),
.step-panel:nth-child(3) .save-config-input :deep(.v-button) {
  font-size: 0.8125rem;
}

.step-panel:nth-child(3) .save-config-input :deep(.v-field__input) {
  min-height: 32px;
  padding: 4px 8px;
  font-size: 0.8125rem;
}

/* Validation */
.validation-loading {
  text-align: center;
  padding: 48px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--theme--border-color);
  border-top-color: var(--theme--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.validation-results {
  margin: 24px 0;
}

.validation-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  padding: 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.summary-card.success {
  background: var(--theme--success-background, #e0ffe0);
  border-left: 4px solid var(--theme--success, #067d06);
}

.summary-card.warning {
  background: var(--theme--warning-background, #fffbe6);
  border-left: 4px solid var(--theme--warning, #f57c00);
}

.summary-card.error {
  background: var(--theme--danger-background, #ffe0e0);
  border-left: 4px solid var(--theme--danger, #d32f2f);
}

.summary-icon {
  font-size: 2rem;
}

.summary-content h3 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.summary-content p {
  margin: 4px 0 0 0;
  font-size: 0.875rem;
  opacity: 0.8;
}

.validation-issues {
  background: var(--theme--background-subdued);
  padding: 20px;
  border-radius: 6px;
}

.validation-issues h3 {
  margin: 0 0 16px 0;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--theme--background);
  border-radius: 4px;
  border-left: 3px solid var(--theme--border-color);
}

.issue-item.error {
  border-left-color: var(--theme--danger, #d32f2f);
}

.issue-item.warning {
  border-left-color: var(--theme--warning, #f57c00);
}

.issue-icon {
  font-size: 1.125rem;
}

.issue-content strong {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 4px;
}

.issue-content p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
}

.more-issues {
  margin-top: 12px;
  text-align: center;
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
}

.key-field-section {
  margin-top: 24px;
  padding: 20px;
  background: var(--theme--background-subdued);
  border-radius: 6px;
}

.key-field-section h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
}

/* Import Summary */
.import-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin: 24px 0;
}

.summary-section {
  padding: 20px;
  background: var(--theme--background-subdued);
  border-radius: 6px;
}

.summary-section h3 {
  margin: 0 0 16px 0;
  font-size: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--theme--border-color);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  font-weight: 500;
  color: var(--theme--foreground-subdued);
}

.detail-row .value {
  font-weight: 600;
  color: var(--theme--foreground);
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--theme--primary);
  color: white;
}

.validation-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.validation-badges .badge {
  padding: 6px 12px;
}

.validation-badges .badge.success {
  background: var(--theme--success, #067d06);
}

.validation-badges .badge.warning {
  background: var(--theme--warning, #f57c00);
}

.validation-badges .badge.error {
  background: var(--theme--danger, #d32f2f);
}

/* Progress */
.import-progress {
  margin: 24px 0;
  padding: 24px;
  background: var(--theme--background-subdued);
  border-radius: 6px;
}

.progress-bar {
  height: 8px;
  background: var(--theme--border-color);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: var(--theme--primary);
  transition: width 0.3s ease;
  background: linear-gradient(90deg, var(--theme--primary), var(--theme--primary-accent));
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
}

.progress-speed {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--theme--foreground-subdued);
}

/* Import Results */
.import-results {
  margin: 24px 0;
}

.results-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin: 24px 0;
}

.result-stat {
  padding: 20px;
  border-radius: 6px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.result-stat.success {
  background: var(--theme--success-background, #e0ffe0);
}

.result-stat.info {
  background: var(--theme--primary-background, #e3f2fd);
}

.result-stat.error {
  background: var(--theme--danger-background, #ffe0e0);
}

.stat-number {
  display: block;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.stat-label {
  display: block;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
}

/* Batch Processing Info */
.batch-info {
  background: var(--theme--background-subdued, #f5f5f5);
  border-left: 4px solid var(--theme--primary, #6644ff);
  padding: 12px 16px;
  border-radius: 6px;
  margin: 16px 0;
}

.batch-info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.9375rem;
}

.batch-icon {
  font-size: 1.25rem;
}

.batch-info-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
}

.batch-size-info {
  font-size: 0.8125rem;
  opacity: 0.8;
}

/* Error Display */
.failed-details {
  margin-top: 24px;
  padding: 20px;
  background: var(--theme--background-subdued);
  border-radius: 6px;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.error-section {
  margin-top: 16px;
}

.error-section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 12px;
}

.error-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--theme--background);
  border-radius: 4px;
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
}

.error-content {
  flex: 1;
}

.error-content strong {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 4px;
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
}

/* Alerts */
.alert {
  padding: 16px 20px;
  border-radius: 6px;
  margin: 16px 0;
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

/* Step Actions */
.step-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--theme--border-color);
}

.import-button {
  background: linear-gradient(135deg, var(--theme--primary), var(--theme--primary-accent));
}

.template-actions {
  margin-bottom: 24px;
}

.info-text {
  font-size: 0.875rem;
  color: var(--theme--foreground-subdued);
  margin-top: 8px;
}

/* Responsive */
@media (max-width: 1024px) {
  .stepper-header {
    padding: 24px;
  }

  .stepper-content {
    padding: 24px;
  }

  .panel-card {
    padding: 20px;
  }

  .mapping-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .mapping-row.header {
    display: none;
  }

  .import-summary {
    grid-template-columns: 1fr;
  }

  .validation-summary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .stepper-label {
    display: none;
  }

  .stepper-item:not(:last-child)::after {
    display: none;
  }
}
</style>
