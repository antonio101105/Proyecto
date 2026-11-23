FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY captura_ventanas.py .
COPY firewall_redirect.py .

EXPOSE 8000

CMD ["python", "captura_ventanas.py"]
