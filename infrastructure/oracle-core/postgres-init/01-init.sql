-- PHANTOM Database Initialization

-- Crear usuario replicator para streaming replication
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_secret';

-- Tabla de telemetría de red (recibida cada 10s de las sondas)
CREATE TABLE IF NOT EXISTS telemetria_red (
    id BIGSERIAL PRIMARY KEY,
    sonda_id VARCHAR(64) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_origen INET NOT NULL,
    paquetes BIGINT NOT NULL,
    bytes_totales BIGINT NOT NULL,
    puertos_distintos INTEGER NOT NULL,
    ttl_promedio REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_telemetria_sonda_timestamp 
    ON telemetria_red (sonda_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetria_ip_timestamp 
    ON telemetria_red (ip_origen, timestamp DESC);

-- Tabla de alertas de honeypots
CREATE TABLE IF NOT EXISTS alertas_honeypot (
    id BIGSERIAL PRIMARY KEY,
    sonda_id VARCHAR(64) NOT NULL,
    servicio VARCHAR(64) NOT NULL,  -- hp-ilo4, opencanary-ssh, etc.
    ip_atacante INET NOT NULL,
    puerto_destino INTEGER NOT NULL,
    detalle JSONB NOT NULL,
    confidence REAL,  -- 0.0 - 1.0 (resultado del modelo ML)
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_alertas_sonda_timestamp 
    ON alertas_honeypot (sonda_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_ip_timestamp 
    ON alertas_honeypot (ip_atacante, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_confidence 
    ON alertas_honeypot (confidence DESC) WHERE confidence >= 0.8;

-- Tabla de telemetría de honeypots (intento de login, comandos, etc.)
CREATE TABLE IF NOT EXISTS honeypot_eventos (
    id BIGSERIAL PRIMARY KEY,
    sonda_id VARCHAR(64) NOT NULL,
    servicio VARCHAR(64) NOT NULL,
    ip_atacante INET NOT NULL,
    puerto_destino INTEGER NOT NULL,
    evento_tipo VARCHAR(32) NOT NULL,  -- login_attempt, command, file_access, etc.
    detalle JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_honeypot_sonda_timestamp 
    ON honeypot_eventos (sonda_id, timestamp DESC);

-- Función para limpieza automática (retención 90 días)
CREATE OR REPLACE FUNCTION limpiar_datos_antiguos()
RETURNS void AS $$
BEGIN
    DELETE FROM telemetria_red WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM alertas_honeypot WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM honeypot_eventos WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Grant para replicator
GRANT SELECT ON ALL TABLES IN SCHEMA public TO replicator;
