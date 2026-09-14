# MoneyPath

A private personal-finance control centre built with Next.js 16.3.5, React 19, TypeScript, Tailwind CSS 4, PostgreSQL, Prisma 7 and Recharts. Phase 1 provides authentication and transaction accounting. Phase 2 adds budgets, spending analysis, salary allocation, payment priorities, purchase simulation, debt payoff scenarios, in-app reminders and versioned risk/history reports. Phase 3 adds personal balances, investments, goals, what-if scenarios and Excel export. Phase 4 adds a constrained finance assistant, read-only mobile API, reviewed bank-statement CSV import, scheduled SMTP email and Web Push delivery.

Read [the architecture, ER diagram, calculation rules and phased roadmap](docs/ARCHITECTURE.md) before extending the application. The executable database schema is [prisma/schema.prisma](prisma/schema.prisma).

Phases 1–4 are implemented. See [Phase 3 usage and calculation rules](docs/PHASE3.md) and [Phase 4 integrations and provider configuration](docs/PHASE4.md).

## Start with Docker

Install Docker with Compose. Copy `.env.example` to `.env`, then set:

- `POSTGRES_PASSWORD`: a unique random password (hex is convenient for the connection URL).
- `DATABASE_URL`: the local PostgreSQL URL using that password; Compose overrides its hostname internally.
- `ENCRYPTION_KEY`: 64 hex characters, generated independently.
- `SETUP_TOKEN`: a separate secret used once to register the owner.
- `APP_ORIGIN`: `http://localhost:3000` for local use. It must match the browser origin exactly.
- `ALLOW_INSECURE_COOKIE=true` for local HTTP only; use `false` with HTTPS.

Generate each secret separately:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
docker compose up --build -d
```

Open **http://localhost:3000**. Choose **First time here? Set up your account**, enter the setup token, and create a password of at least 12 characters. Registration closes after the owner exists. Add accounts and complete Settings to enable the finance calculations. There is no default password.

Compose waits for PostgreSQL, applies checked-in migrations, and starts the app as a non-root user. Both exposed ports default to localhost. `APP_BIND_ADDRESS` and `APP_PORT` configure the application listener; PostgreSQL stays on localhost with configurable `DB_PORT`. For production remote access, configure an HTTPS reverse proxy, update `APP_ORIGIN`, and disable insecure cookies. Keep `.env` and backups private. Losing the encryption key makes encrypted notes and card identifiers unrecoverable.

The testing VM is deployed at **http://192.168.80.128:3000**. See [deployment and maintenance instructions](docs/DEPLOYMENT.md).

## Local development

Node.js 24 and a UTF-8 PostgreSQL 17+ database are required. On Windows use `npm.cmd` / `npx.cmd` if PowerShell blocks the npm script shim.

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

The database URL and secrets are read from `.env`. Open http://localhost:3000. `/demo` is a read-only sample workspace that works without a database or sign-in. Its balances are illustrative, and sample data never merges into real records automatically.

For an optimized build:

```sh
npm run build
npm start
```

Next.js produces standalone output. `npm start` copies the static assets and serves that standalone build on localhost; the container runs `server.js` with the copied assets.

## Sample data

The sample salary of ₹55,000 and salary day 10 are editable settings, not calculation constants. Preview samples safely at `/demo` first. To load sample records into an **empty, newly registered** workspace:

```sh
# PowerShell
$env:SEED_SAMPLE_DATA='yes'
npm.cmd run db:seed
```

For a POSIX shell: `SEED_SAMPLE_DATA=yes npm run db:seed`. Seeding refuses a nonempty workspace. Sample accounts and cards are closing snapshots that already include the accompanying sample history; the seed intentionally does not replay that history against balances.

## How accounting works

- Enter opening account balances **before** any new transactions you plan to record. Card opening balances already include their historical purchases and payments. Do not enter that history again.
- Amounts are integer paise in storage and calculations. Forms accept INR with up to two decimals. Each input is capped at ₹1 crore; aggregate writes also remain bounded by PostgreSQL `Int` storage.
- Safe to spend excludes non-spendable accounts, expected income, credit limits and future receivables. Emergency and goal earmarks are deducted only from spendable accounts. Do not reserve the same money both in an excluded account and an earmark.
- Essential living is the **remaining** amount needed until salary. Review it after spending or when accepting a salary plan. Category budgets are tracking limits and do not reserve the same cash again.
- Long-cycle commitments reserve funded cash plus monthly catch-up. When a bill is due before the next salary, its full remaining payment replaces that accrual. Missed recurrences remain payable. Enter the first **unpaid** due date.
- A card purchase is an expense and increases posted card debt. A card payment lowers cash and debt and creates **no additional expense**. Statement and unbilled payment allocations are validated separately.
- Posted card outstanding excludes unbilled EMI principal. EMI entry normally records an existing unbilled schedule. Select **New financed purchase** to record a new purchase expense and unbilled EMI debt together (do not also enter a separate expense). Posting an installment transfers principal to posted debt and records only interest as a new expense. Use actual principal/interest from the issuer. Update the next installment components afterward; otherwise the dashboard says Information Required. Early EMI closure and conversion of an existing purchase into EMI are not supported in Phase 1.
- Card available limit is an optional issuer snapshot. Transactions invalidate it; enter the latest value with the next statement. Reconciliation explicitly shows pending holds or other unexplained differences. New statements archive the previous bill and carry unpaid amounts forward with their original due date. The new statement must include that carried amount. It remains reserved once, and later statement payments clear carried debt first. Record any issuer interest/fees as card expenses before rolling a statement that includes them; rollover itself never invents expenses or changes total debt.
- Commitment payments make one expense, except SIP/gold contributions, which transfer cash to a separate investment account. Partial payments preserve the occurrence; full payments advance it from the original due-day anchor.
- Monthly debt reduction = card payments minus recorded new card purchases and interest. Opening snapshots are not new transactions in that metric.
- Posted records are immutable in Phase 1. Settings, commitments and EMI schedules can be edited. Corrections/reversals of posted transactions and opening-balance reconciliation do not yet have a UI; check entries before saving.

Transactions use serializable isolation and unique idempotency keys. Every successful financial command stores an audit entry and versioned risk rules. Missing required inputs produce **Information Required**, and a cash shortfall is displayed separately from zero available money. The current risk engine considers recorded cards, commitments, private liabilities, budgets and available history. Expected receivables never increase safe-to-spend cash; untracked assets and liabilities are not inferred.

## Tests

```sh
npm test
npm run typecheck
npm run build
```

Pure tests cover safe-to-spend, reserves, statement/unbilled balances, payments, EMI, budget variance, debt reduction, risk, goal shortfalls, dates and security. Phase 2 tests also cover persisted budgets and spending comparisons; goal helpers remain foundations for a later phase.

The optional embedded PostgreSQL package is **test-only**. It starts a separate cluster on `127.0.0.1:55432`, stores data in `.local-db`, and creates private synthetic credentials in `.env.test.local`. It never uses the real `.env` database. On Linux, run the test database as a non-root user.

```sh
# Terminal 1: leave running
npx tsx scripts/test-db.ts

# Terminal 2: apply migrations to the isolated database
node --env-file=.env.test.local node_modules/prisma/build/index.js migrate deploy

# PowerShell: enable database tests
$env:RUN_DB_TESTS='1'
npm.cmd test

# Browser tests against an optimized build
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

POSIX shells can use `RUN_DB_TESTS=1 npm test`. Database tests create and remove only their own test user records. Browser tests retain their synthetic owner and records for inspection; the credentials in the browser test are exclusively for this isolated test database. Do not run those tests against personal data.

Browser checks cover desktop/mobile layout, all Phase 1 navigation, dialog entry, persistence after reload, local authentication, protected routes, CSRF origin rejection, CSV export and payment accounting. Screenshots are written to `artifacts/`. If the Playwright-managed server does not exit cleanly on Windows, start it in a separate terminal using `node --env-file=.env.test.local scripts/start.mjs 3100`; Playwright reuses it.

## Export, backup and restore

**Settings → Export transactions CSV** exports income, purchases and payments with distinct record types. **Export Excel workbook** adds summary, investment and goal sheets. Do not sum purchases and payments as expenses. Cells are escaped to prevent spreadsheet formula execution.

Create a database backup inside the database container, then copy it out. This avoids binary dump corruption from older PowerShell redirection:

```sh
docker compose exec db pg_dump -U moneypath -d moneypath -Fc -f /tmp/moneypath.dump
docker compose cp db:/tmp/moneypath.dump ./backups/moneypath.dump
```

Create `backups/` first. Keep timestamped copies and store the corresponding encryption key separately. Database dumps contain private financial information, even when notes are encrypted. Protect the backup storage with encryption and restricted access.

Restore into a **new database** first, preserving the original:

```sh
docker compose cp ./backups/moneypath.dump db:/tmp/restore.dump
docker compose exec db createdb -U moneypath moneypath_restored
docker compose exec db pg_restore -U moneypath -d moneypath_restored --no-owner --exit-on-error /tmp/restore.dump
```

Verify record counts and application balances against the backup using its matching encryption key before changing the app's database URL to `moneypath_restored`. The Compose URL currently names `moneypath`; change the database path for both `app` and `migrate`, then recreate those services. Never restore an untrusted dump into a privileged database. This operator workflow is not an automatic recovery service.

## Phase 1 validation and limits

Build, unit/integration tests and Chromium desktop/mobile checks are recorded in [VALIDATION.md](docs/VALIDATION.md). Docker build, Compose startup, container smoke tests and database restore passed on the Ubuntu testing VM. Authentication has no email reset/MFA workflow yet; keep owner credentials secure.

### Repeatable deployment checks

The GitHub Actions workflow in `.github/workflows/phase1.yml` builds a disposable Docker Compose stack and runs authentication, accounting, encryption, idempotency, origin-validation and logout checks. It also checks that the runtime is non-root and runs the finance/security tests in the build image. The workflow runs on push, pull request, or manual dispatch. Equivalent container checks passed on the testing VM; a GitHub-hosted workflow result has not been confirmed.

Backup/restore has been verified locally using portable PostgreSQL client tools. To repeat it with the isolated test database running:

```powershell
$env:PG_BIN_DIR=(Resolve-Path '.tools/postgresql/pgsql/bin').Path
node scripts/check-backup.mjs
```

On another machine, point `PG_BIN_DIR` to its PostgreSQL client-tools directory instead (or keep `pg_dump` and `pg_restore` on PATH). The tool checks every table's contents against a consistent snapshot, decrypts restored private fields, and checks a monetary balance and database constraint. It writes `artifacts/backup-verification.json`, retaining the dump and newly restored test database. It does not touch the real `.env` database.

Design references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7). Stable package versions were resolved from npm; Prisma's prerelease `latest` tag was deliberately not selected.
