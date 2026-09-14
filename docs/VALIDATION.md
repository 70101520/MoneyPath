# Phase 1 validation

Application validation ran on 13-09-2026 using Node.js 24.19.0 on Windows, Next.js 16.3.5, Prisma 7.10.0, an isolated UTF-8 PostgreSQL 18.4 test cluster, and Playwright Chromium. On 14-09-2026, all 29 finance/security/database tests passed again, and the backup/restore check passed using PostgreSQL 18.6 client tools.

| Check                                               | Result                                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Optimized Next.js standalone build                  | Passed                                                                                                   |
| Strict TypeScript checks                            | Passed                                                                                                   |
| Finance, security and PostgreSQL tests              | 29 passed                                                                                                |
| Chromium browser tests                              | 4 passed                                                                                                 |
| Dependency audit after patched transitive overrides | 0 known vulnerabilities                                                                                  |
| Desktop screenshot at 1440px                        | Reviewed                                                                                                 |
| Mobile screenshot at 390px                          | Reviewed; no page overflow                                                                               |
| Checked-in PostgreSQL migrations                    | All three applied successfully                                                                           |
| Docker image build and Compose startup              | Not run: Docker is not installed on this host                                                            |
| Database dump/restore round trip                    | Passed: all 14 tables matched; encrypted fields, monetary fixture and restored CHECK constraint verified |
| Container smoke-test script against standalone app  | Passed on 14-09-2026 with a fresh isolated database; actual Docker image run remains pending             |

The accounting tests cover integer-paise reservations, shortfalls, missing information, recurring reserves, old statements versus unbilled charges, duplicate submissions, concurrent overspending, expected/received income, investment transfers, EMI principal/interest accounting, new financed purchases, overdue EMI recurrences, statement carry-forward, database balance constraints, budget variance, debt reduction, goal shortfall, deterministic risk and month-end date handling. A statement rollover archives its previous bill and preserves the carried balance's earlier due date without adding debt or expenses.

Security tests exercise password verification, salted hashing, authenticated encryption, origin validation and ownership rejection. Browser tests exercise sign-in/sign-out, protected routes, account creation through the real form, persistence after reload, card payments, CSV export, all Phase 1 navigation, narrow-screen navigation, and the expense dialog. They run against the standalone server used by the container, with synthetic test data only.

The browser pass does not constitute a comprehensive accessibility audit or Safari/Firefox/device certification. Docker verification remains a deployment prerequisite. `.github/workflows/phase1.yml` now builds and starts a disposable Compose stack, tests real authentication and accounting endpoints, checks its non-root runtime, and runs finance/security tests inside the build image. This workflow is prepared but has not been executed on this host, where Docker remains absent.

To repeat the isolated restore check, set `PG_BIN_DIR` to the PostgreSQL client binary directory and run `node scripts/check-backup.mjs`. It exports a consistent snapshot, restores to a new synthetic database, compares counts and full-row digests for every table, verifies encrypted fields with the application encryption key, and tests a restored balance constraint. Its temporary source fixture is removed afterward; the dump and restored database are retained for review. Results are in `artifacts/backup-verification.json` (ignored by Git). Portable tools were obtained from [EDB's PostgreSQL binary downloads](https://www.enterprisedb.com/download-postgresql-binaries), without installing a service; `.tools/` is excluded from Git, formatting and Docker build contexts.

Remaining scope boundaries: no Phase 2 planners, budget UI, personal-loan/receivable modules, AI, notifications, Excel export, transaction-reversal UI, early EMI closure, or purchase-to-EMI conversion. Monetary columns and account labels are not field-encrypted; the PostgreSQL volume must be protected using host/storage encryption. Private notes and optional last-four identifiers use AES-256-GCM. No card secrets or full-card-number fields exist.

Screenshots generated by the test suite: `artifacts/dashboard-desktop.png` and `artifacts/dashboard-mobile.png`.
