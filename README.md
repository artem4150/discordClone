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

### Troubleshooting

If you see a DNS error for `guce.nip.io`, make sure you open `https://77.110.98.32.nip.io` directly. The hostname `guce.nip.io` is not registered and will result in `NXDOMAIN`.

### Cassandra startup

`chat-service` initializes its keyspace automatically. The `cassandra` container no longer mounts a non–existent init script and uses reduced heap settings so it can start reliably on low-memory hosts.
