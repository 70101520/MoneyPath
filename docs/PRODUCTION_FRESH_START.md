# Fresh production deployment

The VMware installation at `192.168.80.128` is a test environment. Its database, `.env`, encryption key, setup token, uploaded spreadsheets and backups are not production seed data.

Deploy production on a new host from the Git repository and create a new `.env` from `.env.example`. Generate independent production values for the database password, encryption key, setup token, notification secret and VAPID keys. Configure an HTTPS origin and keep `ALLOW_INSECURE_COOKIE=false`.

Start Compose on the new host without copying the test VM's PostgreSQL volume or database dump:

```sh
docker compose -p moneypath-production up --build -d
```

This creates a fresh production volume, applies the schema migrations and opens first-owner registration. Create the production owner with the new setup token, then enter current balances and financial records through the normal MoneyPath forms or confirmed Finance Assistant entries.

Do not run the sample seed command in production. Do not import the reviewed personal spreadsheet automatically. It is a manual reference only; each real opening balance, card statement, due date and obligation should be reviewed when entered through the GUI.

Before launch, verify HTTPS, backups, restore procedure, SMTP/Web Push configuration, host firewall and restricted `.env` permissions. Preserve the production encryption key separately with encrypted backups.
