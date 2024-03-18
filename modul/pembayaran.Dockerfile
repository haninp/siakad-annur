FROM python:3.12-alpine
COPY ./pembayaran /app
COPY ./pembayaran/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY .env /app
WORKDIR /app

CMD ["python", "main.py"]