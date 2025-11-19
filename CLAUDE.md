# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Directus extension bundle** that provides a comprehensive Excel import solution with an advanced guided workflow. The extension enables importing Excel files (.xlsx) into Directus collections with intelligent field mapping, data validation, transformations, and detailed error reporting.

**Key Components:**
- **UI Module** (`import-excel-ui`): Vue 3 frontend with stepper/wizard interface
- **API Endpoint** (`import-excel-api`): Backend endpoint for processing and importing data

**Major Features:**
- 5-step guided wizard workflow
- Drag & drop file upload
- Export Excel templates
- Save/load mapping configurations
- Pre-import data validation
- Data transformations (trim, case conversion)
- Real-time import progress tracking
- Permission-based collection filtering
- Comprehensive error categorization and reporting
- Batch processing for large files (prevents timeouts)

## Build Commands

```bash
# Development build with watch mode (no minification)
npm run dev

# Production build
npm run build

# Validate extension
npm run validate

# Link extension to Directus instance
npm run link
```

## Development Setup

### Hot-Reloading Configuration

The `vite.config.js` contains settings for hot-reloading during development:
- Update `HOST_URL` to match your Directus instance URL (default: `http://127.0.0.1:8055`)
- Set `LOAD_IN_HOST` to `true` to load dependencies from the host Directus instance
- Update `HOST_DEPS` mappings if your Directus version differs from 11.5.0

To generate new `HOST_DEPS` mappings:
```bash
node node_modules/directus-extension-dev-canvas/host-deps.js
```

## Architecture

### Bundle Structure

The extension is defined as a **bundle** in `package.json` with two entries:
1. **Module**: `import-excel-ui` - Vue component for the UI
2. **Endpoint**: `import-excel-api` - Express route handler for file processing

### Key Components

#### Frontend (src/import-excel-ui/)
- `index.js`: Module registration with Directus
- `module.vue`: Main Vue component with:
  - Collection selection from available Directus collections
  - File upload with Excel preview (first 5 rows)
  - Column-to-field mapping interface with vertical layout
  - Data type selection (text/date) per column
  - Date format transformation support (dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, Excel serial)
  - Optional "first row is header" checkbox with auto-field matching
  - Optional key field selection for upsert functionality
  - Real-time feedback with error details per row

#### Backend (src/import-excel-api/)
- `index.js`: Express endpoint `/import-excel-api` that:
  - Accepts multipart form data with Excel file
  - Parses Excel using `xlsx` library
  - Supports INSERT mode (create only) and UPSERT mode (create or update based on key field)
  - Transforms dates based on provided format mappings
  - Handles header rows (skip first row if `firstRowIsHeader=true`)
  - Returns detailed results with created/updated/failed counts
  - Tracks Excel row numbers for error reporting

#### Shared Code (src/shared/)
- `i18nModule.js`: Frontend translations (en-US, fr-FR, tr-TR)
- `i18nApi.js`: Backend translations for error messages

### Data Flow

1. User uploads Excel file in frontend
2. Frontend parses file using XLSX.js to show preview
3. User maps Excel columns to Directus collection fields
4. User selects data types and date formats per column
5. On import, frontend sends FormData with:
   - `file`: Excel file buffer
   - `collection`: Target collection name
   - `mapping`: JSON object mapping column indices to field names
   - `fieldTypes`: JSON object mapping column indices to data types
   - `dateFormats`: JSON object mapping column indices to date formats
   - `transformations`: JSON object mapping column indices to transformation arrays
   - `keyField`: Optional unique field for upsert
   - `firstRowIsHeader`: Boolean flag
   - `batchSize`: Number of items per batch (default: 100)
6. Backend processes items in batches:
   - Divides items into batches using configurable batch size
   - Processes each batch sequentially
   - Skips header row if flagged
   - Transforms dates based on format mappings
   - Applies data transformations (trim, case conversion)
   - For upsert mode: queries existing items by key field (per batch) and updates/creates accordingly
   - For insert mode: creates all new items (per batch)
   - Collects errors with row numbers
   - Logs progress per batch
7. Backend returns success/error summary with detailed row-level errors and batch metadata

### Date Transformation

Both frontend and backend implement identical `transformDate()` functions supporting:
- **Excel serial dates**: Numeric values converted from Excel epoch (1899-12-30)
- **Text formats**: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd
- All dates normalized to ISO format (yyyy-mm-dd) for Directus

### Upsert Functionality

When a `keyField` is provided:
- Backend queries for existing items matching key values
- Updates existing items, creates new ones
- Key field must be marked as `unique` in Directus schema
- Tracks which rows were created vs updated in results

### Internationalization

The extension supports three languages with complete UI and API translations:
- English (en-US)
- French (fr-FR)
- Turkish (tr-TR)

Language selection is automatic based on:
- Frontend: Directus project's `default_language` setting
- Backend: `Accept-Language` header from request

## Important Implementation Notes

### Error Handling
- Row numbers reported to users are 1-indexed Excel row numbers
- When `firstRowIsHeader=true`, data row processing starts from row 2
- Error details include field name, validation type, error code, and field value
- Errors don't stop the import - all rows are processed and results aggregated

### Field Mapping
- Frontend prevents duplicate field mappings using `getAvailableFields()`
- When "first row is header" is enabled, auto-matching attempts to match headers to field names/labels
- Empty cells are filtered out before import (converted to empty strings and skipped)
- Items must have at least one field besides `__rowIndex` to be valid

### Data Processing
- Frontend shows preview of first 5 rows but stores all rows in `allRowsData`
- Backend processes all data rows (excluding header if flagged)
- Column examples shown in mapping UI skip header row when enabled
- All values are trimmed and converted to strings before import

### Security and Permissions
- Uses Directus `ItemsService` with user's accountability context
- Respects Directus permissions and field access rules
- File upload handled via `multer` with memory storage
- **Collection Filtering**: Frontend filters collections to show only those where the user has create permissions using `permissionsStore.hasPermission(collection, 'create')`
- **Permission Error Handling**: Both frontend and backend provide detailed error messages when users lack permissions
- Permission errors are displayed separately from validation errors in the UI with distinct visual styling

### Error Handling Improvements
The extension provides comprehensive error reporting with the following features:

#### Backend Error Processing
- **Error Categorization**: Distinguishes between permission errors, validation errors, and other error types
- **Descriptive Messages**: Maps error codes to human-readable descriptions in Spanish:
  - `FORBIDDEN`: "No tiene permisos para esta operación"
  - `RECORD_NOT_UNIQUE`: "El valor ya existe (debe ser único)"
  - `VALUE_TOO_LONG`: "El valor es demasiado largo"
  - `INVALID_PAYLOAD`: "Datos inválidos o mal formateados"
  - `FAILED_VALIDATION`: "Error de validación"
  - `FIELD_INVALID`: "Campo inválido o no permitido"
  - `CONTAINS_NULL_VALUES`: "El campo no puede estar vacío (requerido)"
  - `VALUE_OUT_OF_RANGE`: "El valor está fuera del rango permitido"
- **Field-Level Details**: Error messages include field name, error type, error code, and the value that caused the error
- **Row Tracking**: Each error is linked to its Excel row number for easy identification

#### Frontend Error Display
- **Categorized Error Sections**: Errors are split into two categories with visual distinction:
  - **Permission Errors** (🔒): Red accent, shown first, indicate access/permission issues
  - **Validation Errors** (⚠️): Orange accent, show data validation problems
- **Error Details**: Each error displays:
  - Row number and key value (if using upsert mode)
  - Detailed error message explaining the issue
  - Error code badge for technical reference
- **No Collections Warning**: When user has no create permissions on any collection, a prominent warning is displayed
- **Copy Functionality**: Errors can be copied to clipboard for sharing or reporting

### UI/UX Features
- Collections dropdown is disabled when no collections with create permissions are available
- Error sections show count of errors per category
- Visual hierarchy helps users quickly identify and address different types of issues

## 🎨 Enhanced Workflow - 5-Step Wizard

The extension uses a modern stepper/wizard interface to guide users through the import process:

### Step 1: Select Collection
- Filter and display only collections where user has create permissions
- Load previously saved mapping configurations
- Delete unused configurations
- Visual indicators for saved configs with creation date

**Files**: `module-enhanced.vue:step1`

### Step 2: Upload File
- **Drag & Drop Zone**: Visual feedback with hover effects
- **Export Template**: Download pre-configured Excel template with:
  - Column headers matching field labels
  - Field types in second row
  - Required/Optional indicators in third row
- **File Information Display**: Shows filename, size, and row count
- **First Row Header Toggle**: Auto-match headers to fields when enabled

**Files**: `module-enhanced.vue:step2`, `import-excel-api/index.js:exportTemplate`

### Step 3: Map Fields
- **Column Mapping Table**: Grid layout with:
  - Source column number
  - Example data preview (up to 3 samples)
  - Target field dropdown (prevents duplicates)
  - Data type selector (text, number, date, email, URL)
  - Date format selector (appears for date type)
  - Transformations multi-select
- **Save Configuration**: Save current mapping for reuse
- **Configuration Management**: Load/delete saved mappings

**Supported Transformations:**
- `trim`: Remove leading/trailing spaces
- `uppercase`: Convert to UPPERCASE
- `lowercase`: Convert to lowercase
- `capitalize`: Capitalize First Letter

**Files**: `module-enhanced.vue:step3`, `import-excel-api/index.js:applyTransformations`

### Step 4: Validate Data
- **Pre-Import Validation**: Analyze data before import
- **Validation Summary Cards**: Visual stats for valid/warning/error counts
- **Issue List**: Detailed list of potential problems:
  - Required field validation
  - Data type validation (numbers, emails)
  - Shows first 50 issues with option to see more
- **Optional Key Field**: Select unique field for upsert mode
- **Validation Results**: Categorized as errors (blocking) or warnings (non-blocking)

**Validation Rules:**
- Required fields must have values
- Number fields should contain numeric values
- Email fields should contain @ symbol
- Date fields should match selected format

**Files**: `module-enhanced.vue:runValidation`

### Step 5: Confirm & Import
- **Import Summary**: Review before executing:
  - Collection name
  - File name
  - Total rows to process
  - Number of mapped fields
  - Operation type (Create Only vs Create or Update)
  - Validation summary
- **Real-Time Progress**:
  - Animated progress bar (0-100%)
  - Rows processed counter
  - Import speed (rows/second)
  - Estimated time remaining
- **Import Results**: Categorized display:
  - Created count
  - Updated count
  - Failed count with detailed error breakdown
- **Error Categorization**: Separate sections for:
  - Permission errors (red accent)
  - Validation errors (orange accent)
- **Copy Errors**: One-click copy all errors to clipboard

**Files**: `module-enhanced.vue:startImport`, `module-enhanced.vue:step5`

## 💾 Configuration Management

### Saved Configurations (LocalStorage)
- Configurations stored in browser localStorage
- Each config includes:
  - Name (user-defined)
  - Collection
  - Field mappings
  - Data types
  - Date formats
  - Transformations
  - Creation timestamp
- Filter configurations by collection
- Load configuration with one click
- Delete unwanted configurations

**Storage Key**: `import-excel-configs`
**Files**: `module-enhanced.vue:saveConfiguration`, `module-enhanced.vue:loadConfiguration`

## 🔧 Data Transformations

### Frontend (UI)
Users select transformations via multi-select dropdown for each column. Transformations are sent to backend as JSON object mapping column indices to transformation arrays.

### Backend (API)
The `applyTransformations()` function processes values in order:
1. trim → removes spaces
2. uppercase → converts to UPPERCASE
3. lowercase → converts to lowercase
4. capitalize → Capitalizes First Letter

Transformations are logged for debugging: `Transformación aplicada en fila X, columna Y: "original" → "transformed" [trim, uppercase]`

**Files**: `import-excel-api/index.js:145-171`, `module-enhanced.vue:transformations`

## 📦 Batch Processing for Large Files

To prevent timeouts and memory issues when importing large Excel files, the extension implements batch processing:

### How It Works
- **Configurable Batch Size**: Default is 100 items per batch (configurable via frontend)
- **Sequential Processing**: Items are divided into batches and processed sequentially
- **Memory Optimization**: Only one batch is loaded into memory at a time
- **Timeout Prevention**: Processing smaller batches prevents server timeouts on large imports

### Backend Implementation
The `chunkArray()` function divides the items array into chunks:
```javascript
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
```

### Processing Flow
1. Frontend sends `batchSize` parameter (default: 100)
2. Backend divides items into batches using `chunkArray()`
3. Each batch is processed sequentially:
   - **UPSERT Mode**: Queries existing items for current batch only
   - **INSERT Mode**: Creates items from current batch
4. Progress is logged per batch: `📦 Lote X/Y: Procesando Z items`
5. Results include batch metadata in response

### Frontend Display
When batch processing is used (>100 items), the results show:
- Batch processing indicator with icon
- Total items processed
- Number of batches used
- Items per batch

### Benefits
- ✅ Handles files with thousands of rows without timeouts
- ✅ Reduced memory footprint
- ✅ Better progress tracking and logging
- ✅ Configurable batch size for different server capacities

**Files**:
- `import-excel-api/index.js:173-180` (chunkArray function)
- `import-excel-api/index.js:286-373` (batch processing logic)
- `module-enhanced.vue:582` (batchSize configuration)
- `module-enhanced.vue:457-466` (batch info display)

## 📊 Template Export

The export template feature generates an Excel file with:
- **Row 1**: Field labels (translated if available)
- **Row 2**: Field types (from Directus schema)
- **Row 3**: Required/Optional indicators

This helps users understand exactly what format to use for imports.

**Files**: `module-enhanced.vue:exportTemplate`

## 🎯 Validation System

### Client-Side Validation
- Real-time field mapping validation
- Step completion checks
- File type validation (.xlsx, .xls only)

### Pre-Import Validation
- Simulates import process
- Checks required fields
- Validates data types
- Detects potential issues
- Categorizes as errors or warnings
- Limits display to first 50 issues for performance

### Import-Time Validation
- Directus schema validation
- Permission checks
- Unique constraint validation
- Field type validation

**Files**: `module-enhanced.vue:runValidation`, `import-excel-api/index.js:handleItemError`
