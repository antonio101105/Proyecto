#!/usr/bin/env python3
"""
PHANTOM Sniffer - Captura de tráfico en ventanas de 10 segundos
Envía telemetría agregada a la API central PHANTOM.

ARQUITECTURA:
- Corre en sonda (100.64.0.x) dentro de contenedor con network_mode: host
- Captura paquetes en interfaz física (eth0 por defecto)
- Agrega métricas en ventanas de 10 segundos
- Envía POST /api/v1/telemetria a API central (100.64.0.1:8000)

MÉTRICAS POR VENTANA (por IP origen):
- paquetes: total de paquetes
- bytes_totales: total de bytes
- puertos_distintos: set de puertos destino únicos
- ttl_promedio: promedio de TTL de paquetes

VARIABLES DE ENTORNO:
- SONDA_ID: ID de la sonda (ej. sonda-1)
- API_CENTRAL_URL: URL API central (default: http://100.64.0.1:8000)
- INTERFACE: Interfaz de red a capturar (default: eth0)
- WINDOW_SECONDS: Duración de ventana en segundos (default: 10)

REQUISITOS:
- Capabilities: NET_ADMIN, NET_RAW
- network_mode: host (para acceso a interfaz física)
- Librería: scapy (captura paquetes)
"""

import os
import time
import threading
import logging
import requests
from datetime import datetime, timezone
from typing import Dict, List, Tuple
from collections import defaultdict

# Config desde variables de entorno
SONDA_ID = os.getenv("SONDA_ID", "sonda-1")
API_URL = os.getenv("API_CENTRAL_URL", "http://100.64.0.1:8000")
INTERFACE = os.getenv("INTERFACE", "eth0")
WINDOW_SECONDS = int(os.getenv("WINDOW_SECONDS", "10"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("phantom-sniffer")


class WindowTracker:
    """
    Tracker de ventanas deslizantes de tráfico de red.
    
    Mantiene agregados por IP origen durante una ventana de tiempo.
    Al expirar la ventana, envía los agregados a la API central.
    """
    
    def __init__(self, window_seconds: int = 10):
        self.window_seconds = window_seconds
        # Estructura: {ip_origen: {"paquetes": int, "bytes": int, "puertos": set(), "ttl_sum": int, "ttl_count": int}}
        self.current_window: Dict[str, Dict] = defaultdict(lambda: {
            "paquetes": 0,
            "bytes": 0,
            "puertos": set(),
            "ttl_sum": 0,
            "ttl_count": 0
        })
        self.window_start: float = time.time()
        self.lock = threading.Lock()
    
    def record_packet(self, ip_origen: str, paquete: int, bytes_: int, puerto: int, ttl: int):
        """Registrar un paquete en la ventana actual"""
        with self.lock:
            # Verificar si debemos rotar la ventana
            if time.time() - self.window_start >= self.window_seconds:
                self._rotate_window()
            
            # Agregar a ventana actual
            entry = self.current_window[ip_origen]
            entry["paquetes"] += 1
            entry["bytes"] += bytes_
            entry["puertos"].add(puerto)
            entry["ttl_sum"] += ttl
            entry["ttl_count"] += 1
    
    def _rotate_window(self):
        """Rotar ventana: enviar agregados y resetear"""
        if not self.current_window:
            self.window_start = time.time()
            return
        
        logger.info("Rotando ventana de %ds - %d IPs únicas", self.window_seconds, len(self.current_window))
        
        telemetria = []
        for ip_origen, data in self.current_window.items():
            ttl_prom = data["ttl_sum"] / max(data["ttl_count"], 1)
            telemetria.append({
                "sonda_id": os.getenv("SONDA_ID", "sonda-1"),
                "ip_origen": ip_origen,
                "paquetes": data["paquetes"],
                "bytes_totales": data["bytes"],
                "puertos_distintos": len(data["puertos"]),
                "ttl_promedio": round(data["ttl_sum"] / max(data["ttl_count"], 1), 2)
            })
        
        self._send_telemetria(telemetria)
        
        # Reset para nueva ventana
        self.current_window.clear()
        self.window_start = time.time()
    
    def _send_telemetria(self, telemetria: List[Dict]):
        """Enviar telemetría agregada a API central"""
        if not telemetria:
            return
        
        try:
            resp = requests.post(
                f"{os.getenv('API_CENTRAL_URL', 'http://100.64.0.1:8000')}/api/v1/telemetria",
                json={"telemetria": telemetria},
                timeout=5
            )
            logger.info("Telemetría enviada: %d registros -> %s", len(telemetria), resp.status_code)
        except Exception as e:
            logger.error("Error enviando telemetría: %s", e)


def packet_callback(pkt):
    """Callback de Scapy para cada paquete capturado"""
    try:
        if pkt.haslayer('IP'):
            ip_layer = pkt['IP']
            ip_origen = ip_layer.src
            ip_destino = ip_layer.dst
            ttl = ip_layer.ttl
            bytes_ = len(pkt)
            
            # Puerto destino si es TCP/UDP
            puerto = 0
            if pkt.haslayer('TCP'):
                puerto = pkt['TCP'].dport
            elif pkt.haslayer('UDP'):
                puerto = pkt['UDP'].dport
            
            tracker.record_packet(
                ip_origen=ip_layer.src,
                paquete=1,
                bytes_=bytes_,
                puerto=puerto,
                ttl=ttl
            )
    except Exception:
        pass  # Silenciar errores de parsing


def main():
    global tracker
    tracker = WindowTracker(window_seconds=WINDOW_SECONDS)
    logger.info("PHANTOM Sniffer iniciado: sonda=%s ventana=%ds interface=%s api=%s", 
                os.getenv("SONDA_ID", "sonda-1"), WINDOW_SECONDS, INTERFACE, os.getenv("API_CENTRAL_URL"))
    
    # Verificar permisos
    if os.geteuid() != 0:
        logger.error("Se requieren privilegios root (NET_RAW/NET_ADMIN). Ejecutar con --cap-add=NET_RAW,NET_ADMIN")
        return
    
    # Importar Scapy aquí para evitar error si no está instalado
    try:
        from scapy.all import sniff, IP, TCP, UDP
    except ImportError:
        logger.error("Scapy no instalado. Instalar con: pip install scapy")
        return
    
    logger.info("Iniciando captura en interfaz %s...", INTERFACE)
    
    try:
        # Captura continua con callback
        sniff(
            iface=INTERFACE,
            prn=packet_callback,
            store=False,  # No almacenar paquetes en memoria
            filter="ip"   # Solo paquetes IP
        )
    except PermissionError:
        logger.error("Permisos insuficientes. Ejecutar con --cap-add=NET_RAW,NET_ADMIN y network_mode: host")
    except Exception as e:
        logger.error("Error en captura: %s", e)


if __name__ == "__main__":
    main()
