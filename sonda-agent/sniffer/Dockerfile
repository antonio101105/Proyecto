# PHANTOM Sniffer - Captura de tráfico y redirección de firewall
# Requiere: NET_ADMIN, NET_RAW capabilities
# Corre con network_mode: host para acceso a interfaz física
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema para Scapy
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpcap0.8 libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY captura_ventanas.py firewall_redirect.py ./

# El sniffer corre como captura_ventanas.py por defecto
# El firewall-redirect corre como firewall_redirect.py (comando en docker-compose)
CMD ["python", "captura_ventanas.py"]
