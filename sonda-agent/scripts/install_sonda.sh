#!/bin/bash
# PHANTOM - Instalación automatizada de sonda
# Uso: sudo ./install_sonda.sh --authkey <PREAUTHKEY> --hostname <sonda-N> [--api-url <URL>] [--skip-tailscale] [--skip-docker]
#
# REQUISITOS:
# - Linux con systemd (Debian/Ubuntu/CentOS/RHEL)
# - Acceso root (sudo)
# - PreAuth Key de Headscale CON tag:sonda (generada con: docker exec phantom-headscale headscale preauthkeys create --tags tag:sonda --reusable --expiration 72h)
#
# El script:
# 1. Instala Docker + Docker Compose plugin (si no existen)
# 2. Instala Tailscale (script oficial)
# 3. Conecta a Headscale con PreAuth Key (--accept-routes=false --accept-dns=false)
# 3. Verifica tag:sonda en tailscale status
# 4. Clona/actualiza repo PHANTOM en /opt/phantom
# 5. Crea .env con SONDA_ID y API_CENTRAL_URL
# 6. Levanta servicios: docker compose up -d --build en sonda-agent/

set -euo pipefail

AUTHKEY=""
HOSTNAME=""
API_URL="http://100.64.0.1:8000"
SKIP_TAILSCALE=false
SKIP_DOCKER=false

usage() {
    cat <<EOF
Uso: $0 --authkey <PREAUTHKEY> --hostname <NOMBRE> [OPCIONES]

Requeridos:
  --authkey    Preauthkey de Headscale CON tag:sonda (hex continuo, sin puntos)
  --hostname   Nombre del nodo (ej. sonda-1, sonda-edge-01)

Opcionales:
  --api-url    URL API central (default: http://100.64.0.1:8000)
  --skip-tailscale  Saltar instalación/config Tailscale
  --skip-docker     Saltar instalación Docker
  -h, --help        Mostrar esta ayuda
EOF
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --authkey) AUTHKEY="$2"; shift 2 ;;
        --hostname) HOSTNAME="$2"; shift 2 ;;
        --api-url) API_URL="$2"; shift 2 ;;
        --skip-tailscale) SKIP_TAILSCALE=true; shift ;;
        --skip-docker) SKIP_DOCKER=true; shift ;;
        -h|--help) usage ;;
        *) echo "Opción desconocida: $1"; usage ;;
    esac
done

[[ -z "$AUTHKEY" ]] && { echo "ERROR: --authkey requerido"; usage; }
[[ -z "$HOSTNAME" ]] && { echo "ERROR: --hostname requerido"; usage; }

echo "=== PHANTOM Sonda Installation ==="
echo "Hostname: $HOSTNAME"
echo "API Central: $API_URL"
echo ""

# 1. Instalar Docker si no existe
if [[ "$SKIP_DOCKER" == false ]]; then
    if ! command -v docker &>/dev/null; then
        echo ">>> Instalando Docker..."
        curl -fsSL https://get.docker.com | sudo bash
        sudo usermod -aG docker $USER
        echo ">>> Docker instalado. Reinicia sesión o ejecuta 'newgrp docker'"
    else
        echo ">>> Docker ya instalado"
    fi
    
    if ! command -v docker compose &>/dev/null && ! docker compose version &>/dev/null; then
        echo ">>> Instalando Docker Compose plugin..."
        sudo apt update && sudo apt install -y docker-compose-plugin
    fi
fi

# 2. Instalar Tailscale
if [[ "$SKIP_TAILSCALE" == false ]]; then
    if ! command -v tailscale &>/dev/null; then
        echo ">>> Instalando Tailscale..."
        curl -fsSL https://tailscale.com/install.sh | sudo bash
    else
        echo ">>> Tailscale ya instalado"
    fi
    
    echo ">>> Conectando a Headscale..."
    sudo tailscale up \
        --authkey="$AUTHKEY" \
        --hostname="$HOSTNAME" \
        --accept-routes=false \
        --accept-dns=false
    
    echo ">>> Esperando conexión a Headscale..."
    for i in {1..30}; do
        if tailscale ip -4 2>/dev/null | grep -q "100\."; then
            echo "✓ Conectado a Tailnet"
            break
        fi
        sleep 1
    done
    
    # Verificar tag:sonda (CRÍTICO para ACLs)
    if tailscale status --json | jq -e '.Self.Tags[] | select(. == "tag:sonda")' >/dev/null; then
        echo "✓ Tag 'tag:sonda' presente"
    else
        echo "⚠ ADVERTENCIA: Tag 'tag:sonda' NO detectado. Regenera preauthkey con --tags tag:sonda"
    fi
fi

REPO_DIR="/opt/phantom"
if [[ ! -d "$REPO_DIR" ]]; then
    echo ">>> Clonando repositorio PHANTOM..."
    sudo mkdir -p /opt
    sudo git clone git@github.com:antonio101105/Proyecto.git "$REPO_DIR"
    sudo chown -R $USER:$USER "$REPO_DIR"
else
    echo ">>> Repo ya existe, actualizando..."
    cd "$REPO_DIR" && git pull origin main
fi

# Crear .env para docker-compose
ENV_FILE="$REPO_DIR/sonda-agent/.env"
cat > "$ENV_FILE" <<EOF
SONDA_ID=$HOSTNAME
API_CENTRAL_URL=$API_URL
EOF
echo ">>> Variables de entorno guardadas en $ENV_FILE"

echo ">>> Levantando servicios de la sonda..."
cd "$REPO_DIR/sonda-agent"
docker compose up -d --build

echo ""
echo "=== Instalación completada ==="
echo "Hostname: $HOSTNAME"
echo "IP Tailnet: $(tailscale ip -4 2>/dev/null || echo 'No disponible')"
echo "Servicios: docker compose ps"
echo ""
echo "Para verificar aislamiento (CRÍTICO):"
echo "  ping -c 1 100.64.0.2    # Debe fallar (100% loss)"
echo "  nc -vz 100.64.0.1 8000  # Debe funcionar"
echo "  nc -vz 100.64.0.1 5432  # Debe funcionar"
