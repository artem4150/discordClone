# Discord Clone Services

This repository contains several services orchestrated via `docker-compose.yml`. A sample environment configuration is provided in `.env`.

### Configuration

When deploying to a machine with a different public IP address, edit `.env` to
match your host. In particular update the `DOMAIN` variable so that it points to
the new IP using `nip.io` (e.g. `203.0.113.10.nip.io`). You should also update
`REALM` and `EXTERNAL_IP` to the same address.

### Quick start

Start all services with:

```bash
docker-compose up -d
```

This will bootstrap the full stack in the background using the values from
`.env`.


### HTTPS with Caddy

When ports 80/443 are unavailable, Caddy can still serve HTTPS using its internal CA.
Edit `.env` to set `CADDY_HTTP_PORT` and `CADDY_HTTPS_PORT` (defaults are `8080` and `8443`).
After starting the stack run:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy_root.crt
sudo trust anchor ./caddy_root.crt       # install on Linux (use Keychain on macOS or double‑click on Windows)
```

Then open `https://<DOMAIN>:<CADDY_HTTPS_PORT>` in the browser.

### Troubleshooting


If you see a DNS error for `guce.nip.io`, make sure you open `https://77.110.98.32.nip.io` directly. The hostname `guce.nip.io` is not registered and will result in `NXDOMAIN`.

### Cassandra startup

`chat-service` initializes its keyspace automatically. The `cassandra` container no longer mounts a non–existent init script and uses reduced heap settings so it can start reliably on low-memory hosts.
