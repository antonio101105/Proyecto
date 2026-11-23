"""
PHANTOM Backend API — FastAPI
Endpoints:
- GET /health
- POST /api/v1/telemetria (sniffer ventanas 10s)
- POST /api/v1/honeypot (reporter de honeypots)

Arquitectura:
- Corre en oracle-master (100.64.0.1) via network_mode: "service:ts-phantom"
- Base de datos: PostgreSQL 16 Maestro (localhost:5432, mismo network namespace)
- Modelo ML: modelo_phantom.joblib (scikit-learn RandomForest)
- Inferencia en tiempo real para alertas con confidence >= 0.80
"""

import os
import logging
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, text, Column, BigInteger, String, DateTime, Integer, Real, Boolean, JSON, func
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.exc import SQLAlchemyError
import joblib
import numpy as np

# Configuración desde variables de entorno
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://phantom:phantom_secret@localhost:5432/phantom")
MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/modelo_phantom.joblib")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("phantom-api")

# ============================================================
# Base de Datos - SQLAlchemy
# ============================================================
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Modelos SQLAlchemy (mapeo a tablas creadas en 01-init.sql)
class TelemetriaRed(Base):
    __tablename__ = "telemetria_red"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sonda_id = Column(String(64), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    ip_origen = Column(INET, nullable=False, index=True)
    paquetes = Column(BigInteger, nullable=False)
    bytes_totales = Column(BigInteger, nullable=False)
    puertos_distintos = Column(Integer, nullable=False)
    ttl_promedio = Column(Real)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

class AlertaHoneypot(Base):
    __tablename__ = "alertas_honeypot"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sonda_id = Column(String(64), nullable=False, index=True)
    servicio = Column(String(64), nullable=False)
    ip_atacante = Column(INET, nullable=False, index=True)
    puerto_destino = Column(Integer, nullable=False)
    detalle = Column(JSONB, nullable=False)
    confidence = Column(Real)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    processed = Column(Boolean, default=False)

class HoneypotEvento(Base):
    __tablename__ = "honeypot_eventos"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sonda_id = Column(String(64), nullable=False, index=True)
    servicio = Column(String(64), nullable=False)
    ip_atacante = Column(INET, nullable=False)
    puerto_destino = Column(Integer, nullable=False)
    evento_tipo = Column(String(32), nullable=False)
    detalle = Column(JSONB, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

# Crear tablas (idempotente - 01-init.sql ya las crea)
def init_db():
    Base.metadata.create_all(bind=engine)

# Modelos Pydantic (validación de entrada)
class TelemetriaIn(BaseModel):
    sonda_id: str = Field(..., min_length=1, max_length=64)
    ip_origen: str
    paquetes: int = Field(..., ge=0)
    bytes_totales: int = Field(..., ge=0)
    puertos_distintos: int = Field(..., ge=0)
    ttl_promedio: Optional[float] = Field(None, ge=0, le=255)

class TelemetriaBatchIn(BaseModel):
    telemetria: List[TelemetriaIn]

class HoneypotEventIn(BaseModel):
    sonda_id: str = Field(..., min_length=1, max_length=64)
    servicio: str = Field(..., min_length=1, max_length=64)
    ip_atacante: str
    puerto_destino: int = Field(..., ge=1, le=65535)
    detalle: dict

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    database: str
    model_loaded: bool

# Modelo ML global (cargado en lifespan)
ml_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global ml_model
    init_db()
    if os.path.exists("/app/models/modelo_phantom.joblib"):
        try:
            ml_model = joblib.load("/app/models/modelo_phantom.joblib")
            logger.info("Modelo ML cargado: %s", type(ml_model).__name__)
        except Exception as e:
            logger.warning("No se pudo cargar modelo: %s", e)
    else:
        logger.warning("Modelo no encontrado en /app/models/modelo_phantom.joblib")
    yield

app = FastAPI(
    title="PHANTOM Backend API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/health", response_model=HealthResponse)
async def health(request: Request, db: Session = Depends(get_db)):
    """Health check para Docker y monitoreo"""
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow(),
        database=db_status,
        model_loaded=ml_model is not None
    )

@app.post("/api/v1/telemetria", status_code=202)
async def recibir_telemetria(
    batch: TelemetriaBatchIn,
    db: Session = Depends(get_db)
):
    """
    Recibe telemetría de red de sondas (ventanas de 10s)
    Payload: {"telemetria": [{"sonda_id": "...", "ip_origen": "...", "paquetes": 100, ...}]}
    """
    try:
        now = datetime.utcnow()
        objects = []
        for t in batch.telemetria:
            obj = TelemetriaRed(
                sonda_id=t.sonda_id,
                timestamp=now,
                ip_origen=t.ip_origen,
                paquetes=t.paquetes,
                bytes_totales=t.bytes_totales,
                puertos_distintos=t.puertos_distintos,
                ttl_promedio=t.ttl_promedio
            )
            objects.append(obj)
        
        db.add_all(objects)
        db.commit()
        logger.info("Telemetría recibida: %d registros de %d sondas", len(objects), len(set(t.sonda_id for t in batch.telemetria)))
        return {"status": "accepted", "count": len(objects)}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Error guardando telemetría: %s", e)
        raise HTTPException(500, "Database error")

@app.post("/api/v1/honeypot", status_code=202)
async def recibir_honeypot(
    event: HoneypotEventIn,
    db: Session = Depends(get_db)
):
    """
    Recibe eventos de honeypots (reporter.py de sondas)
    Payload: {"sonda_id": "...", "servicio": "hp-ilo4", "ip_atacante": "...", "puerto_destino": 443, "detalle": {...}}
    """
    try:
        # Guardar evento raw
        evento = HoneypotEvento(
            sonda_id=event.sonda_id,
            servicio=event.servicio,
            ip_atacante=event.ip_atacante,
            puerto_destino=event.puerto_destino,
            evento_tipo=event.detalle.get("evento_tipo", "unknown"),
            detalle=event.detalle,
            timestamp=datetime.utcnow()
        )
        db.add(evento)
        
        # Evaluar con modelo ML si existe
        confidence = None
        if ml_model is not None:
            try:
                features = np.array([[
                    event.detalle.get("paquetes", 0),
                    event.detalle.get("bytes", 0),
                    event.detalle.get("puertos_distintos", 0),
                    event.puerto_destino
                ]])
                confidence = float(ml_model.predict_proba(features)[0][1])
            except Exception as e:
                logger.warning("Error en inferencia ML: %s", e)
        
        # Si confianza >= 0.80, crear alerta
        alerta = None
        if confidence is not None and confidence >= 0.80:
            alerta = AlertaHoneypot(
                sonda_id=event.sonda_id,
                servicio=event.servicio,
                ip_atacante=event.ip_atacante,
                puerto_destino=event.puerto_destino,
                detalle=event.detalle,
                confidence=confidence,
                timestamp=datetime.utcnow()
            )
            db.add(alerta)
            logger.warning("ALERTA generada: sonda=%s ip=%s confidence=%.2f", 
                          event.sonda_id, event.ip_atacante, confidence)
        
        db.commit()
        return {"status": "accepted", "alert_generated": alerta is not None, "confidence": confidence}
    except SQLAlchemyError as e:
        db.rollback()
        logger.error("Error guardando honeypot: %s", e)
        raise HTTPException(500, "Database error")

# Endpoints de consulta
@app.get("/api/v1/telemetria")
async def listar_telemetria(
    sonda_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(TelemetriaRed).order_by(TelemetriaRed.timestamp.desc())
    if sonda_id:
        query = query.filter(TelemetriaRed.sonda_id == sonda_id)
    return query.limit(limit).all()

@app.get("/api/v1/honeypot")
async def listar_honeypot(
    sonda_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(HoneypotEvento).order_by(HoneypotEvento.timestamp.desc())
    if sonda_id:
        query = query.filter(HoneypotEvento.sonda_id == sonda_id)
    return query.limit(limit).all()

@app.get("/api/v1/alertas")
async def listar_alertas(
    sonda_id: Optional[str] = None,
    min_confidence: float = 0.0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AlertaHoneypot).filter(AlertaHoneypot.confidence >= min_confidence)
    if sonda_id:
        query = query.filter(AlertaHoneypot.sonda_id == sonda_id)
    return query.order_by(AlertaHoneypot.timestamp.desc()).limit(limit).all()
