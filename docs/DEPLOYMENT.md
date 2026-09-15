# Testing VM deployment

MoneyPath Phases 1–4 are available at **http://192.168.80.128:3000** on the VMware guest. See [PHASE3.md](PHASE3.md) and [PHASE4.md](PHASE4.md). Source is tracked on [GitHub](https://github.com/70101520/MoneyPath) on `main`.

The deployment was validated through 15 September 2026 using Ubuntu 24.04.4 LTS, Docker Engine 29.8.0 and Compose 5.5.1. Current tested application revision: `34642f1` (global Finance Assistant and page transitions). Earlier releases: `c47eb9b` (Phase 1), `79ddbdb` (full Phase 2), `b0af09a` (complete Phase 3), `39788d5` (complete Phase 4), `079df2d` (dynamic personal guidance), `b7f0c61` (initial conversational assistant) and `261b4f2` (expanded assistant). Subsequent documentation commits do not change the tested image.

The completed Phase 4 Docker build and all 68 tests passed on the VM. Ten migrations are applied. The database and matching environment backup is `/opt/moneypath/backups/before-phase4-complete-20260914T182715Z.*`; all 23 pre-existing application-table fingerprints matched after migration. The prior image is tagged `moneypath-app:before-phase4-complete`.

The `moneypath-notifier` worker is running and its authenticated delivery job completed successfully. Anonymous job execution was rejected with HTTP 401. VM-only job and VAPID keys were generated with restricted environment-file permissions. SMTP variables remain empty until an email provider account is configured.

Dynamic personal guidance revision `079df2d` is deployed. Its Docker build and all 70 tests passed, followed by desktop/mobile LAN checks. The database and matching environment backup is `/opt/moneypath/backups/before-guidance-20260914T185624Z.*`; all 25 application-table fingerprints matched before and after deployment.

Conversational assistant revision `b7f0c61` is deployed. Its Docker build and all 74 tests passed, followed by desktop/mobile chatbot checks. Eleven migrations are applied. The database and matching environment backup is `/opt/moneypath/backups/before-chatbot-20260914T191619Z.*`; all 25 pre-existing application-table fingerprints matched before and after migration. The assistant stores encrypted chat history and requires an explicit confirmation before saving an interpreted transaction.

Expanded Finance Assistant revision `261b4f2` is deployed. Its Docker build and all 79 tests passed. Twelve migrations are applied. The database and environment backup is `/opt/moneypath/backups/before-assistant-expansion-20260915T024222Z.*`; all 27 pre-existing application-table fingerprints matched before and after migration. LAN Chromium checks passed on desktop and mobile, including live status cards, quick actions, a decisive purchase result and a remembered price follow-up. Confirmed assistant writes now have encrypted audit metadata and safe reversible entries support Undo.

Global assistant revision `34642f1` is deployed. The Finance Assistant opens as a side drawer from every money page, and navigation uses motion-safe page transitions and active-item reflection. All 79 finance/database tests and six browser scenarios passed. The backup is `/opt/moneypath/backups/before-global-assistant-20260915T031407Z.*`; all 27 application-table fingerprints matched before and after deployment. Live desktop/mobile checks passed without page errors or overflow. The spreadsheet remains a manual reference and was not imported into the VM database.

The current Docker build and all 66 finance/security/database tests passed on the VM. Nine migrations are applied. Before migration, the app was stopped and its database and matching environment were backed up under `/opt/moneypath/backups/before-phase3-complete-20260914T180955Z.*`. Full row counts/digests for all 18 pre-existing application tables matched after migration. The old image is tagged `moneypath-app:before-phase3-complete`.

Final LAN Chromium checks passed on desktop and mobile across all planning, personal-balance, investment, goal, simulator, assistant and integration screens. Authentication redirects, anonymous API rejection, purchase simulation and transaction-form checks passed without client errors or page overflow.

The Phase 3 Docker build and all 60 finance/security/database tests passed on the VM. Seven migrations are applied. Before migration, the app was briefly stopped and its database and matching environment were backed up under `/opt/moneypath/backups/before-phase3-first-20260914T131749Z.*`. Full row counts/digests for all 16 pre-existing application tables matched after migration, preserving posted records, settings and sessions. The old image is tagged `moneypath-app:before-phase3-first`.

Final LAN Chromium checks passed for all eight Phase 2 pages and both new Phase 3 pages on desktop and mobile, including purchase simulation and opening a transaction form over HTTP. Authentication redirects and anonymous API rejection passed, with no client errors or page overflow. Existing owners keep their email/password; first-owner setup is only for an empty installation.

## Earlier deployment validation

The Phase 2 Docker build and all 51 finance/security/database tests passed on the VM. Six migrations are applied. Before migration, the app was briefly stopped, its database and matching environment were backed up under `/opt/moneypath/backups/before-phase2-complete-20260914T125902Z.*`, and row counts/digests were captured. All 14 pre-existing application tables matched after migration when excluding newly added nullable columns; posted records, settings and sessions were preserved. The old image is tagged `moneypath-app:before-phase2-complete`.

## First account

On a fresh installation, open the URL, choose **First time here? Set up your account**, and create your own email/password using the setup token. The VM login is separate from the application account. The initial deployment started empty; no sample owner was added. Existing owners should sign in with their application credentials.

As `techadmin` on the VM, retrieve the token with:

```sh
cat /home/techadmin/moneypath-setup-token.txt
```

Registration closes once the owner exists. Add opening account balances and complete Settings before using the calculations. `/demo` provides a separate read-only sample.

## Operations

Source and Compose configuration live in `/opt/moneypath`. The private `.env` is readable only by its owner and contains independently generated database, encryption and setup secrets. Keep it outside Git and preserve its encryption key with backups.

```sh
cd /opt/moneypath
sudo docker compose -p moneypath ps
sudo docker compose -p moneypath logs --tail=100 app
sudo docker compose -p moneypath up -d
```

Docker starts at boot and the application/database restart automatically. The app listens on `192.168.80.128:3000`; PostgreSQL listens only on `127.0.0.1:5432`. This testing deployment uses HTTP with `ALLOW_INSECURE_COOKIE=true`. For production, configure HTTPS and set this option to `false` with the matching `APP_ORIGIN`.

## Updating

Back up before updating. With repository read access configured on the VM:

```sh
cd /opt/moneypath
git pull --ff-only origin main
sudo docker compose -p moneypath up --build -d
```

The initial checkout was transferred using a Git bundle; GitHub credentials were not copied to the guest. If the repository requires authentication, transfer a new bundle from the authorized development checkout, then fetch and fast-forward from it before rebuilding. The migration service applies checked-in migrations before the app starts.

## Backups

```sh
cd /opt/moneypath
mkdir -p backups
chmod 700 backups
sudo docker compose -p moneypath exec -T db pg_dump -U moneypath -d moneypath -Fc -f /tmp/moneypath.dump
sudo docker compose -p moneypath cp db:/tmp/moneypath.dump ./backups/moneypath.dump
sudo chmod 600 backups/moneypath.dump
```

Use timestamped filenames for retained backups. See the README for restoration into a separate database. Do not remove Compose volumes when preserving data.

Validation used the independent `moneypath-smoke` Compose project and synthetic databases. Its containers were stopped after testing; its volume is retained for inspection. The live `moneypath` project has a separate database volume. Initial Phase 1 validation passed container authentication/accounting checks, 29 finance/security/database tests, a non-root runtime check and a 14-table dump/restore comparison. The current Phase 3 local restore comparison passed across all 19 tables, including decrypted private references.
