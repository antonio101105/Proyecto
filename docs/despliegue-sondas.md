# Guía de Despliegue de Sondas PHANTOM

## Requisitos previos en el nodo sonda

- Linux (Debian/Ubuntu/CentOS/RHEL)
- Docker 20.10+ y Docker Compose 2.x
- Acceso a internet (para descargar imágenes)
- Clave de pre-autorización (preauthkey) de Headscale con tag `tag:sonda`

## 1. Preparar el entorno

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version
docker compose version
```

## 2. Instalación automatizada con install_sonda.sh

```bash
cd sonda-agent/scripts
chmod +x install_sonda.sh

# Instalación completa
sudo ./install_sonda.sh \
  --authkey <PREAUTHKEY_DE_HEADSCALE> \
  --hostname sonda-1 \
  --api-url http://100.64.0.1:8000
```

### Opciones del script

| Parámetro | Descripción | Requerido |
|-----------|-------------|-----------|
| `--authkey` | Preauthkey de Headscale con `tag:sonda` | Sí |
| `--hostname` | Nombre del nodo (ej. sonda-1) | Sí |
| `--api-url` | URL de la API central (default: http://100.64.0.1:8000) | No |
| `--skip-tailscale` | Saltar instalación de Tailscale (si ya está) | No |
| `--skip-docker` | Saltar instalación de Docker | No |

## 3. Verificar conexión a Headscale

```bash
# Ver IP Tailnet asignada
tailscale ip -4
# Debe mostrar 100.64.0.x

# Ver estado
tailscale status
# Debe mostrar conectado a "phantom-headscale"

# Verificar tags
tailscale status --json | jq '.Self.Tags'
# Debe incluir "tag:sonda"
```

## 4. Auditar aislamiento (CRÍTICO)

```bash
# 1. No debe poder hacer ping a otras sondas
ping -c 1 100.64.0.2
# → Debe fallar (Destination Host Unreachable / timeout)

# 2. No debe poder conectar a puertos de otras sondas
nc -vz 100.64.0.2 8000
# → Connection refused / timeout

# 3. DEBE poder conectar a oracle-master
nc -vz 100.64.0.1 8000
# → Connection to 100.64.0.1 8000 port [tcp/*] succeeded!

nc -vz 100.64.0.1 5432
# → Connection to 100.64.0.1 5432 port [tcp/*] succeeded!
```

## 5. Levantar servicios de la sonda

```bash
cd /opt/phantom/sonda-agent  # o donde hayas clonado el repo
docker compose up -d

# Verificar estado
docker compose ps
# Debería mostrar: ilo4-vulnerable, opencanary, sniffer → Up
```

### Verificar servicios

```bash
# iLO4 honeypot (puerto 443 HTTPS)
curl -sk https://localhost:443/login | grep -q "iLO" && echo "OK"

# OpenCanary (puertos 22, 21, 445, etc.)
docker compose logs opencanary

# Sniffer
docker compose logs sniffer
# Debe mostrar: "Enviando telemetría a http://100.64.0.1:8000/api/v1/telemetria"
```

## 6. Verificar reporte a API central

```bash
# Ver logs del reporter en honeypot
docker compose logs -f ilo4-vulnerable
# Debe mostrar: "POST /api/v1/honeypot → 200"

# Ver en base de datos central
curl http://100.64.0.1:8000/api/v1/honeypot | jq .
```

## 7. Verificar aislamiento periódico (cron)

```bash
# Añadir a crontab (cada hora)
crontab -e
# Añadir:
0 * * * * /opt/phantom/sonda-agent/scripts/audit_aislamiento.sh >> /var/log/phantom-aislamiento.log 2>&1
```

### Contenido de audit_aislamiento.sh

```bash
#!/bin/bash
# /opt/phantom/sonda-agent/scripts/audit_aislamiento.sh

LOG="/var/log/phantom-aislamiento.log"
SondaIP=$(tailscale ip -4 | head -1)
CENTRAL="100.64.0.1"

echo "$(date) - Auditoría aislamiento desde $SondaIP" >> $LOG

# Test 1: No ping a otras sondas (100.64.0.2-10)
for i in {2..10}; do
  if ping -c 1 -W 1 "100.64.0.$i" >/dev/null 2>&1; then
    echo "ALERTA: Ping a 100.64.0.$i EXITOSO (debería fallar)" >> $LOG
  fi
done

# Test 2: Conectividad a central
for port in 8000 5432; do
  if nc -z -w 2 $CENTRAL $port; then
    echo "OK: Puerto $port en $CENTRAL accesible" >> $LOG
  else
    echo "ALERTA: Puerto $port en $CENTRAL NO accesible" >> $LOG
  fi
done
```

## 8. Solución de problemas

| Problema | Diagnóstico | Solución |
|----------|-------------|----------|
| `tailscale ip` no muestra 100.64.x.x | No conectado a Headscale | `sudo tailscale up --authkey=<key>` |
| `tag:sonda` no aparece | Preauthkey sin tag | Regenerar preauthkey con `--tags tag:sonda` |
| Ping a otra sonda funciona | ACLs no aplicadas | Verificar `headscale acls get` en controlador |
| Puerto 8000 no accesible | Firewall / contenedor caído | `docker compose ps` + `docker compose logs` |
| Honeypot no reporta | Variable `API_CENTRAL_URL` mal | Verificar `docker compose exec ilo4-vulnerable env` |

## Checklist de validación post-despliegue

- [ ] `tailscale ip` muestra 100.64.0.x
- [ ] `tailscale status` muestra conectado
- [ ] Tag `tag:sonda` visible en `tailscale status --json`
- [ ] Ping a otra sonda **falla**
- [ ] `nc -vz 100.64.0.1 8000` **funciona**
- [ ] `nc -vz 100.64.0.1 5432` **funciona**
- [ ] `docker compose ps` muestra 3 servicios Up
- [ ] Honeypot iLO4 responde en 443
- [ ] Logs muestran envío a `/api/v1/honeypot` y `/api/v1/telemetria`
- [ ] Auditoría cron configurada
