# PHANTOM <—> Sistema Distribuido de Decepción y Prevención de Intrusiones Asistido por IA

## Arquitectura

PHANTOM es un **honeypot distribuido hub-and-spoke** sobre **Headscale v0.23.0** (Tailnet aislada).

### Topología

```
┌─────────────────────────────────────────────────────────────────┐
│  HUB AND SPOKE — ISLAMIENTO TOTAL (Headscale ACLs)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Oracle Cloud Madrid (82.70.74.120)                             │
│  ┌──────────────────────────────────────────────┐               │
│  │  Headscale v0.23.0 (Plano de Control)        │               │
│  │  ├─ Panel admin: 100.71.200.103:8086 (Nginx) │               │
│  │  └─ ACLs: sonda->sonda DENEGADO              │               │
│  └──────────────────────────────────────────────┘               │
│                                                                 │
│  Tailnet (100.x.x.x — Headscale)                                │
│  ┌─────────────────-─┐       ┌───────────────────────────────┐  │
│  │ oracle-master     │◄──────┤ SONDAS EN EL BORDE            │  │
│  │ 100.64.0.1        │  ACL  │  sonda-1: 100.64.0.x          │  │
│  │                   │       │  sonda-2: 100.64.0.x          │  │
│  │ ┌───────────────┐ │       │                               │  │
│  │ │ ts-phantom    │ │       │  ┌─────────────────────────┐  │  │
│  │ │ (Tailscale)   │ │       │  │ OpenCanary              │  │  │
│  │ └───────────────┘ │       │  │ Honeypot iLO4 vulnerable│  │  │
│  │ ┌───────────────┐ │       │  │ Sniffer (10s windows)   │  │  │
│  │ │ PostgreSQL 16 │ │       │  │ reporter.py → API       │  │  │
│  │ │ Maestro       │ │       │  └─────────────────────────┘  │  │
│  │ │ wal_level=rep │ │       │  → POST 100.64.0.1:8000       │  │
│  │ └───────────────┘ │       │                               │  │
│  │ ┌───────────────┐ │       └───────────────────────────────┘  │
│  │ │ FastAPI       │ │                                          │
│  │ │ :8000         │ │                                          │
│  │ └───────────────┘ │                                          │
│  └──────────-────────┘      ┌────────────────────────-───────┐  │
│                             │ oracle-replica                 │  │
│                             │ PostgreSQL 16 Esclavo          │  │
│                             │ streaming replication          │  │
│                             └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de datos

1. **Sondas** (sniffer) → cada 10s → `POST /api/v1/telemetria` → FastAPI → PostgreSQL Maestro
2. **Honeypots** (iLO4, OpenCanary) → `reporter.py` → `POST /api/v1/honeypot` → FastAPI → PostgreSQL
3. **FastAPI** ejecuta `modelo_phantom.joblib` (scikit-learn) sobre la telemetría → alerta si confianza ≥ 0.80
4. **PostgreSQL Maestro** → streaming replication → **PostgreSQL Esclavo** (backup)
5. **Firewall sonda** redirige tráfico malicioso al honeypot cuando confianza ≥ 0.80

### Aislamiento de red

- **ACLs Headscale**: `tag:sonda → tag:sonda` **DENEGADO** (sin movimiento lateral entre sondas)
- **ACLs**: sondas → `oracle-master` solo puertos `8000` (FastAPI) y `5432` (PostgreSQL)
- `oracle-master` usa `network_mode: "service:ts-phantom"` (comparte red de Tailscale)

## Estructura del monorepo

```
phantom/
├── README.md
├── .gitignore
├── .env.example
├── docs/
│   ├── arquitectura-red.md
│   ├── comandos-headscale.md
│   └── despliegue-sondas.md
├── infrastructure/
│   ├── headscale/
│   │   ├── docker-compose.yml
│   │   └── config/
│   │       ├── config.yaml.example
│   │       ├── acl.hujson
│   │       └── nginx-ui.conf
│   └── oracle-core/
│       ├── docker-compose.yml
│       ├── postgres-init/
│       │   └── 01-init.sql
│       └── postgres-replica/
│           └── docker-compose.yml
├── backend-api/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       └── main.py
├── ml-pipeline/
│   ├── requirements.txt
│   ├── scripts/
│   │   ├── limpiar_csv.py
│   │   ├── entrenar.py
│   │   └── evaluar.py
│   ├── models/
│   │   └── .gitkeep
│   └── datasets/
│       └── .gitkeep
└── sonda-agent/
    ├── docker-compose.yml
    ├── scripts/
    │   └── install_sonda.sh
    ├── sniffer/
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   ├── captura_ventanas.py
    │   └── firewall_redirect.py
    └── honeypots/
        ├── ilo4-vulnerable/
        │   ├── app.py
        │   ├── Dockerfile
        │   ├── docker-compose.yml
        │   ├── reporter.py
        │   ├── ilo_files/
        │   │   ├── index.html
        │   │   ├── html/
        │   │   ├── css/
        │   │   ├── js/
        │   │   ├── images/
        │   │   └── lang/
        │   ├── certs/
        │   │   ├── cert.pem
        │   │   └── key.pem
        │   └── data/
        │       └── .gitkeep
        └── opencanary/
            └── opencanary.conf.example
```

## Guía rápida de despliegue

### 1. Plano de Control (Headscale en Oracle Cloud)

```bash
cd infrastructure/headscale
docker compose up -d
# Panel admin: http://100.71.200.103:8086
# Crear preauthkey:
docker exec phantom-headscale headscale preauthkeys create --expiration 72h
```

### 2. Núcleo Central (oracle-master)

```bash
cd infrastructure/oracle-core
docker compose up -d
# Verificar PostgreSQL:
docker compose exec postgres-master psql -U phantom -c "SELECT 1;"
# Verificar FastAPI:
curl http://100.64.0.1:8000/health
```

### 3. Dar de alta una sonda

```bash
# En el nodo de sonda:
cd sonda-agent/scripts
./install_sonda.sh --authkey <PREAUTHKEY> --hostname sonda-1
# Verificar:
tailscale ip
# Debería mostrar 100.64.0.x
# Auditar aislamiento:
ping -c 1 100.64.0.2  # Sonda-2 → debería fallar (ACL deniega)
nc -vz 100.64.0.1 8000  # → debería funcionar (ACL permite)
```

### 4. Levantar servicios en la sonda

```bash
cd sonda-agent
docker compose up -d
# Verificar:
docker compose ps
```

### 5. Entrenar el modelo ML

```bash
cd ml-pipeline
python scripts/limpiar_csv.py  # Limpiar datos
python scripts/entrenar.py    # Entrenar y exportar models/modelo_phantom.joblib
python scripts/evaluar.py     # Evaluar métricas
```

## Seguridad

- **Uso responsable**: Solo en entornos autorizados.
- **No exponer**: Headscale solo accesible internamente en Oracle Cloud.
- **ACLs**: El aislamiento es la principal defensa; las sondas no pueden verse entre sí.
- **Certificados**: El honeypot usa certificado auto-firmado (solo para el honeypot).
- **Secretos**: Nunca subas `.env`, `*.key`, `*.pem` al repo.
