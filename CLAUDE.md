# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Directus extension bundle** that enables importing Excel files (.xlsx) without headers into Directus collections with manual field mapping. The extension consists of two parts:
- **UI Module** (`import-excel-ui`): Vue 3 frontend interface for file upload and field mapping
- **API Endpoint** (`import-excel-api`): Backend endpoint for processing Excel files and importing data

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
   - `keyField`: Optional unique field for upsert
   - `firstRowIsHeader`: Boolean flag
6. Backend processes each row:
   - Skips header row if flagged
   - Transforms dates based on format mappings
   - For upsert mode: queries existing items by key field and updates/creates accordingly
   - For insert mode: creates all new items
   - Collects errors with row numbers
7. Backend returns success/error summary with detailed row-level errors

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
