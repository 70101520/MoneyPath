# Reviewed workbook import

The owner workbook can be imported into an existing test installation with `scripts/import-workbook.ts`. The importer reads a private JSON review file and does not contain personal amounts in source control.

Run it only after a database backup and migration:

```powershell
$env:CONFIRM_PERSONAL_IMPORT = 'yes'
npx tsx scripts/import-workbook.ts .tools/workbook-import.json
```

The command refuses to run unless the confirmation variable is present and exactly one owner exists. Stable request identifiers and record keys make a repeated run idempotent.

Imported salary history can be marked as an opening snapshot. This preserves the recorded account balance instead of crediting salary a second time. Incomplete card statements, limits, due dates, or interest rates stay visible as **Needs review** and block confident guidance until corrected. Unknown EMI principal and interest splits are not guessed.

The reviewed file is private test data. It must stay under `.tools/` or another ignored path and must never become a production seed. A fresh production installation starts with an empty financial database.

The portal provides Edit actions for bank accounts, income, expenses, credit cards, commitments, and goals. Account, income, and expense corrections update affected balances in one database transaction and create an audit record. Card review notes are encrypted.
