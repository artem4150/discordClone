# Discord Clone Services

This repository contains several services orchestrated via `docker-compose.yml`. A sample environment configuration is provided in `.env`.

### Troubleshooting

If you see a DNS error for `guce.nip.io`, make sure you open `https://77.110.98.32.nip.io` directly. The hostname `guce.nip.io` is not registered and will result in `NXDOMAIN`.

### Cassandra startup

`chat-service` initializes its keyspace automatically. The `cassandra` container no longer mounts a non–existent init script and uses reduced heap settings so it can start reliably on low-memory hosts.
