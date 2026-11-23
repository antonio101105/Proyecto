#!/usr/bin/env python3
"""
HPE iLO 4 Honeypot — Réplica literal del iLO HPE Gen10 + backend vulnerable + Reporter PHANTOM.

CARACTERÍSTICAS:
- Sirve archivos reales del iLO HPE (HTML/CSS/JS/imágenes extraídos de iLO real)
- SQLi en login (interpolación cruda en query SQLite)
- XSS reflejado en nombre de sesión (dashboard)
- Respuesta falsa 500 (error DB simulado) para payloads SQLi → engaña al atacante
- Reporter integrado → POST /api/v1/honeypot a API central PHANTOM
- Logging local en SQLite (attempts, inputs)

ARQUITECTURA:
- Corre en sonda (100.64.0.x) dentro de contenedor Docker
- Puerto 443 (HTTPS) expuesto en host
- Reporter envía a API central: POST http://100.64.0.1:8000/api/v1/honeypot
- Variables de entorno: SONDA_ID, API_CENTRAL_URL
"""

import os, re, secrets, sqlite3, time, functools
from datetime import datetime, timezone
from flask import Flask, request, redirect, session, render_template_string, send_from_directory, jsonify
from markupsafe import Markup, escape
import requests

BASE = os.path.dirname(os.path.abspath(__file__))
DB   = os.environ.get("DB",   os.path.join(BASE, "data/honeypot.db"))
CERT = os.environ.get("CERT", os.path.join(BASE, "certs/cert.pem"))
KEY  = os.environ.get("KEY",  os.path.join(BASE, "certs/key.pem"))
ILO_FILES = os.path.join(BASE, "ilo_files")

# Config Reporter PHANTOM
SONDA_ID = os.environ.get("SONDA_ID", "sonda-1")
API_CENTRAL_URL = os.environ.get("API_CENTRAL_URL", "http://100.64.0.1:8000")
SERVICIO = "hp-ilo4"

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# ---------- SQLite ----------
def get_db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def q(sql, args=()):
    c = get_db()
    try:
        yield from (r for r in c.execute(sql, args))
    finally:
        c.close()

def init_db():
    c = sqlite3.connect(DB)
    c.executescript("""
      CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY, username TEXT, password TEXT);
      CREATE TABLE IF NOT EXISTS attempts(
        id INTEGER PRIMARY KEY, ts TEXT, ip TEXT, user TEXT, pwd TEXT,
        raw TEXT, payload TEXT, ua TEXT, referer TEXT, dur_ms REAL,
        outcome TEXT);
      CREATE TABLE IF NOT EXISTS inputs(
        id INTEGER PRIMARY KEY, ts TEXT, ip TEXT, field TEXT, value TEXT,
        payload TEXT, ua TEXT);
      """)
    if not c.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        c.execute("INSERT INTO users(username,password) VALUES('admin','admin')")
    c.commit()
    c.close()

# ---------- Clasificación post-hoc (NO valida: la query SIEMPRE se ejecuta) ----------
SQLI = re.compile(r"('|\"|--|;|\bOR\b\s*\d|\bUNION\b|\bSELECT\b|\bDROP\b|\bSLEEP\s*\(|\bBENCHMARK\s*\(|INFORMATION_SCHEMA)", re.I)
XSS  = re.compile(r"(<\s*script|onerror\s*=|onload\s*=|javascript:|<\s*img|<\s*svg|document\.cookie)", re.I)

def classify(*vals):
    blob = " ".join(v for v in vals if v)
    out = []
    if SQLI.search(blob): out.append("sqli")
    if XSS.search(blob):  out.append("xss")
    return ",".join(out) if out else "clean"

def ts():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")

def log_attempt(user, pwd, raw, outcome, dur_ms):
    c = sqlite3.connect(DB)
    c.execute("""INSERT INTO attempts(ts,ip,user,pwd,raw,payload,ua,referer,dur_ms,outcome)
                 VALUES(?,?,?,?,?,?,?,?,?,?)""",
      (ts(), request.remote_addr, user, pwd, raw, classify(user,pwd),
       request.headers.get("User-Agent",""), request.headers.get("Referer",""),
       dur_ms, outcome))
    c.commit()
    c.close()

def log_input(field, value):
    c = sqlite3.connect(DB)
    c.execute("""INSERT INTO inputs(ts,ip,field,value,payload,ua) VALUES(?,?,?,?,?,?)""",
      (ts(), request.remote_addr, field, value, classify(value),
       request.headers.get("User-Agent","")))
    c.commit()
    c.close()

# ---------- Reporter PHANTOM ----------
def report_to_central(event_type: str, **kwargs):
    """Reportar evento a la API central PHANTOM (fire-and-forget, timeout 3s)"""
    try:
        payload = {
            "sonda_id": os.environ.get("SONDA_ID", "sonda-1"),
            "servicio": "hp-ilo4",
            "ip_atacante": request.remote_addr,
            "puerto_destino": 443,
            "detalle": {
                "evento_tipo": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **kwargs
            }
        }
        requests.post(
            f"{os.environ.get('API_CENTRAL_URL', 'http://100.64.0.1:8000')}/api/v1/honeypot",
            json=payload,
            timeout=3
        )
    except Exception:
        pass  # Silenciar errores de reporte (no bloquear honeypot)

def authed(f):
    @functools.wraps(f)
    def w(*a, **k):
        if "user" not in session:
            return redirect("/login")
        return f(*a, **k)
    return w

# ---------- Servir archivos del iLO reales ----------
@app.route("/<path:filename>")
def ilo_files(filename):
    # login_box.html - inyectar form vulnerable a SQLi
    if filename == "login_box.html" or filename == "html/login_box.html":
        with open(os.path.join(ILO_FILES, "html/login_box.html"), "r") as f:
            content = f.read()
        # Cambiar nombre de campos para que Flask los reciba
        content = content.replace(
            'name=usernameInput id=usernameInput',
            'name=username id=usernameInput'
        )
        content = content.replace(
            'name=passwordInput id=passwordInput',
            'name=password id=passwordInput'
        )
        # Hacer el botón un submit real
        content = content.replace(
            'id=ID_LOGON name=ID_LOGON type=button onclick="\n  return signIn(), !1;\n"',
            'id=ID_LOGON name=ID_LOGON type=submit'
        )
        # Añadir método y action al form
        content = content.replace(
            '<form id=login-form',
            '<form id=login-form method=post action=/login'
        )
        # Quitar el onkeypress que impide Enter (para que el form funcione)
        content = content.replace(
            'onkeypress="\n  return checkEnter(event);\n"',
            ''
        )
        return Markup(content)

    # Servir cualquier otro archivo del iLO
    if os.path.exists(os.path.join(ILO_FILES, filename)):
        return send_from_directory(ILO_FILES, filename)

    # Fallback para html/login.html
    if filename == "html/login.html":
        return send_from_directory(os.path.join(ILO_FILES, "html"), "login.html")

    return "Not found", 404

# Endpoint del iLO para preSignIn - habilita los campos del login
@app.route("/json/login_session")
def login_session():
    return jsonify({
        "version": "2.13",
        "cn": "192.168.0.167",
        "server_name": "SERVIDOR",
        "secjmp": True,
        "local_enabled": True,
        "ldap_enabled": False,
        "kerberos_enabled": False,
        "license_directory_auth": False,
        "security_message_enabled": False,
        "default_lang": "en",
        "accept_lang": "en",
        "langs": ["en"],
        "login_delay": 0
    })

# Rutas principales
@app.route("/")
def index():
    return redirect("/dashboard" if "user" in session else "/login")

@app.route("/login", methods=["GET"])
def login_get():
    if "user" in session:
        return redirect("/dashboard")
    return send_from_directory(ILO_FILES, "index.html")

@app.route("/login", methods=["POST"])
def login_post():
    t0 = time.time()
    user = request.form.get("username", "")
    pwd = request.form.get("password", "")
    # VULNERABLE a propósito: interpolación directa (SQLi)
    raw = f"SELECT * FROM users WHERE username='{user}' AND password='{pwd}'"
    outcome = "failed"
    try:
        rows = list(q(raw))
        if rows:
            session["user"], session["display_name"] = user, user
            outcome = "authenticated"
    except sqlite3.Error:
        outcome = "error"
    log_attempt(user, pwd, raw, outcome, (time.time()-t0)*1000)
    
    # Reportar intento de login a API central
    report_to_central("login_attempt", username=user, password=pwd, success=(outcome=="authenticated"), 
                      payload_type=classify(user,pwd), raw_query=raw)

    # Detectar si es un intento de SQLi/XSS → dar respuesta falsa (el atacante no distingue)
    payload_type = classify(user, pwd)
    if payload_type == "sqli" or payload_type == "xss,sqli":
        # Simular error de base de datos para engañar al atacante
        error_html = """<!DOCTYPE html>
<html><head><title>Database Error</title></head>
<body style="font-family:Arial;background:#f1f4f7;padding:40px">
<div style="max-width:600px;margin:auto;background:#fff;border:1px solid #ccc;padding:20px">
<h2 style="color:#c00;font-size:14px">Database Connection Error</h2>
<pre style="background:#f8f9fa;padding:12px;font-size:11px;color:#555;white-space:pre-wrap">
SQLite3.OperationalError: no such table: users
File "iLO/db/connector.py", line 42, in _query
    cursor.execute(query)
iLO.exceptions.DatabaseError: Unable to connect to database
</pre>
<p style="font-size:11px;color:#666;margin-top:16px">
<i>Hint: This error indicates a SQL injection attempt. The query was blocked by the WAF.</i>
</p>
</div>
</body></html>"""
        return error_html, 500

    if payload_type == "xss":
        with open(os.path.join(ILO_FILES, "index.html"), "r") as f:
            index_content = f.read()
        error_div = f'<div style="background:#fff0f0;border:1px solid #f00;color:#c00;padding:8px;margin:20px;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100">Invalid user name or password.</div>'
        return Markup(index_content + error_div + f'<script>{user}</script>'), 401

    if outcome == "authenticated":
        return redirect("/dashboard")

    # Login limpio → error normal
    with open(os.path.join(ILO_FILES, "index.html"), "r") as f:
        index_content = f.read()
    error_div = '<div style="background:#fff0f0;border:1px solid #f00;color:#c00;padding:8px;margin:20px;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100">Invalid user name or password.</div>'
    return Markup(index_content + error_div), 401

# Dashboard - réplica del iLO
@app.route("/dashboard")
@authed
def dashboard():
    display_name = session.get("display_name", "")
    power_msg = session.get("power_msg", "")
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset=utf-8>
<title>HPE iLO - Overview</title>
<style>
body{{background:#f1f4f7;font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0}}
.masthead{{background:linear-gradient(to right,#036 0%,#036 5%,#7591AC 69%,#036 100%);
 color:#fff;padding:10px;display:flex;justify-content:space-between}}
.masthead a{{color:#fff;text-decoration:underline}}
nav{{background:#fff;border-right:1px solid #839CB4;padding:10px;width:200px;float:left}}
nav a{{display:block;padding:5px;color:#000;text-decoration:none}}
nav a.active{{background:#9CF;font-weight:700}}
main{{margin-left:200px;padding:15px}}
.card{{border:1px solid #839CB4;background:#fff;margin-bottom:10px}}
.card h3{{background:linear-gradient(to bottom,#D5DEE6 0%,#839CB4 100%);
 padding:5px;font-size:12px;font-weight:700;color:#036;margin:0}}
.kv{{padding:10px;font-size:11px;line-height:2}}
.kv label{{color:#555;display:inline-block;width:100px}}
.badge{{background:#c8f7d4;color:#080;padding:1px 6px;border-radius:8px;font-size:10px}}
button{{background:#036;color:#fff;border:0;padding:6px 16px;cursor:pointer;font-size:11px}}
button:hover{{background:#047}}
input{{border:1px solid #7591ac;padding:4px;width:200px;font-size:11px}}
</style>
</head>
<body>
<div class=masthead>
 <span>HPE iLO5 - ProLiant DL380 Gen10</span>
 <span>{session["user"]} | <a href=/logout>Logout</a></span>
</div>
<nav>
 <a class=active href=/dashboard>Overview</a>
 <a href=/virtual_media>Virtual Media</a>
 <a href=#>Power</a>
 <a href=#>Health</a>
</nav>
<main>
 <h2>Overview</h2>
 <div class=card>
  <h3>System Status</h3>
  <div class=kv>
   <div><label>Server</label>ProLiant DL380 Gen10 <span class=badge>ON</span></div>
   <div><label>iLO</label>{session["user"]} | IPMI 2.0</div>
   <div><label>Session</label><b>{display_name}</b></div>
   <div><label>Network</label>192.168.0.167 / 255.255.255.0</div>
  </div>
 </div>
 <div class=card>
  <h3>Power Control</h3>
  <div style="padding:10px">
   <form method=post action=/power>
    <button type=submit name=action value=on>Power On</button>
    <button type=submit name=action value=restart>Restart</button>
    <button type=submit name=action value=off style="background:#b33">Power Off</button>
   </form>
   <div style="margin-top:8px;color:#666">{power_msg}</div>
  </div>
 </div>
 <div class=card>
  <h3>Session Name</h3>
  <div style="padding:10px">
   <form method=post action=/session>
    <input name=name value="{display_name}">
    <button type=submit>Save</button>
   </form>
  </div>
 </div>
</main>
</body>
</html>"""
    return html

@app.route("/session", methods=["POST"])
@authed
def set_session():
    name = request.form.get("name", "")
    session["display_name"] = name
    log_input("session_name", name)
    # Reportar XSS si hay payload
    if classify(name) != "clean":
        report_to_central("xss_reflected", field="session_name", value=name)
    return redirect("/dashboard")

@app.route("/virtual_media")
@authed
def vmedia():
    path = session.get("vm_path", "ubuntu-22.04.iso")
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset=utf-8>
<title>HPE iLO - Virtual Media</title>
<style>
body{{background:#f1f4f7;font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0}}
.masthead{{background:linear-gradient(to right,#036 0%,#036 5%,#7591AC 69%,#036 100%);
 color:#fff;padding:10px;display:flex;justify-content:space-between}}
nav{{background:#fff;border-right:1px solid #839CB4;padding:10px;width:200px;float:left}}
nav a{{display:block;padding:5px;color:#000;text-decoration:none}}
nav a.active{{background:#9CF;font-weight:700}}
main{{margin-left:200px;padding:15px}}
.card{{border:1px solid #839CB4;background:#fff;margin-bottom:10px}}
.card h3{{background:linear-gradient(to bottom,#D5DEE6 0%,#839CB4 100%);
 padding:5px;font-size:12px;font-weight:700;color:#036;margin:0}}
.vm-item{{display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid #bac8d5}}
.badge{{background:#c8f7d4;color:#080;padding:1px 6px;border-radius:8px;font-size:10px}}
input{{border:1px solid #7591ac;padding:4px;width:300px;font-size:11px}}
button{{background:#036;color:#fff;border:0;padding:6px 16px;cursor:pointer}}
</style>
</head>
<body>
<div class=masthead>
 <span>HPE iLO5 - Virtual Media</span>
 <span>{session["user"]} | <a href=/logout style="color:#fff">Logout</a></span>
</div>
<nav>
 <a href=/dashboard>Overview</a>
 <a class=active href=/virtual_media>Virtual Media</a>
 <a href=#>Power</a>
</nav>
<main>
 <div class=card>
  <h3>Mounted Media</h3>
  <div class=vm-item>
   <span>CD-ROM 0</span>
   <span style="font-family:monospace">{path}</span>
   <span class=badge>MOUNTED</span>
  </div>
 </div>
 <div class=card>
  <h3>Mount New Media</h3>
  <div style="padding:10px">
   <form method=post action=/vm>
    <input name=path placeholder="/path/to/iso/file.iso">
    <button type=submit>Mount</button>
   </form>
   <a href=/dashboard style="color:#039">&larr; Back to Overview</a>
  </div>
 </div>
</main>
</body>
</html>"""
    return html

@app.route("/vm", methods=["POST"])
@authed
def vm():
    p = request.form.get("path", "")
    session["vm_path"] = p
    log_input("vm_path", p)
    return redirect("/virtual_media")

@app.route("/power", methods=["POST"])
@authed
def power():
    a = request.form.get("action", "")
    session["power_msg"] = f"Power '{a}' command queued."
    log_input("power_action", a)
    return redirect("/dashboard")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=443, ssl_context=(CERT, KEY))
