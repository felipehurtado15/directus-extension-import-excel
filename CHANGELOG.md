# 📦 Changelog

## [1.1.0] - 2025-07-14

### ✨ Added
- New optional **upsert by unique key** feature (`update by key`) — works only with fields marked as `unique` in Directus.
- Full **internationalization** support:
  - Added **French** 🇫🇷, **English** EN and **Turkish** 🇹🇷 translations.
- **Loading indicator** on the "Import" button to show progress.
- **Emojis** added to step titles for a more user-friendly UI.

### 🔧 Changed
- Extension renamed from `custom` to `import-excel`.
- Switched from a **module** to a **bundle** (module + endpoint) to enable backend logic (like upsert) and better API handling.
- Codebase fully rewritten in **English** for easier contributions.
- UI improvements: better margins, layout enhancements.
- **Field mapping interface redesigned**: moved from a **horizontal table layout** to a **vertical layout**, for better clarity and usability — inspired by [NocoDB's import system](https://nocodb.com/docs/product-docs/tables/import-data-into-existing-table#field-mapping).


### 🧠 Improved
- Fields already mapped are now **removed from the dropdown**, making the mapping process quicker and clearer.
- Field list is now **sorted alphabetically** for easier navigation.
- Added **clear and detailed messages** on import success or failure (both UI and API).

### 🙏 Special Thanks
- @JayShoe for helpful early feedback.
- @asukakimya for the fork and improvements that inspired parts of this update.

---

Made with ❤️ by [Léo Airaudi aka Fazcode ]
