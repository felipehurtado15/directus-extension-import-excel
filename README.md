# Directus Extension: Import Excel

📥 A Directus custom **bundle** (module + endpoint) to import `.xlsx` Excel files **without headers** and manually map them to a collection's fields.

## 🚀 Features

- Upload `.xlsx` files via a custom UI
- Manual mapping of file columns to Directus collection fields
- Support for **multiple collections**
- **Optional upsert**: update items using a unique key (works only with fields marked as `unique` in Directus)
- **Field mapping redesigned**: vertical layout inspired by [NocoDB's import system](https://nocodb.com/docs/product-docs/tables/import-data-into-existing-table#field-mapping)
- **Clear and detailed feedback**:
- **Loading indicator** during import to show progress
- Interface and API fully **translated** (English, French & Turkish)
- Codebase fully rewritten in **English** for easier contributions

## 📸 Screenshots

![Import Excel Extension](https://github.com/FazCodeFR/directus-extension-import-excel/raw/main/Screenshot.jpg)

## 📦 Installation

### ✅ Recommended (via Marketplace)

Install directly from the **Directus Marketplace**

Search for "Import Excel" or "Fazcode" in the Marketplace of your app settings, navigate to the extension page, and click "Install Extension"

Don't forget to go to **Settings** > **Project Settings** > **Modules bars** > activate the "Import Excel" module to display it in the side menu.


### 🛠 Manual Installation

1. Clone the repository into your Directus `extensions` folder:

```bash
git clone https://github.com/FazCodeFR/directus-extension-import-excel.git
cd directus-extension-import-excel
npm install
npm run build
```
2. Restart your Directus instance to load the new extension.
3. Navigate to the Directus admin panel and find the **"Import Excel"** module in the side menu.

## 🧪 Usage

1. Go to the **"Import Excel"** module in the Directus admin panel.
2. Upload your `.xlsx` file.
3. Map the columns from your Excel file to the fields in your Directus collection.
4. Optionally select a **unique field** to enable upsert (update if existing).
5. Click **"Import"** to start the process.
6. Get **detailed feedback** on the result of the import.

## 🤝 Contributing

Contributions are welcome!  
If you find a bug or have a feature request, please open an issue or submit a pull request on the GitHub repository.

## 🧾 License

This project is licensed under the MIT License.

## ✅ Compatibility

Tested with **Directus v11.8.0**

