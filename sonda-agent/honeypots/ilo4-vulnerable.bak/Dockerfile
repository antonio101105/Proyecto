FROM python:3.11-slim
WORKDIR /honeypot
COPY app.py .
COPY ilo_files/ ./ilo_files/
RUN pip install --no-cache-dir flask markupsafe
# Generar certificado auto-firmado al build (no se compromete la clave privada real)
RUN openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout /honeypot/key.pem -out /honeypot/cert.pem -days 3650 \
    -subj "/C=US/ST=CA/O=HPE/OU=iLO/CN=192.168.0.167" \
    2>/dev/null
EXPOSE 443
CMD ["python", "app.py"]
