#!/usr/bin/env python3
"""
Entrenamiento del modelo PHANTOM — Clasificación de tráfico malicioso

Entrena un modelo scikit-learn (RandomForest) para detectar tráfico anómalo/malicioso
basado en telemetría de red y eventos de honeypot.
"""

import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings('ignore')

DATA_PATH = Path("../../datasets/telemetria_limpia.csv")
MODEL_OUTPUT = Path("../models/modelo_phantom.joblib")
METRICS_OUTPUT = Path("../models/metricas.json")

def cargar_datos():
    """Cargar y preparar datos"""
    # Si no existe dataset, generar sintético para demo
    if not Path("../../datasets/telemetria_limpia.csv").exists():
        print("Generando dataset sintético para demo...")
        return generar_datos_sinteticos()
    
    df = pd.read_csv("../../datasets/telemetria_limpia.csv")
    
    # Target: es_malicioso (1) vs benigno (0)
    # Heurística: puerto_destino en puertos sensibles + bytes_por_paquete anómalo
    if 'es_malicioso' not in df.columns:
        df['es_malicioso'] = (
            (df['puerto_destino'].isin([22, 23, 21, 23, 25, 110, 143, 445, 3389, 5900, 1433, 3306, 5432])) |
            (df.get('bytes_por_paquete', 0) > 1500) |  # MTU anómalo
            (df.get('puertos_distintos', 0) > 20)
        ).astype(int)
    
    return df

def generar_datos_sinteticos(n=10000):
    """Genera datos sintéticos para demo"""
    np.random.seed(42)
    
    # Tráfico benigno (80%)
    n_benigno = int(n * 0.8)
    n_malicioso = n - n_benigno
    
    # Benigno: puertos altos, bytes normales, pocos puertos
    benigno = pd.DataFrame({
        'paquetes': np.random.poisson(50, n_benigno),
        'bytes_totales': np.random.normal(50000, 10000, n_benigno).clip(1000),
        'puertos_distintos': np.random.poisson(3, n_benigno),
        'ttl_promedio': np.random.normal(64, 5, n_benigno).clip(30, 128),
        'puerto_destino': np.random.choice([80, 443, 8080, 8443, 53, 123], n_benigno, p=[0.3, 0.3, 0.1, 0.1, 0.1, 0.1]),
        'bytes_por_paquete': np.random.normal(1000, 200, n_benigno).clip(100),
        'puertos_distintos': np.random.poisson(3, n_benigno),
        'es_malicioso': 0
    })
    
    # Malicioso: puertos sensibles, bytes anómalos, muchos puertos
    malicioso = pd.DataFrame({
        'paquetes': np.random.poisson(10, n_malicioso),
        'bytes_totales': np.random.exponential(1000, n_malicioso).clip(100),
        'puertos_distintos': np.random.poisson(15, n_malicioso) + 5,
        'ttl_promedio': np.random.normal(50, 15, n_malicioso).clip(10, 100),
        'puerto_destino': np.random.choice([22, 23, 21, 23, 25, 110, 143, 445, 3389, 5900, 1433, 3306, 5432], n_malicioso),
        'bytes_por_paquete': np.random.exponential(50, n_malicioso).clip(10),
        'puertos_distintos': np.random.poisson(20, n_malicioso) + 10,
        'es_malicioso': 1
    })
    
    df = pd.concat([benigno, malicioso], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Guardar dataset sintético
    Path("../../datasets").mkdir(parents=True, exist_ok=True)
    df.to_csv("../../datasets/telemetria_limpia.csv", index=False)
    print(f"Dataset sintético generado: {len(df)} registros")
    
    return df

def entrenar(df):
    """Entrenar modelo RandomForest"""
    
    # Preparar features y target
    feature_cols = [c for c in df.columns if c not in ['es_malicioso', 'sonda_id', 'timestamp', 'ip_origen', 'ip_atacante']]
    X = df[feature_cols].fillna(0)
    y = df['es_malicioso']
    
    print(f"Features: {len(feature_cols)} - {feature_cols}")
    print(f"Distribución target: {y.value_counts().to_dict()}")
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Pipeline con StandardScaler + RandomForest
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('rf', RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        ))
    ])
    
    # Entrenar
    print("Entrenando modelo...")
    pipeline.fit(X_train, y_train)
    
    # Evaluar
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]
    
    print("\n=== Classification Report ===")
    print(classification_report(y_test, y_pred))
    
    print("\n=== Confusion Matrix ===")
    cm = confusion_matrix(y_test, y_pred)
    print(cm)
    
    auc = roc_auc_score(y_test, y_proba)
    print(f"\nROC-AUC: {auc:.4f}")
    
    # Feature importance
    rf = pipeline.named_steps['rf']
    importances = pd.DataFrame({
        'feature': feature_cols,
        'importance': rf.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\n=== Top 10 Features ===")
    print(importances.head(10))
    
    # Guardar modelo
    MODEL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_OUTPUT)
    print(f"\nModelo guardado en: {MODEL_OUTPUT}")
    
    # Guardar métricas
    from sklearn.metrics import precision_recall_fscore_support
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary')
    
    metricas = {
        "accuracy": float((y_pred == y_test).mean()),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "roc_auc": float(auc),
        "feature_importance": importances.to_dict('records'),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "features": feature_cols
    }
    
    with open(METRICS_OUTPUT, 'w') as f:
        json.dump(metricas, f, indent=2)
    print(f"Métricas guardadas en: {METRICS_OUTPUT}")
    
    # Graficar curva ROC
    plt.figure(figsize=(8, 6))
    fpr, tpr, _ = roc_curve(y_test, y_proba)
    plt.plot(fpr, tpr, label=f'ROC curve (AUC = {auc:.3f})')
    plt.plot([0, 1], [0, 1], 'k--')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('ROC Curve - PHANTOM Model')
    plt.legend()
    plt.savefig("../models/roc_curve.png", dpi=150)
    plt.close()
    
    return pipeline

if __name__ == "__main__":
    print("=== PHANTOM ML Pipeline - Entrenamiento ===")
    df = cargar_datos()
    modelo = entrenar(df)
    print("\n=== Entrenamiento completado ===")
