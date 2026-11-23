#!/usr/bin/env python3
"""
Limpieza de CSV para PHANTOM ML Pipeline

Elimina contaminación por tráfico SSH de administración (puerto 22 desde IPs conocidas
de administradores) y normaliza las características para entrenamiento.
"""

import pandas as pd
import numpy as np
import argparse
import sys

# IPs de administración conocidas (ejemplos - ajustar según entorno)
IPS_ADMIN = [
    "10.0.0.1",      # Gateway admin
    "192.168.1.100", # Workstation admin
    "100.64.0.1",    # oracle-master
]

PUERTOS_ADMIN = [22, 23, 3389, 5900]  # SSH, Telnet, RDP, VNC

def limpiar_csv(input_path: str, output_path: str):
    df = pd.read_csv(input_path)
    print(f"Registros originales: {len(df)}")
    
    # 1. Eliminar tráfico SSH de administración conocido
    mask_admin = (
        (df['puerto_destino'].isin(PUERTOS_ADMIN)) & 
        (df['ip_origen'].isin(IPS_ADMIN))
    )
    df_limpio = df[~mask_admin].copy()
    print(f"Eliminados {mask_admin.sum()} registros de admin SSH/RDP")
    
    # 2. Normalizar IPs (convertir a numérico para ML)
    def ip_to_int(ip):
        try:
            parts = list(map(int, ip.split('.')))
            return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
        except:
            return 0
    
    if 'ip_origen' in df_limpio.columns:
        df_limpio['ip_origen_num'] = df_limpio['ip_origen'].apply(ip_to_int)
    if 'ip_atacante' in df_limpio.columns:
        df_limpio['ip_atacante_num'] = df_limpio['ip_atacante'].apply(ip_to_int)
    
    # 3. Feature engineering
    if 'bytes_totales' in df_limpio.columns and 'paquetes' in df_limpio.columns:
        df_limpio['bytes_por_paquete'] = df_limpio['bytes_totales'] / (df_limpio['paquetes'] + 1)
    
    # 3. Eliminar columnas no numéricas para ML
    cols_drop = ['ip_origen', 'ip_atacante', 'timestamp', 'sonda_id']
    df_ml = df_limpio.drop(columns=[c for c in cols_drop if c in df_limpio.columns], errors='ignore')
    
    # 4. One-hot encoding para columnas categóricas si existen
    categorical_cols = df_ml.select_dtypes(include=['object']).columns
    if len(categorical_cols) > 0:
        df_ml = pd.get_dummies(df_ml, columns=categorical_cols, drop_first=True)
    
    # 4. Rellenar NaN
    df_ml = df_ml.fillna(0)
    
    # 5. Guardar
    df_limpio.to_csv(output_path, index=False)
    print(f"Registros limpios: {len(df_limpio)}")
    print(f"Guardado en: {output_path}")
    
    return df_limpio

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="CSV de entrada")
    parser.add_argument("--output", required=True, help="CSV limpio de salida")
    args = parser.parse_args()
    
    limpiar_csv(args.input, args.output)
