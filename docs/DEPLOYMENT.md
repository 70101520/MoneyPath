# Testing VM deployment

MoneyPath Phase 1 is available at **http://192.168.80.128:3000** on the VMware guest. Source is tracked on [GitHub](https://github.com/70101520/MoneyPath) on `main`.

The deployment was validated on 14 September 2026 using Ubuntu 24.04.4 LTS, Docker Engine 29.8.0 and Compose 5.5.1. Initial Phase 1 revision: `c47eb9b16fa4d09fed86b75318cbe3f2e1c03043`. Phase 2 budgets and spending analysis update: `6fbd595`. Subsequent documentation commits do not change the tested image.

## First account

Open the URL, choose **First time here? Set up your account**, and create your own email/password using the setup token. The VM login is separate from the application account. The deployed database starts empty; no sample owner was added.

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

Validation used the independent `moneypath-smoke` Compose project and synthetic databases. Its containers were stopped after testing; its volume is retained for inspection. The live `moneypath` project has a separate database volume. Container authentication/accounting checks, all 29 finance/security/database tests, a non-root runtime check and a 14-table dump/restore comparison passed.
