# Arquitectura de Red PHANTOM — Doble Plano VPN y Aislamiento Total

## Resumen Ejecutivo

PHANTOM implementa una arquitectura **Hub-and-Spoke con doble plano VPN** para lograr aislamiento total entre:
1. **Red de Administración Personal** (Tailscale oficial) — Gestión SSH, panel Headscale
2. **Red Operativa Aislada PHANTOM** (Headscale v0.23.0) — Plano de control propio, rango `100.64.0.0/10`

El aislamiento se impone a nivel de **ACLs a nivel de plano de control** (Headscale), **firewalls perimetrales** (Oracle VCN + iptables host) y **acoplamiento de red Docker** (`network_mode: "service:ts-phantom"`).

---

## 1. Arquitectura de Doble Plano VPN

### Red de Administración Personal (Tailscale Oficial)
| Componente | Detalle |
|------------|---------|
| **Proveedor** | Tailscale oficial (Saas) |
| **Interfaz** | `tailscale0` |
| **IP** | `100.71.200.103` |
| **Uso exclusivo** | SSH administrativo, panel Headscale admin |
| **Acceso externo** | Cloudflare Tunnel + Cloudflare Access (OTP) |
| **Contenedor** | `phantom-headscale-ui-proxy` (nginx:alpine) |

### Red Operativa Aislada PHANTOM (Headscale v0.23.0)
| Componente | Detalle |
|------------|---------|
| **Proveedor** | Headscale v0.23.0 (self-hosted) |
| **Contenedor** | `phantom-headscale` (Docker) |
| **API** | `0.0.0.0:8085` (HTTP) |
| **Rango IP** | `100.64.0.0/10` (namespace `phantom`) |
| **Panel Admin** | `100.71.200.103:8086` (Nginx proxy → `headscale:8080`) |
| **ACL Policy** | Archivo `acl.hujson` (modo `file`) |

### Separación Física de Planos

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORACLE CLOUD MADRID (82.70.74.120)               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLANO 1: RED ADMINISTRACIÓN PERSONAL (Tailscale Oficial)  │   │
│  │  • Interfaz: tailscale0 (100.71.200.103)                   │   │
│  │  • Panel Headscale UI: 100.71.200.103:8086 (Nginx Proxy)   │   │
│  │  • Acceso: Tailscale Personal + Cloudflare Tunnel + Access │   │
│  │  • Uso: SSH admin, Headscale UI, MagicDNS                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼ (AISLAMIENTO COMPLETO)              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  PLANO 2: RED OPERATIVA PHANTOM (Headscale v0.23.0)        │   │
│  │  • Contenedor: phantom-headscale (Docker)                   │   │
│  │  • API: 0.0.0.0:8085 (HTTP)                                │   │
│  │  • Rango: 100.64.0.0/10 (namespace: phantom)               │   │
│  │  • Panel: 100.71.200.103:8086 (via Nginx Proxy)            │   │
│  │  • Rango operativo: 100.64.0.0/10                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  NODO CENTRAL: oracle-master (100.64.0.1, tag:oracle)      │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ ts-phantom (tailscale/tailscale)                        │ │   │
│  │  │ network_mode: "service:ts-phantom"                      │ │   │
│  │  │  ├─ postgres-master :5432 (PostgreSQL 16 Maestro)      │ │   │
│  │  │  └─ phantom-api :8000 (FastAPI + ML)                   │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │  SONDAS (tag:sonda)                                        │   │
│  │  ├─ sonda-1 (100.64.0.3)                                   │   │
│  │  └─ sonda-2 (100.64.0.4)                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Acoplamiento de Red `network_mode: "service:ts-phantom"`

El nodo central `oracle-master` **no corre en el host**, sino dentro del contenedor `ts-phantom` (`tailscale/tailscale`). Los servicios comparten **exactamente la misma pila de red**:

```yaml
services:
  ts-phantom:
    image: tailscale/tailscale:latest
    container_name: phantom-ts
    cap_add: [NET_ADMIN, SYS_MODULE]
    volumes:
      - ts-state:/var/lib/tailscale
    environment:
      - TS_AUTHKEY=${HEADSCALE_AUTHKEY}
      - TS_EXTRA_ARGS=--advertise-routes=100.64.0.0/10 --accept-routes=false
    sysctls:
      - net.ipv4.ip_forward=1

  postgres-master:
    image: postgres:16
    network_mode: "service:ts-phantom"      # ← COMPARTE RED CON ts-phantom
    environment:
      - POSTGRES_DB=phantom
      - POSTGRES_USER=phantom
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    command: >
      postgres
      -c wal_level=replica
      -c max_wal_senders=10
      -c listen_addresses=*

  phantom-api:
    build: ../../backend-api
    network_mode: "service:ts-phantom"      # ← COMPARTE RED CON ts-phantom
    environment:
      - DATABASE_URL=postgresql://phantom:...@localhost:5432/phantom
```

**Implicaciones críticas:**
- PostgreSQL y FastAPI **no exponen puertos en host** → solo accesibles vía Tailnet (`100.64.0.1`)
- Tráfico Central ↔ Réplica viaja **dentro de la Tailnet** (`100.64.x.x`)
- Sin exposición a Internet público → reducción drástica de superficie de ataque
- `listen_addresses=*` en PostgreSQL escucha en `100.64.0.1` (IP Tailnet)

---

## 3. Cortafuegos Perimetral (Oracle VCN) y Local (iptables)

### Oracle Cloud VCN Security List (Ingress Rules)

| Regla | Protocolo | Puerto Origen | Puerto Destino | CIDR Origen | Descripción |
|-------|-----------|---------------|----------------|-------------|-------------|
| Headscale API | TCP | **Vacío** | **8085** | `0.0.0.0/0` | Headscale API pública |
| Headscale UI | TCP | **Vacío** | **8086** | `0.0.0.0/0` | Panel Admin (Nginx) |
| SSH Admin | TCP | **Vacío** | **22** | `MI_IP_PUBLICA/32` | Solo mi IP |

> **⚠️ CRÍTICO:** El **puerto de origen debe quedar vacío** (todos los puertos efímeros `32768-65535`). Si se restringe el puerto de origen, las sondas no podrán conectar.

### Firewall Local Host (Ubuntu + iptables)

```bash
# Reglas INPUT (acceso a Headscale API desde Internet)
iptables -A INPUT -p tcp --dport 8085 -j ACCEPT

# Reglas DOCKER-USER (tráfico hacia contenedores)
iptables -I DOCKER-USER -p tcp --dport 8080 -j ACCEPT  # Headscale interno (8080→8085)

# Reglas FORWARD (tráfico entre contenedores y red)
iptables -A FORWARD -p tcp --dport 8080 -j ACCEPT

# Persistencia
netfilter-persistent save
netfilter-persistent reload
```

**Verificación:**
```bash
# Verificar reglas activas
iptables -L -n -v | grep -E "8080|8085"

# Verificar desde exterior
curl -I http://82.70.74.120:8085/health
```

---

## 4. Topología Hub-and-Spoke y Políticas ACL (`acl.hujson`)

### Nodos Activos Verificados

| Nodo | IP Tailnet | Etiqueta | Rol |
|------|------------|----------|-----|
| `oracle-master` | `100.64.0.1` | `tag:oracle` | Hub Central (contenedor Tailscale) |
| `sonda-1` | `100.64.0.3` | `tag:sonda` | Spoke 1 |
| `sonda-2` | `100.64.0.4` | `tag:sonda` | Spoke 2 |
| `oracle-replica` | `100.64.0.2` | `tag:replica` | Réplica BD |

### Archivo `acl.hujson` Aplicado

```json
{
  "groups": {
    "group:sondas": ["tag:sonda"],
    "group:central": ["tag:oracle"],
    "group:replica": ["tag:replica"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["group:sondas"],
      "dst": ["group:central:8000,5432"]
    },
    {
      "action": "accept",
      "src": ["group:central"],
      "dst": ["group:replica:5432"]
    },
    {
      "action": "deny",
      "src": ["group:sondas"],
      "dst": ["group:sondas"]
    },
    {
      "action": "deny",
      "src": ["*"],
      "dst": ["*"]
    }
  ],
  "tagOwners": {
    "tag:sonda": ["autogroup:member"],
    "tag:oracle": ["autogroup:member"],
    "tag:replica": ["autogroup:member"]
  }
}
```

### Matriz de Acceso Resultante

| Origen | Destino | Puerto | Acción | Verificación |
|--------|---------|--------|--------|--------------|
| Sonda (`tag:sonda`) | Central (`tag:oracle`) | 8000 (FastAPI) | ✅ ACCEPT | `nc -zv 100.64.0.1 8000` ✅ |
| Sonda | Central | 5432 (PostgreSQL) | ✅ ACCEPT | `nc -zv 100.64.0.1 5432` ✅ |
| Central | Réplica | 5432 (Replication) | ✅ ACCEPT | Streaming activo |
| Sonda A | Sonda B | Cualquiera | ❌ DENY | `ping 100.64.0.4` → 100% loss ✅ |
| Sonda | Central | 22 (SSH) | ❌ DENY | `nc -zv 100.64.0.1 22` → timeout ✅ |
| Cualquiera | Cualquiera | Cualquiera | ❌ DENY | Por defecto |

---

## 5. Panel Web de Administración y Acceso Remoto Seguro

### Reverse Proxy Interno (`nginx:alpine`)

```yaml
# docker-compose.yml (headscale)
services:
  headscale:
    image: headscale/headscale:v0.23.0
    ports:
      - "8080:8080"    # Interno (no expuesto)

  nginx-ui:
    image: nginx:alpine
    container_name: phantom-headscale-ui-proxy
    ports:
      - "8086:80"      # Solo en IP Tailscale personal
    volumes:
      - ./config/nginx-ui.conf:/etc/nginx/conf.d/default.conf
```

### Configuración Nginx (`nginx-ui.conf`)

```nginx
server {
    listen 80;
    server_name _;

    # Panel Headscale Admin (goodieshq/headscale-admin)
    location /admin/ {
        proxy_pass http://headscale:8080/web/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API Headscale
    location /api/ {
        proxy_pass http://headscale:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Health check
    location /health {
        proxy_pass http://headscale:8080/health;
    }
}
```

### Binding Privado y Publicación Externa

| Capa | Detalle |
|------|---------|
| **Binding Interno** | `100.71.200.103:8086` (IP Tailscale personal) |
| **Reverse Proxy Local** | Nginx Proxy Manager en Homelab → `http://100.71.200.103:8086` |
| **Túnel Externo** | Cloudflare Tunnel (`phantom-headscale.midominio.com`) |
| **SSL/TLS** | Certificado Cloudflare (automático) |
| **Autenticación** | Cloudflare Access + OTP (Email/Pin) |
| **Acceso Final** | `https://phantom-headscale.midominio.com/admin/` |

**Ventajas:**
- ✅ Sin CORS issues (mismo origen `/admin` + `/api`)
- ✅ Sin HTTP en claro expuesto a Internet
- ✅ Autenticación fuerte (Cloudflare Access OTP)
- ✅ Panel accesible solo con Tailscale + OTP

---

## 6. Flujo de Datos Completo

```
┌─────────┐     10s/Eventos     ┌──────────┐     ┌──────────────────┐
│ Sonda   │────────────────────►│ FastAPI  │────►│ PostgreSQL       │
│ Sniffer │    Telemetría JSON  │ :8000    │     │ Maestro (wal)    │
│ Honeypot│    Eventos          │ /api/v1/ │     │ wal_level=replica│
└─────────┘                     │ telemetria│     └────────┬─────────┘
                                │ honeypot  │              │ Streaming
                                └──────────┘              ▼ Replication
                                                           ▼
                                                  ┌──────────────────┐
                                                  │ PostgreSQL       │
                                                  │ Esclavo (backup) │
                                                  └──────────────────┘
                                                  
          ┌─────────┐     Inferencia ML      ┌──────────┐     
          │ Alerta  │◄───────────────────────│ FastAPI  │     
          │ >=0.80  │   modelo_phantom.pkl   │ :8000    │     
          └─────────┘  (scikit-learn)        └──────────┘     
```

---

## 7. Verificación y Auditoría de Red

### Comandos de Verificación Rápida

```bash
# 1. Verificar túnel WireGuard activo
tailscale ping -c 3 100.64.0.1

# 2. Verificar aislamiento lateral (DEBE FALLAR)
ping -c 3 -W 2 100.64.0.4    # Otra sonda → 100% packet loss
nc -zv -w 3 100.64.0.4 22    # → Connection timed out

# 3. Verificar acceso Norte-Sur (DEBE FUNCIONAR)
nc -zv 100.64.0.1 8000       # FastAPI → succeeded
nc -zv 100.64.0.1 5432       # PostgreSQL → succeeded

# 3. Verificar que SSH a Central está BLOQUEADO
nc -zv -w 3 100.64.0.1 22    # → Connection timed out
```

### Comandos Headscale para Auditoría

```bash
# Ver ACLs aplicadas
docker exec phantom-headscale headscale acls get | jq '.acls[] | select(.action=="accept")'

# Ver nodos y tags
docker exec phantom-headscale headscale nodes list --tags

# Ver preauthkeys
docker exec phantom-headscale headscale preauthkeys list

# Verificar tag:sonda en nodo
docker exec phantom-headscale headscale nodes get -i <node_id> | grep tag
```
