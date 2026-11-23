#!/usr/bin/env python3
"""
PHANTOM Firewall Redirect - Aplica redirecciones de firewall
cuando la confianza del modelo ML >= 0.80
"""

import os
import time
import logging
import requests
import subprocess
from typing import Optional

SONDA_ID = os.getenv("SONDA_ID", "sonda-1")
API_URL = os.getenv("API_CENTRAL_URL", "http://100.64.0.1:8000")
CONFIDENCE_THRESHOLD = 0.80

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("phantom-firewall")


def verificar_alertas() -> bool:
    """Consultar API para alertas con confianza >= umbral"""
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
                logger.warning("Alerta nueva: %s (confidence=%.2f)", ip_atacante, alert.get("confidence", 0))
                aplicar_redirección(ip_atacante)
        
        return len(alerts) > 0
    except Exception as e:
        logger.error("Error consultando alertas: %s", e)
        return False


def aplicar_redirección(ip_atacante: str):
    """Aplicar reglas de firewall para redirigir tráfico malicioso al honeypot"""
    try:
        # Agregar regla iptables: redirigir tráfico de la IP al honeypot iLO4
        cmd = [
            "iptables", "-A", "PREROUTING", 
            "-t", "nat", 
            "-s", ip_atacante, 
            "-p", "tcp", 
            "-j", "REDIRECT", 
            "--to-ports", "443"
        ]
        
        # Verificar si la regla ya existe
        verify_cmd = [
            "iptables", "-C", "PREROUTING",
            "-t", "nat",
            "-s", ip_atacante,
            "-p", "tcp",
            "-j", "REDIRECT",
            "--to-ports", "443"
        ]
        
        result = subprocess.run(verify_cmd, capture_output=True, text=True)
        if result.returncode == 1:  # Regla no existe
            subprocess.run(cmd, capture_output=True, text=True)
            logger.info("Redirección aplicada para %s -> honeypot iLO4 (puerto 443)", ip_atacante)
        else:
            logger.info("Redirección ya existe para %s", ip_atacante)
    except Exception as e:
        logger.error("Error aplicando redirección: %s", e)


def main():
    logger.info("PHANTOM Firewall Redirect iniciado: sonda=%s umbral=%.2f", SONDA_ID, CONFIDENCE_THRESHOLD)
    
    while True:
        verificar_alertas()
        time.sleep(30)  # Verificar cada 30 segundos


if __name__ == "__main__":
    main()
