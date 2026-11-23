# HPE iLO Honeypot

Honeypot que replica la interfaz web del **HPE iLO5 Gen10** (ProLiant DL380 Gen10). Sirve el HTML/CSS/JS/imágenes del iLO real e inyecta vulnerabilidades de propósito: **SQLi en el login**, **XSS reflejado** y respuestas falsas ante inyecciones. Todo queda logueado en SQLite.

---

## Características

- **Réplica literal** del iLO HPE (logo, banner, fondo, tipografía, form de login real)
- **SQLi** en el campo de login (interpolación cruda en query)
- **XSS reflejado** en el nombre de sesión del dashboard
- **Respuesta falsa** (error de DB simulado 500) cuando detecta un payload SQLi, para que el atacante no sepa qué funciona
- **Logueo completo** a SQLite: IP, credenciales, query cruda, tipo de payload (sqli/xss/clean), User-Agent, Referer, timing

---

## Requisitos

- Docker 20+
- Docker Compose 2+
- Puerto 443 libre (o edita `docker-compose.yml` para otro puerto)

---

## Instalación y Despliegue

### 1. Clonar el repositorio

```bash
git clone git@github.com:antonio101105/Proyecto.git
cd Proyecto/honeypot
```

### 2. Levantar con Docker Compose

```bash
docker compose up -d --build
```

Esto:
- Construye la imagen (Python 3.11 + Flask + certificado auto-firmado)
- Crea el volumen `./data` para SQLite persistente
- Expone HTTPS en el puerto **443**

### 3. Acceder al honeypot

Abre en el navegador:
```
https://<IP_DEL_SERVIDOR>:443
```

> **Nota:** El certificado es auto-firmado. El navegador mostrará una advertencia; acepta y continúa. Esto es normal en el honeypot.

---

## Cambiar el puerto

Si el 443 está ocupado, edita `docker-compose.yml`:

```yaml
ports:
  - "8443:443"  # Host:8443 → Contenedor:443
```

Y accede a `https://<IP>:8443`.

---

## Estructura del proyecto

```
honeypot/
├── app.py                 # Flask: rutas + vulns + logging SQLite
├── Dockerfile             # python:3.11-slim + Flask + cert auto-firmado
├── docker-compose.yml     # Puerto 443, volumen ./data
├── .gitignore
├── LICENSE
├── README.md
├── honeypot.db            # SQLite (se crea al arrancar, ignorado por git)
├── certs/
│   ├── cert.pem           # Certificado auto-firmado (se genera en build)
│   └── key.pem            # Clave privada (se genera en build)
├── data/
│   ├── .gitkeep
│   └── honeypot.db        # SQLite persistente (ignorado por git)
└── ilo_files/             # Recursos del iLO real (HTML/CSS/JS/imágenes)
    ├── index.html         # Wrapper principal (iframe a login.html)
    ├── html/
    │   ├── login.html     # Carga login_box.html
    │   └── login_box.html # Form de login real (inyección vulnerable)
    ├── css/
    │   ├── eov.css        # Estilos principales iLO
    │   └── jquery-ui.css
    ├── js/
    │   ├── iLO.js         # Lógica iLO (preSignIn, toggleEnabled, signIn)
    │   ├── jquery.js
    │   ├── jquery-ui.js
    │   ├── json2.js
    │   └── jquery.eventsource.js
    ├── images/
    │   ├── hpe_pri_grn_rev_rgb.svg   # Logo HPE
    │   ├── login_image_web.jpg       # Fondo banner derecho
    │   ├── login_image.jpg
    │   ├── hpe_logo.svg
    │   └── x.gif
    ├── alt/css/style.css
    └── lang/en/strings.js
```

---

## Vulnerabilidades (de propósito)

| Vuln | Endpoint | Payload ejemplo | Comportamiento |
|------|----------|-----------------|----------------|
| **SQLi** | `POST /login` | `admin' OR 1=1--` | Query cruda ejecutada en SQLite; **respuesta falsa 500** (error DB simulado) para engañar al atacante |
| **XSS reflejado** | `POST /session` | `<script>alert(1)</script>` | Refleja sin escape en dashboard |
| **Login válido** | `POST /login` | `admin` / `admin` | Autentica y redirige a dashboard |

> **Importante:** La query SQL **se ejecuta realmente** (vulnerable a propósito). Si el payload `OR 1=1` encuentra la fila `admin`/`admin`, autentica (302). Los demás payloads SQLi reciben un **error 500 falso** que imita un fallo de BD, para que el atacante no distinga qué payload "funciona".

---

## Consultar capturas (logs)

```bash
# Ver intentos de login (últimos 20)
sqlite3 data/honeypot.db "SELECT ts,ip,user,payload,outcome FROM attempts ORDER BY id DESC LIMIT 20;"

# Ver inputs reflejados (XSS, session names, etc.)
sqlite3 data/honeypot.db "SELECT ts,ip,field,value,payload FROM inputs ORDER BY id DESC LIMIT 20;"
```

### Esquema de tablas

```sql
CREATE TABLE attempts (
  id INTEGER PRIMARY KEY,
  ts TEXT,           -- ISO8601 UTC
  ip TEXT,           -- IP del atacante
  user TEXT,         -- username enviado
  pwd TEXT,          -- password enviado
  raw TEXT,          -- query SQL cruda ejecutada
  payload TEXT,      -- sqli | xss | clean
  ua TEXT,           -- User-Agent
  referer TEXT,      -- Referer
  dur_ms REAL,       -- duración del login en ms
  outcome TEXT       -- authenticated | failed | error
);

CREATE TABLE inputs (
  id INTEGER PRIMARY KEY,
  ts TEXT,
  ip TEXT,
  field TEXT,        -- session_name | vm_path | power_action
  value TEXT,        -- valor crudo enviado
  payload TEXT,      -- sqli | xss | clean
  ua TEXT
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  password TEXT
);
-- Seed: admin / admin
```

---

## Detener y limpiar

```bash
# Detener (mantiene data/)
docker compose down

# Detener y borrar volúmenes (¡borra la BD!)
docker compose down -v

# Ver logs
docker compose logs -f
```

---

## Desarrollo / Test local

```bash
# Modo interactivo (ver logs en terminal)
docker compose up

# Rebuild tras cambios en app.py
docker compose up -d --build

# Ejecutar tests manuales
# SQLi → 500 falso
curl -sk -X POST https://localhost/login -d "username=admin' OR 1=1--&password=x"
# Limpio → 401
curl -sk -X POST https://localhost/login -d "username=bob&password=nope"
# XSS
curl -sk -c /tmp/c -X POST https://localhost/login -d "username=admin&password=admin"
curl -sk -b /tmp/c -X POST https://localhost/session -d 'name=<script>alert(1)</script>'
```

---

## Seguridad / Uso responsable

Este proyecto es un **honeypot defensivo** para capturar intentos de ataque en tu propia red.

- Solo expónlo donde tengas control y donde la captura de payloads sea el objetivo declarado.
- **No** lo apuntes a iLO/servidores reales; corre en una IP propia.
- El certificado auto-firmado es **solo para el honeypot**; no lo uses en producción.
- Uso solo en entornos autorizados.

---

## Licencia

MIT — ver [LICENSE](LICENSE).