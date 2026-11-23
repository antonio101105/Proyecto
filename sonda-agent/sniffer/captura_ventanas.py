#!/usr/bin/env python3
"""
PHANTOM Sniffer - Captura de tráfico en ventanas de 10 segundos
Envía telemetría agregada a la API central.
"""

import os
import time
import threading
import logging
import requests
from datetime import datetime, timezone
from typing import Dict, List, Tuple

# Config
SONDA_ID = os.getenv("SONDA_ID", "sonda-1")
API_URL = os.getenv("API_CENTRAL_URL", "http://100.64.0.1:8000")
INTERFACE = os.getenv("INTERFACE", "eth0")
WINDOW_SECONDS = int(os.getenv("WINDOW_SECONDS", "10"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("phantom-sniffer")

class WindowTracker:
    """Tracker de ventanas de 10s para tráfico de red"""
    
    def __init__(self, window_seconds: int = 10):
        self.window_seconds = window_seconds
        self.current_window: Dict[str, Dict] = {}
        self.window_start: float = time.time()
        self.lock = threading.Lock()
    
    def record_packet(self, ip_origen: str, ip_destino: str, paquete: int, bytes_: int, puerto: int, ttl: int):
        """Registrar paquete en la ventana actual"""
        with self.lock:
            # Rotar ventana si pasó el tiempo
            if time.time() - self.window_start >= self.window_seconds:
                self._rotate_window()
            
            # Agregar a ventana actual
            if ip_origen not in self.current_window:
                self.current_window[ip_origen] = {
                    "paquetes": 0,
                    "bytes": 0,
                    "puertos_distintos": set(),
                    "ttl_sum": 0,
                    "ttl_count": 0
                }
            
            entry = self.current_window[ip_origen]
            entry["paquetes"] += paquete
            entry["bytes"] += bytes_
            entry["puertos_distintos"].add(puerto)
            entry["ttl_sum"] += ttl
            entry["ttl_count"] += 1
    
    def _rotate_window(self):
        """Rotar ventana y enviar agregados"""
        logger.info("Rotando ventana de %ds - %d IPs únicas", self.window_seconds, len(self.current_window))
        
        telemetria = []
        for ip_origen, data in self.current_window.items():
            ttl_prom = data["ttl_sum"] / max(data["ttl_count"], 1)
            telemetria.append({
                "sonda_id": SONDA_ID,
                "ip_origen": ip_origen,
                "paquetes": data["paquetes"],
                "bytes_totales": data["bytes"],
                "puertos_distintos": len(data["puertos_distintos"]),
                "ttl_promedio": round(ttl_prom, 2)
            })
        
        self._send_telemetria(telemetria)
        
        # Reset
        self.current_window = {}
        self.window_start = time.time()
    
    def _send_telemetria(self, telemetria: List[Dict]):
        """Enviar telemetría a API central"""
        if not telemetria:
            return
        
        try:
            resp = requests.post(
                f"{API_URL}/api/v1/telemetria",
                json={"telemetria": telemetria},
                timeout=5
            )
            logger.info("Telemetría enviada: %d registros -> %s", len(telemetria), resp.status_code)
        except Exception as e:
            logger.error("Error enviando telemetría: %s", e)


def main():
    tracker = WindowTracker(window_seconds=WINDOW_SECONDS)
    logger.info("PHANTOM Sniffer iniciado: sonda=%s ventana=%ds api=%s", SONDA_ID, WINDOW_SECONDS, API_URL)
    
    # Loop principal
    try:
        while True:
            # Aquí se integraría Scapy o libpcap para capturar paquetes
            # Por ahora, simulamos con datos de ejemplo para testing
            time.sleep(1)
            
            # Simulación de paquetes (reemplazar con captura real)
            import random
            ip_origen = f"192.168.{random.randint(0,254)}.{random.randint(1,254)}"
            ip_destino = f"192.168.{random.randint(0,254)}.{random.randint(1,254)}"
            paquete = random.randint(1, 100)
            bytes_ = random.randint(64, 1500)
            puerto = random.choice([80, 443, 22, 8080, 53, 123, 3389])
            ttl = random.randint(32, 128)
            
            tracker.record_packet(ip_origen, ip_destino, paquete, bytes_, puerto, ttl)
    except KeyboardInterrupt:
        logger.info("Cerrando...")
        tracker._rotate_window()


if __name__ == "__main__":
    main()
