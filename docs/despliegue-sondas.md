# Guía de Despliegue y Operación de Sondas PHANTOM

## 1. Requisitos Previos en el Nodo Sonda

- **SO**: Linux (Debian 11+/Ubuntu 22.04+/CentOS 8+/RHEL 8+)
- **Docker**: 20.10+ y Docker Compose 2.x (`docker compose` plugin)
- **Acceso a Internet**: Para descargar imágenes Docker
- **Clave de pre-autorización**: PreAuth Key de Headscale **con tag `tag:sonda`**

---

## 2. Diferencia Crítica: PreAuth Keys vs API Keys

> **⚠️ REGLA CRÍTICA ENCONTRADA EN PRODUCCIÓN**

| Tipo | Formato | Uso | Ejemplo |
|------|---------|-----|---------|
| **PreAuth Key** | Cadena hexadecimal continua (sin puntos) | `tailscale up --authkey=...` | `abcd1234ef567890...` |
| **API Key** | Con punto en medio | Panel `headscale-admin` | `tskey-abc123.def456ghi789` |

> **❌ ERROR COMÚN:** Usar API Key en `tailscale up --authkey` → **FALLA** con error de autenticación.
> **✅ CORRECTO:** Generar PreAuth Key con `--tags tag:sonda` (para el tag) y `--user phantom` (para el usuario) y usarla en `tailscale up`.

```bash
# Generar PreAuth Key correcta para sondas
docker exec phantom-headscale headscale preauthkeys create \
  --user phantom --expiration 24h --tags tag:sonda
```

---

## 2. Nomenclatura de Host

| Regla | Ejemplo Correcto | Incorrecto |
|--------|------------------|------------|
| Sin puntos | `sonda-1`, `sonda-edge-01` | `sonda.1`, `sonda.prod` |
| Minúsculas y guiones | `sonda-edge-01` | `SONDA-1`, `Sonda_1` |
| Único en la red | `sonda-1`, `sonda-2` | Duplicados |

> **Razón:** MagicDNS de Tailscale usa el hostname para DNS. Puntos causan problemas de resolución.

---

## 3. Instalación Automatizada con `install_sonda.sh`

```bash
cd sonda-agent/scripts
chmod +x install_sonda.sh

sudo ./install_sonda.sh \
  --authkey <PREAUTHKEY_DE_HEADSCALE> \
  --hostname sonda-1 \
  --api-url http://100.64.0.1:8000
```

### Opciones del Script

| Parámetro | Descripción | Requerido |
|-----------|-------------|-----------|
| `--authkey` | Preauthkey de Headscale con `tag:sonda` | **Sí** |
| `--hostname` | Nombre del nodo (ej. `sonda-1`) | **Sí** |
| `--api-url` | URL API central (default: `http://100.64.0.1:8000`) | No |
| `--skip-tailscale` | Saltar instalación/config Tailscale | No |
| `--skip-docker` | Saltar instalación Docker | No |

### Qué hace el script internamente

1. **Instala Docker** (si no existe) via `get.docker.com`
2. **Instala Docker Compose plugin** (`docker-compose-plugin`)
3. **Instala Tailscale** (script oficial)
4. **Conecta a Headscale**: `tailscale up --authkey=... --hostname=... --accept-routes=false --accept-dns=false`
5. **Verifica tag `tag:sonda`** en `tailscale status --json`
6. **Clona repo PHANTOM** en `/opt/phantom`
7. **Crea `.env`** con `SONDA_ID` y `API_CENTRAL_URL`
7. **Levanta servicios**: `docker compose up -d --build` en `sonda-agent/`

---

## 4. Verificación de Conexión a Headscale

```bash
# 1. Ver IP Tailnet asignada
tailscale ip -4
# Debe mostrar: 100.64.0.x

# 2. Ver estado completo
tailscale status
# Debe mostrar: "Connected to phantom-headscale"

# 3. Verificar tag:sonda (CRÍTICO)
tailscale status --json | jq '.Self.Tags[]'
# Debe incluir: "tag:sonda"

# 3b. Verificar rutas
tailscale status --json | jq '.Self.AllowedIPs'
# Debe incluir: "100.64.0.0/10"
```

---

## 5. Auditoría de Aislamiento (OBLIGATORIO POST-DESPLIEGUE)

> **REGLA DE ORO:** Si la auditoría falla, **NO pongas la sonda en producción**.

### 5.1 Test de Movimiento Lateral (DEBE FALLAR)

```bash
# 1. Ping a otra sonda (DEBE FALLAR)
ping -c 3 -W 2 100.64.0.4
# → DEBE DEVOLVER: 100% packet loss

# 2. TCP a otra sonda (DEBE FALLAR)
nc -zv -w 3 100.64.0.4 22
# → DEBE DEVOLVER: Connection timed out

nc -zv -w 3 100.64.0.4 8000
# → DEBE DEVOLVER: Connection timed out
```

### 5.2 Test de Acceso Norte-Sur (DEBE FUNCIONAR)

```bash
# 1. FastAPI (puerto 8000)
nc -zv 100.64.0.1 8000
# → DEBE DEVOLVER: Connection to 100.64.0.1 8000 port [tcp/*] succeeded!

# 2. PostgreSQL (puerto 5432)
nc -zv 100.64.0.1 5432
# → DEBE DEVOLVER: Connection to 100.64.0.1 5432 port [tcp/*] succeeded!
```

### 5.3 Verificar SSH a Central BLOQUEADO

```bash
nc -zv -w 3 100.64.0.1 22
# → DEBE DEVOLVER: Connection timed out
```

### 5.4 Script de Auditoría Automatizada

```bash
# Guardar como /opt/phantom/sonda-agent/scripts/audit_aislamiento.sh
#!/bin/bash
LOG="/var/log/phantom-aislamiento.log"
CENTRAL="100.64.0.1"

echo "$(date) - Auditoría desde $(tailscale ip -4)" >> $LOG

# Test lateral (debe fallar)
for i in {2..10}; do
  if ping -c 1 -W 1 "100.64.0.$i" >/dev/null 2>&1; then
    echo "ALERTA: Ping a 100.64.0.$i EXITOSO (debería fallar)" >> $LOG
  fi
done

# Test central (debe funcionar)
for port in 8000 5432; do
  if nc -z -w 2 $CENTRAL $port; then
    echo "OK: Puerto $port en $CENTRAL accesible" >> $LOG
  else
    echo "ALERTA: Puerto $port en $CENTRAL NO accesible" >> $LOG
  fi
done
```

**Configurar en crontab (cada hora):**
```bash
crontab -e
# 0 * * * * /opt/phantom/sonda-agent/scripts/audit_aislamiento.sh >> /var/log/phantom-aislamiento.log 2>&1
```

---

## 5. Levantar Servicios de la Sonda

```bash
cd /opt/phantom/sonda-agent
docker compose up -d --build

# Verificar estado
docker compose ps
# Debería mostrar: ilo4-vulnerable, opencanary, sniffer, firewall-redirect → Up
```

### Verificar Servicios Individuales

```bash
# iLO4 Honeypot (puerto 443 HTTPS)
curl -sk https://localhost:443/login | grep -q "iLO" && echo "OK: iLO4 UP"

# OpenCanary (puertos 22, 21, 445, etc.)
docker compose logs opencanary

# Sniffer (ventanas 10s)
docker compose logs sniffer
# Debe mostrar: "Enviando telemetría a http://100.64.0.1:8000/api/v1/telemetria"

# Firewall Redirect
docker compose logs firewall-redirect
# Debe mostrar: "Verificando alertas cada 30s"
```

---

## 6. Verificar Reporte a API Central

```bash
# Ver logs del reporter en honeypot iLO4
docker compose logs -f ilo4-vulnerable
# Debe mostrar: "Evento reportado: hp-ilo4 -> {'status': 'accepted'...}"

# Ver en base de datos central
curl http://100.64.0.1:8000/api/v1/honeypot | jq .

# Ver alertas generadas (confianza >= 0.80)
curl "http://100.64.0.1:8000/api/v1/alertas?min_confidence=0.80" | jq .
```

---

## 6. Limpieza de Estado al Re-registrar/Reemplazar Sonda

> **REGLA:** Si una máquina ya tuvo Tailscale configurado o su nodo fue borrado en Headscale, **limpiar estado completamente** antes de re-registrar.

```bash
# 1. Detener demonio Tailscale
sudo systemctl stop tailscaled

# 2. Borrar estado persistente
sudo rm -f /var/lib/tailscale/tailscaled.state

# 3. Reiniciar demonio
sudo systemctl start tailscaled

# 4. Re-registrar CON FORCE REAUTH
sudo tailscale up \
  --force-reauth \
  --login-server=http://82.70.74.120:8085 \
  --authkey=<NUEVA_PREAUTH_KEY> \
  --hostname=<NOMBRE> \
  --accept-routes=false

# 5. Verificar
tailscale ip -4
tailscale status --json | jq '.Self.Tags[]'
```

---

## 7. Verificación de Servicios Sonda

### Honeypot iLO4 (puerto 443)

```bash
# Test rápido
curl -sk https://localhost:443/login | grep -q "iLO" && echo "OK"

# Test SQLi → 500 falso
curl -sk -X POST https://localhost/login -d "username=admin' OR 1=1--&password=x" -o /dev/null -w "%{http_code}\n"
# → 500 (respuesta falsa)

# Test limpio → 401
curl -sk -X POST https://localhost/login -d "username=bob&password=nope" -o /dev/null -w "%{http_code}\n"
# → 401
```

### OpenCanary

```bash
# Ver logs
docker compose logs opencanary

# Test puertos
nc -zv localhost 22   # SSH
nc -zv localhost 21   # FTP
nc -zv localhost 445  # SMB
```

### Sniffer (ventanas 10s)

```bash
docker compose logs sniffer
# Debe mostrar cada 10s: "Enviando telemetría a http://100.64.0.1:8000/api/v1/telemetria"
```

### Firewall Redirect

```bash
docker compose logs firewall-redirect
# Debe mostrar: "Verificando alertas cada 30s"
```

---

## 7. Checklist de Validación Post-Despliegue

| ✅ Ítem | Verificación |
|--------|--------------|
| 1 | `tailscale ip` muestra `100.64.0.x` |
| 2 | `tailscale status` muestra conectado |
| 3 | Tag `tag:sonda` visible en JSON |
| 4 | Ping a otra sonda **falla** (100% loss) |
| 5 | `nc -vz 100.64.0.1 8000` **funciona** |
| 6 | `nc -vz 100.64.0.1 5432` **funciona** |
| 7 | `nc -vz 100.64.0.1 22` **falla** (timeout) |
| 8 | `docker compose ps` → 4 servicios Up |
| 9 | Honeypot iLO4 responde en 443 |
| 10 | Logs muestran envío a `/api/v1/telemetria` y `/api/v1/honeypot` |
| 11 | Auditoría cron configurada |

---

## 8. Solución de Problemas Comunes

| Problema | Diagnóstico | Solución |
|----------|-------------|----------|
| `tailscale ip` no muestra 100.64.x.x | No conectado a Headscale | `sudo tailscale up --authkey=<key>` |
| `tag:sonda` no aparece | Preauthkey sin tag | Regenerar: `--tags tag:sonda` |
| Ping a otra sonda funciona | ACLs no aplicadas | `docker exec phantom-headscale headscale acls get` |
| Puerto 8000 no accesible | Firewall / contenedor caído | `docker compose ps` + `logs` |
| Honeypot no reporta | Variable `API_CENTRAL_URL` mal | `docker compose exec ilo4-vulnerable env` |
| Sniffer no envía | Interfaz incorrecta | Verificar `INTERFACE=eth0` en `.env` |

---

## 9. Referencias

- [Arquitectura de Red Completa](arquitectura-red.md)
- [Comandos Headscale](comandos-headscale.md)
- [README Principal](../README.md)
