# Arquitectura de Red PHANTOM — Aislamiento Headscale Hub-and-Spoke

## Visión General

PHANTOM utiliza **Headscale v0.23.0** (implementación open-source de Tailscale) para crear una **Tailnet aislada** con arquitectura **Hub-and-Spoke** estricta. El aislamiento se impone a nivel de **ACLs (Access Control Lists)** a nivel de plano de control, no por firewalls locales.

## Topología Lógica

```
                    ┌─────────────────────────────────────────┐
                    │        Oracle Cloud Madrid                │
                    │    82.70.74.120:8085 (Headscale)         │
                    │    Panel Admin: 100.71.200.103:8086      │
                    └─────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │  Tailnet 100.64.0.0/10 (Headscale) │
                    └────────────────┼────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
    ┌────▼────┐               ┌──────▼──────┐            ┌─────▼─────┐
    │ Sonda-1 │               │ oracle-master│            │ Sonda-2  │
    │100.64.0.x│               │ 100.64.0.1   │            │100.64.0.x│
    │  :8000  │◄──────────────┤  :8000,:5432 │            │  :8000   │
    └─────────┘               └──────────────┘            └──────────┘
                                                                   │
                    ┌─────────────────────────────────────────────┐
                    │              oracle-replica                  │
                    │         PostgreSQL 16 Esclavo                │
                    └─────────────────────────────────────────────┘
```

## Aislamiento por ACLs (acl.hujson)

```json
{
  "groups": {
    "group:sondas": ["tag:sonda"],
    "group:central": ["tag:central"],
    "group:replica": ["tag:replica"]
  },
  "acls": [
    // Sonda -> Central (API + PostgreSQL)
    {"action": "accept", "src": ["group:sondas"], "dst": ["group:central:8000,5432"]},
    // Central -> Replica (replicación PostgreSQL)
    {"action": "accept", "src": ["group:central"], "dst": ["group:replica:5432"]},
    // DENEGAR todo lo demás
    {"action": "deny", "src": ["group:sondas"], "dst": ["group:sondas"]},
    {"action": "deny", "src": ["*"], "dst": ["*"]}
  ],
  "tagOwners": {
    "tag:sonda": ["autogroup:member"],
    "tag:central": ["autogroup:member"],
    "tag:replica": ["autogroup:member"]
  }
}
```

**Resultado:**
- ✅ Sondas → Central (puerto 8000 API, 5432 PostgreSQL): **PERMITIDO**
- ✅ Central → Réplica (puerto 5432 replicación): **PERMITIDO**
- ❌ Sonda → Sonda: **DENEGADO** (sin movimiento lateral)
- ❌ Todo lo demás: **DENEGADO**

## Acoplamiento `network_mode: "service:ts-phantom"`

`oracle-master` comparte **la interfaz de red de Tailscale** con el contenedor `ts-phantom`:

```yaml
services:
  ts-phantom:
    image: tailscale/tailscale:latest
    cap_add: [NET_ADMIN, SYS_MODULE]
    volumes:
      - /var/lib/headscale:/var/lib/headscale
    command: tailscaled --state=/var/lib/headscale/tailscaled.state
    environment:
      - TS_AUTHKEY=${HEADSCALE_AUTHKEY}
      - TS_EXTRA_ARGS=--advertise-routes=100.64.0.0/10

  postgres-master:
    image: postgres:16
    network_mode: "service:ts-phantom"
    # ...comparte red con ts-phantom→usa IP 100.64.0.1

  phantom-api:
    image: phantom-api:latest
    network_mode: "service:ts-phantom"
    # ...comparte red→accesible en 100.64.0.1:8000
```

**Implicaciones:**
- PostgreSQL y FastAPI **no exponen puertos en host** → solo accesibles vía Tailnet
- Tráfico entre Central y Réplica viaja **dentro de la Tailnet** (100.64.x.x)
- Sin exposición a Internet público → reducción de superficie de ataque

## Flujo de Datos

```
┌─────────┐     10s      ┌─────────────┐     ┌──────────────────┐
│ Sonda   │─────────────►│ FastAPI     │────►│ PostgreSQL       │
│ Sniffer │  Telemetría  │ :8000       │     │ Maestro          │
└─────────┘   (JSON)      │ /api/v1/    │     │ (wal_level=rep)  │
                          │ telemetria  │     └────────┬─────────┘
                          └─────────────┘              │
                                                         ▼
┌─────────┐     Eventos    ┌─────────────┐     ┌──────────────────┐
│ Honeypot│───────────────►│ FastAPI     │────►│ PostgreSQL       │
│ iLO4    │  (reporter)    │ :8000       │     │ Maestro          │
└─────────┘  POST /honeypot│ /api/v1/    │     │ (alertas)        │
                          │ honeypot    │     └────────┬─────────┘
                          └─────────────┘              │
                                                         ▼
                                                 Streaming
                                                 Replication
                                                         ▼
┌─────────┐     Modelo ML    ┌─────────────┐     ┌──────────────────┐
│ Alerta  │◄────────────────│ FastAPI     │◄────│ PostgreSQL       │
│ >=0.80  │  Inferencia     │ :8000       │     │ Esclavo          │
└─────────┘  (scikit-learn)  │ modelo.pkl  │     │ (backup/read)    │
                          └─────────────┘     └──────────────────┘
```

## Comandos de Verificación

```bash
# Ver ACLs aplicadas
docker exec phantom-headscale headscale acls list

# Ver nodos y tags
docker exec phantom-headscale headscale nodes list

# Verificar aislamiento desde sonda
# (debe fallar)
ping -c 1 100.64.0.2        # Otra sonda → DENEGADO
nc -vz 100.64.0.2 8000      # → DENEGADO

# (debe funcionar)
nc -vz 100.64.0.1 8000      # Central API → PERMITIDO
nc -vz 100.64.0.1 5432      # PostgreSQL → PERMITIDO
```
