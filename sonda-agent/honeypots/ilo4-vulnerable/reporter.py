#!/usr/bin/env python3
"""
PHANTOM Honeypot Reporter - Envía eventos de honeypot a la API central
"""

import os
import time
import json
import logging
import requests
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Config
SONDA_ID = os.getenv("SONDA_ID", "sonda-1")
API_URL = os.getenv("API_CENTRAL_URL", "http://100.64.0.1:8000")
SERVICIO = "hp-ilo4"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("phantom-reporter")

class HoneypotReporter:
    """Reporta eventos de honeypot a la API central"""
    
    def __init__(self, sonda_id: str, api_url: str, servicio: str = "hp-ilo4"):
        self.sonda_id = sonda_id
        self.api_url = api_url
        self.servicio = servicio
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def report_login_attempt(
        self, 
        ip_atacante: str, 
        puerto_destino: int,
        username: str,
        password: str,
        success: bool,
        payload_type: str = "clean",
        raw_query: str = ""
    ):
        """Reportar intento de login"""
        detalle = {
            "evento_tipo": "login_attempt",
            "username": username,
            "password": password,
            "success": success,
            "payload_type": payload_type,
            "raw_query": raw_query,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self._send({
            "sonda_id": self.sonda_id,
            "servicio": self.servicio,
            "ip_atacante": ip_atacante,
            "puerto_destino": puerto_destino,
            "detalle": detalle
        })
    
    def report_command(self, ip_atacante: str, puerto_destino: int, comando: str):
        """Reportar comando ejecutado"""
        self._send({
            "sonda_id": self.sonda_id,
            "servicio": self.servicio,
            "ip_atacante": ip_atacante,
            "puerto_destino": puerto_destino,
            "detalle": {
                "evento_tipo": "command",
                "comando": comando,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        })
    
    def report_file_access(self, ip_atacante: str, puerto_destino: int, archivo: str, accion: str):
        """Reportar acceso a archivo"""
        self._send({
            "sonda_id": self.sonda_id,
            "servicio": self.servicio,
            "ip_atacante": ip_atacante,
            "puerto_destino": puerto_destino,
            "detalle": {
                "evento_tipo": "file_access",
                "archivo": archivo,
                "accion": accion,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        })
    
    def _send(self, payload: Dict):
        """Enviar payload a API central"""
        try:
            resp = requests.post(
                f"{self.api_url}/api/v1/honeypot",
                json=payload,
                timeout=5
            )
            if resp.status_code == 202:
                logger.info("Evento reportado: %s -> %s", self.servicio, resp.json())
            else:
                logger.warning("Error reportando: %s", resp.status_code)
        except Exception as e:
            logger.error("Error enviando reporte: %s", e)


# Función de integración para el honeypot iLO4
def crear_reporter() -> "HoneypotReporter":
    """Factory para crear reporter con variables de entorno"""
    return HoneypotReporter(
        sonda_id=os.getenv("SONDA_ID", "sonda-1"),
        api_url=os.getenv("API_CENTRAL_URL", "http://100.64.0.1:8000"),
        servicio="hp-ilo4"
    )


# Ejemplo de integración en app.py del honeypot
"""
# Al inicio de app.py:
import os
import sys
sys.path.append('/app')
from reporter import crear_reporter

reporter = crear_reporter()

# En login_post():
payload_type = classify(user, pwd)
reporter.report_login_attempt(
    ip_atacante=request.remote_addr,
    puerto_destino=443,
    username=user,
    password=pwd,
    success=(outcome == "authenticated"),
    payload_type=payload_type,
    raw_query=raw
)

# En set_session() para XSS:
reporter.report_command(
    ip_atacante=request.remote_addr,
    puerto_destino=443,
    comando=f"XSS en session_name: {name}"
)
"""

if __name__ == "__main__":
    # Test
    r = HoneypotReporter("sonda-1", "http://localhost:8000", "hp-ilo4")
    r.report_login_attempt("192.168.1.100", 443, "admin", "admin", True, "clean", "")
    print("Test completado")
