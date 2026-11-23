#!/usr/bin/env python3
"""
Evaluación del modelo PHANTOM en datos nuevos
"""

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score

MODEL_PATH = Path("../models/modelo_phantom.joblib")
DATA_PATH = Path("../../datasets/telemetria_limpia.csv")

def evaluar():
    if not MODEL_PATH.exists():
        print("Modelo no encontrado. Ejecuta entrenar.py primero.")
        return
    
    if not DATA_PATH.exists():
        print("Dataset no encontrado.")
        return
    
    pipeline = joblib.load(MODEL_PATH)
    df = pd.read_csv(DATA_PATH)
    
    feature_cols = [c for c in df.columns if c not in ['es_malicioso', 'sonda_id', 'timestamp', 'ip_origen', 'ip_atacante']]
    X = df[feature_cols].fillna(0)
    y = df['es_malicioso'] if 'es_malicioso' in df.columns else np.zeros(len(df))
    
    y_pred = pipeline.predict(X)
    y_proba = pipeline.predict_proba(X)[:, 1]
    
    print("=== Evaluación en dataset completo ===")
    if 'es_malicioso' in df.columns:
        print(classification_report(y, y_pred))
        print(f"ROC-AUC: {roc_auc_score(y, y_proba):.4f}")
    
    # Estadísticas de predicción
    print(f"\nPredicciones maliciosas: {(y_pred == 1).sum()} / {len(y_pred)} ({(y_pred == 1).mean():.2%})")
    print(f"Confianza media (maliciosos): {y_proba[y_pred == 1].mean():.3f}" if (y_pred == 1).any() else "Sin predicciones maliciosas")

if __name__ == "__main__":
    evaluar()
