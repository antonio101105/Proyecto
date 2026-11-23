# PHANTOM — Sistema Distribuido de Decepción y Prevención de Intrusiones Asistido por IA

## Arquitectura General

PHANTOM es un **sistema distribuido de decepción y prevención de intrusiones** asistido por IA, sobre una **red aislada Headscale v0.23.0** con arquitectura de **doble plano VPN** para separar la red de administración personal (Tailscale oficial) de la red operativa (Headscale propio).

**Componentes:**
- **Sondas en el borde** (`sonda-1`, `sonda-2`): Máquinas externas al mismo nivel de switch que los servidores protegidos. Capturan tráfico de red en ventanas de 10s y ejecutan honeypots locales (HP iLO 4, OpenCanary). Cuando el modelo ML devuelve `accion: "redirigir_honeypot"` (confianza ≥ 0.80), las sondas aplican reglas `iptables`/`nftables` para desviar al atacante a los honeypots locales.
- **Hub central** (`oracle-master`): Contenedor Tailscale (`phantom-vpn-oracle`) que comparte red (`network_mode: "service:ts-phantom"`) con PostgreSQL 16 Maestro y FastAPI. Solo accesible desde la red aislada `100.64.0.0/10`.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA PHANTOM — DOBLE PLANO VPN                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                    ORACLE CLOUD MADRID (82.70.74.120)                            │    │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │                    RED DE ADMINISTRACIÓN PERSONAL (Tailscale Oficial)     │  │    │
│  │  │  • Interfaz: tailscale0 (100.71.200.103)                                 │  │    │
│  │  │  • Uso: SSH admin + Panel Headscale (Nginx Proxy)                        │  │    │
│  │  │  • Acceso: Tailscale personal + Cloudflare Tunnel + Cloudflare Access    │  │    │
│  │  └───────────────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐  │    │
│  │  │                    RED OPERATIVA AISLADA (Headscale v0.23.0)              │  │    │
│  │  │  • Plano de control: Docker (/opt/phantom-oracle/headscale)              │  │    │
│  │  │  • API: 0.0.0.0:8085 (HTTP, sin TLS)                                    │  │    │
│  │  │  • Rango: 100.64.0.0/10 (namespace/usuario: phantom)                    │  │    │
│  │  │  • Acoplamiento: network_mode: "service:ts-phantom"                     │  │    │
│  │  └───────────────────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                           TAILNET 100.64.0.0/10 (Headscale)                     │    │
│  │                                                                                  │    │
│  │   ┌────────────────────────┐    ┌──────────────────────────────────────────┐    │    │
│  │   │     SONDAS (Spokes)    │    │           HUB CENTRAL                    │    │    │
│  │   │                        │    │  oracle-master (100.64.0.1)               │    │    │
│  │   │  sonda-1 (100.64.0.3)  │───►│  tag:oracle                              │    │    │
│  │   │  sonda-2 (100.64.0.4)  │    │  ┌────────────────────────────────────┐  │    │    │
│  │   │        tag:sonda       │    │  │ phantom-vpn-oracle (tailscale/tailscale) │    │    │
│  │   │                        │    │  │ network_mode: service:ts-phantom    │  │    │    │
│  │   │  ┌─────────────────┐  │    │  │  ├─ postgres-master :5432            │  │    │    │
│  │   │  │ Honeypot iLO4   │  │    │  │  ├─ phantom-api :8000 (FastAPI)     │  │    │    │
│  │   │  │ OpenCanary      │  │    │  │  └─ Modelo ML (scikit-learn)        │  │    │    │
│  │   │  │ Sniffer 10s     │  │    │  └────────────────────────────────────┘  │    │    │
│  │   │  │ Reporter → API  │  │    │         ▲                    ▲           │    │    │
│  │   │  └─────────────────┘  │    │         │                    │           │    │    │
│  │   └────────────────────────┘    │         │ Streaming            │           │    │    │
│  │                                 │         │ Replication          │           │    │    │
│  │   ┌────────────────────────┐    │         │                      │           │    │    │
│  │   │   oracle-replica       │    │         │                      │           │    │    │
│  │   │   PostgreSQL 16 Esclavo │    │         │                    │           │    │    │
│  │   └────────────────────────┘    │         │                    │           │    │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                          │
│  FLUJO DE DATOS:                                                                         │
│  ┌─────────┐   10s/Eventos    ┌──────────┐    ┌─────────────────┐                      │
│  │ Sonda   │─────────────────►│ FastAPI  │───►│ PostgreSQL      │                      │
│  │ Sniffer │   Telemetría     │ :8000    │    │ Maestro (wal)   │                      │
│  │ Honeypot│   Eventos        │ /api/v1/ │    │ Streaming Rep.  │                      │
│  └─────────┘                  │ telemetria│    └────────┬────────┘                      │
│                               │ honeypot  │              │ Streaming                    │
│                               └──────────┘              ▼ Replication                  │
│                                                          ┌──────────────────┐          │
│                                                          │ PostgreSQL       │          │
│                                                          │ Esclavo (backup)│          │
│                                                          └──────────────────┘          │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Aislamiento de Red (ACLs Headscale)

```json
{
  "groups": {
    "group:sondas": ["tag:sonda"],
    "group:central": ["tag:oracle"],
    "group:replica": ["tag:replica"]
  },
  "acls": [
    {"action": "accept", "src": ["group:sondas"], "dst": ["group:central:8000,5432"]},
    {"action": "accept", "src": ["group:central"], "dst": ["group:replica:5432"]},
    {"action": "deny", "src": ["group:sondas"], "dst": ["group:sondas"]},
    {"action": "deny", "src": ["*"], "dst": ["*"]}
  ]
}
```

**Resultado:**
- ✅ Sondas → Central (8000, 5432): **PERMITIDO**
- ✅ Central → Réplica (5432): **PERMITIDO**
- ❌ Sonda → Sonda: **DENEGADO** (sin movimiento lateral)
- ❌ Todo lo demás: **DENEGADO**

## Guía Rápida de Despliegue

### 1. Plano de Control (Headscale en Oracle Cloud)

```bash
cd infrastructure/headscale
docker compose up -d
# Panel admin: http://100.71.200.103:8086 (Nginx Proxy + Cloudflare Tunnel)
docker exec phantom-headscale headscale preauthkeys create --user phantom --expiration 24h --tags tag:sonda --reusable
```

### 2. Núcleo Central (oracle-master)

```bash
cd infrastructure/oracle-core
docker compose up -d
curl http://100.64.0.1:8000/health
```

### 3. Dar de alta una sonda

```bash
cd sonda-agent/scripts
sudo ./install_sonda.sh \
  --authkey <PREAUTHKEY_DE_HEADSCALE> \
  --hostname sonda-1 \
  --api-url http://100.64.0.1:8000
```

### 4. Verificar aislamiento (CRÍTICO)

```bash
# DEBE FALLAR (movimiento lateral bloqueado)
ping -c 3 100.64.0.4    # Otra sonda → 100% packet loss
nc -zv 100.64.0.4 22    # → Connection timed out

# DEBE FUNCIONAR
nc -zv 100.64.0.1 8000  # FastAPI
nc -zv 100.64.0.1 5432  # PostgreSQL
```

## Estructura del Monorepo

```
phantom/
├── README.md
├── .gitignore
├── .env.example
├── docs/
│   ├── arquitectura-red.md       # Arquitectura completa + diagramas
│   ├── comandos-headscale.md     # Chuleta CLI Headscale
│   └── despliegue-sondas.md      # Procedimientos operativos
├── infrastructure/
│   ├── headscale/                # Headscale + Nginx UI
│   └── oracle-core/              # PostgreSQL Maestro/Replica + FastAPI
├── backend-api/                  # FastAPI + Modelo ML
├── ml-pipeline/                  # Entrenamiento ML (scikit-learn)
└── sonda-agent/                  # Sniffer + Honeypots (iLO4, OpenCanary)
```

## Enlaces a Documentación Detallada

- [Arquitectura de Red Completa](docs/arquitectura-red.md) — Diagramas, ACLs, firewall, acoplamiento
- [Comandos Headscale](docs/comandos-headscale.md) — Chuleta CLI completa
- [Despliegue de Sondas](docs/despliegue-sondas.md) — Procedimientos operativos, auditoría, troubleshooting

## Honeypot HP iLO 4 Vulnerable

Incluido en `sonda-agent/honeypots/ilo4-vulnerable/`:
- Réplica literal del iLO HPE Gen10 (HTML/CSS/JS/imágenes reales)
- SQLi en login (interpolación cruda) → respuesta falsa 500 para engañar al atacante
- XSS reflejado en nombre de sesión
- Reporter integrado → `POST /api/v1/honeypot` con `sonda_id`, `ip_atacante`, `detalle`

## Seguridad / Uso Responsable

> **Solo en entornos autorizados.** Este honeypot captura payloads en tu propia red. No lo apuntes a sistemas reales.

## Licencia

MIT — ver [LICENSE](LICENSE).