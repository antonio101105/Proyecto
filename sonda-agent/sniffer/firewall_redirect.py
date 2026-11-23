#!/usr/bin/env python3
"""
PHANTOM Firewall Redirect - Aplica redirecciones de firewall iptables
cuando la confianza del modelo ML >= 0.80 para tráfico malicioso.

ARQUITECTURA:
- Corre en sonda (100.64.0.x) dentro de contenedor con network_mode: host
- Consultan API central cada 30s para alertas nuevas con confidence >= 0.80
- Aplica reglas iptables PREROUTING nat: redirigir tráfico malicioso al honeypot iLO4 (puerto 443)

FLUJO:
1. Honeypot iLO4 detecta ataque → reporter envía evento a API central
2. API central ejecuta modelo ML → confidence >= 0.80 → crea alerta
3. firewall_redirect.py detecta alerta → aplica iptables nat PREROUTING
4. Tráfico del atacante se redirige al honeypot (puerto 443)

REQUISITOS:
- Capabilities: NET_ADMIN, NET_RAW
- network_mode: host
- Permisos root para iptables

VARIABLES DE ENTORNO:
- SONDA_ID: ID de la sonda
- API_CENTRAL_URL: URL API central
- CONFIDENCE_THRESHOLD: Umbral de confianza (default: 0.80)
"""

import os
import time
import logging
import requests
import subprocess
from typing import Optional

# Config desde variables de entorno
SONDA_ID = os.getenv("SONDA_ID", "sonda-1")
API_URL = os.getenv("API_CENTRAL_URL", "http://100.64.0.1:8000")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.80"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("phantom-firewall")


def verificar_alertas() -> bool:
    """Consultar API central para alertas nuevas con confidence >= umbral"""
    try:
        resp = requests.get(
            f"{API_URL}/api/v1/alertas",
            params={"sonda_id": SONDA_ID, "min_confidence": CONFIDENCE_THRESHOLD},
            timeout=5
        )
        alerts = resp.json()
        
        for alert in alerts:
            if not alert.get("processed", False):
                ip_atacante = alert.get("ip_atacante")
                confidence = alert.get("confidence", 0)
                logger.warning("Alerta nueva: %s (confidence=%.2f)", ip_atacante, confidence)
                aplicar_redireccion(ip_atacante)
        
        return len(alerts) > 0
    except Exception as e:
        logger.error("Error consultando alertas: %s", e)
        return False


def aplicar_redireccion(ip_atacante: str):
    """
    Aplicar reglas iptables para redirigir tráfico malicioso al honeypot.
    
    Estrategia:
    - Tabla nat, cadena PREROUTING
    - Redirigir todo tráfico TCP de la IP atacante al puerto 443 (honeypot iLO4)
    - Idempotente: verifica si la regla ya existe antes de agregar
    """
    try:
        # Regla: redirigir tráfico de la IP atacante al honeypot iLO4 (puerto 443)
        cmd = [
            "iptables",
            "-t", "nat",
            "-A", "PREROUTING",
            "-s", ip_atacante,
            "-p", "tcp",
            "-j", "REDIRECT",
            "--to-ports", "443"
        ]
        
        # Verificar si la regla ya existe (idempotencia)
        verify_cmd = [
            "iptables",
            "-t", "nat",
            "-C", "PREROUTING",
            "-s", ip_atacante,
            "-p", "tcp",
            "-j", "REDIRECT",
            "--to-ports", "443"
        ]
        
        result = subprocess.run(verify_cmd, capture_output=True, text=True)
        if result.returncode == 1:  # Regla no existe
            subprocess.run(cmd, capture_output=True, text=True)
            logger.info("Redirección aplicada: %s -> honeypot iLO4 (puerto 443)", ip_atacante)
        else:
            logger.info("Redirección ya existe para %s", ip_atacante)
    except Exception as e:
        logger.error("Error aplicando redirección: %s", e)


def verificar_permisos():
    """Verificar que el contenedor tiene permisos NET_ADMIN"""
    try:
        result = subprocess.run(["iptables", "-L", "-n"], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error("No se pueden ejecutar iptables. Verificar NET_ADMIN capability")
            return False
        return True
    except Exception as e:
        logger.error("Error verificando iptables: %s", e)
        return False


def main():
    logger.info("PHANTOM Firewall Redirect iniciado: sonda=%s umbral=%.2f api=%s", 
                SONDA_ID, CONFIDENCE_THRESHOLD, API_URL)
    
    if not verificar_permisos():
        logger.error("Permiso NET_ADMIN requerido. Ejecutar con --cap-add=NET_ADMIN")
        return
    
    # Bucle principal: verificar alertas cada 30s
    while True:
        verificar_alertas()
        time.sleep(30)


if __name__ == "__main__":
    main()
