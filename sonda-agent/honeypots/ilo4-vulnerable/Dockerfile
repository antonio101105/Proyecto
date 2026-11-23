FROM python:3.11-slim

WORKDIR /app

COPY app.py reporter.py ./
COPY ilo_files/ ./ilo_files/
RUN pip install --no-cache-dir flask markupsafe requests

# Generar certificado auto-firmado
RUN openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout /app/certs/key.pem -out /app/certs/cert.pem -days 3650 \
    -subj "/C=US/ST=CA/O=HPE/OU=iLO/CN=192.168.0.167" \
    2>/dev/null \
    && mkdir -p /app/data

EXPOSE 443
CMD ["python", "app.py"]
