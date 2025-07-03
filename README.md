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

 Caddy acts as the reverse proxy and automatically obtains Let's Encrypt certificates for the domain specified in `DOMAIN`. If port 443 is in use, set `CADDY_HTTPS_PORT` in `.env` to an available port (default `444`) and open `https://<DOMAIN>:<CADDY_HTTPS_PORT>` in the browser.

If your `DOMAIN` points to a private address like `127.0.0.1.nip.io`, Let's Encrypt cannot issue a certificate and Caddy's automatic redirect to HTTPS will fail. The included `Caddyfile` disables automatic HTTPS so the stack is reachable over plain HTTP at `http://<DOMAIN>`.

If you see an error like `Bind for 0.0.0.0:80 failed` when starting `caddy`, another service is already using that port. Set `CADDY_HTTP_PORT` in `.env` to an unused port (for example `8080`) and access `http://<DOMAIN>:<CADDY_HTTP_PORT>` instead.

### Troubleshooting


If you see a DNS error for `guce.nip.io`, make sure you open `https://77.110.98.32.nip.io` directly. The hostname `guce.nip.io` is not registered and will result in `NXDOMAIN`.

### Cassandra startup

`chat-service` initializes its keyspace automatically. The `cassandra` container no longer mounts a non–existent init script and uses reduced heap settings so it can start reliably on low-memory hosts.
