export const backendMessages = {
  // IA translation for English
  'en-US': {
    missingFile: 'Missing Excel file.',
    missingCollection: 'Missing target collection.',
    missingMapping: 'Missing mapping.',
    emptyFile: 'Empty Excel file.',
    noValidItems: 'No valid items to import. Check your mapping.',
    missingKeyForUpsert: 'An item is missing the required key field "{keyField}" for upsert.',
    internalError: 'Internal error during Excel import: {error}',
    processedItemsPrefix: 'items processed:',
    created: 'created',
    updated: 'updated',
    failed: 'errors',
    none: 'no changes'
  },
  // Original French translations
  'fr-FR': {
    missingFile: 'Fichier Excel manquant.',
    missingCollection: 'Collection cible manquante.',
    missingMapping: 'Mapping manquant.',
    emptyFile: 'Fichier Excel vide.',
    noValidItems: 'Aucun élément valide à importer. Vérifiez le mapping.',
    missingKeyForUpsert: 'Un élément ne contient pas la clé "{keyField}" requise pour l’upsert.',
    internalError: 'Erreur interne lors de l’import Excel : {error}',
    processedItemsPrefix: 'éléments traités :',
    created: 'créés',
    updated: 'mis à jour',
    failed: 'erreurs',
    none: 'aucun changement'
  },
  // Spanish translations
  'es-ES': {
    missingFile: 'Falta el archivo Excel.',
    missingCollection: 'Falta la colección de destino.',
    missingMapping: 'Falta el mapeo.',
    emptyFile: 'El archivo Excel está vacío.',
    noValidItems: 'No hay elementos válidos para importar. Verifique el mapeo.',
    missingKeyForUpsert: 'Un elemento no contiene el campo clave "{keyField}" requerido para la actualización.',
    internalError: 'Error interno durante la importación de Excel: {error}',
    processedItemsPrefix: 'elementos procesados:',
    created: 'creados',
    updated: 'actualizados',
    failed: 'errores',
    none: 'sin cambios'
  },
  // Turkish translations
  'tr-TR': {
    missingFile: 'Excel dosyası eksik.',
    missingCollection: 'Hedef koleksiyon eksik.',
    missingMapping: 'Eşleştirme eksik.',
    emptyFile: 'Excel dosyası boş.',
    noValidItems: 'İçe aktarılacak geçerli öğe yok. Eşleştirmeyi kontrol edin.',
    missingKeyForUpsert: 'Bir öğede upsert için gereken "{keyField}" anahtar alanı eksik.',
    internalError: 'Excel içe aktarımı sırasında dahili hata: {error}',
    processedItemsPrefix: 'işlenen öğeler:',
    created: 'oluşturuldu',
    updated: 'güncellendi',
    failed: 'hatalar',
    none: 'değişiklik yok'
  }
};

// Spanish variants - all point to es-ES translations
const spanishBackendTranslations = backendMessages['es-ES'];
backendMessages['es-MX'] = spanishBackendTranslations; // Mexico
backendMessages['es-AR'] = spanishBackendTranslations; // Argentina
backendMessages['es-CO'] = spanishBackendTranslations; // Colombia
backendMessages['es-CL'] = spanishBackendTranslations; // Chile
backendMessages['es-PE'] = spanishBackendTranslations; // Peru
backendMessages['es-VE'] = spanishBackendTranslations; // Venezuela
backendMessages['es-EC'] = spanishBackendTranslations; // Ecuador
backendMessages['es-GT'] = spanishBackendTranslations; // Guatemala
backendMessages['es-CU'] = spanishBackendTranslations; // Cuba
backendMessages['es-BO'] = spanishBackendTranslations; // Bolivia
backendMessages['es-DO'] = spanishBackendTranslations; // Dominican Republic
backendMessages['es-HN'] = spanishBackendTranslations; // Honduras
backendMessages['es-PY'] = spanishBackendTranslations; // Paraguay
backendMessages['es-SV'] = spanishBackendTranslations; // El Salvador
backendMessages['es-NI'] = spanishBackendTranslations; // Nicaragua
backendMessages['es-CR'] = spanishBackendTranslations; // Costa Rica
backendMessages['es-PA'] = spanishBackendTranslations; // Panama
backendMessages['es-UY'] = spanishBackendTranslations; // Uruguay
backendMessages['es-PR'] = spanishBackendTranslations; // Puerto Rico
backendMessages['es'] = spanishBackendTranslations; // Generic Spanish
