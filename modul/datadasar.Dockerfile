FROM python:3.12-alpine
COPY ./datadasar/app /app
COPY ./datadasar/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY .env /app
WORKDIR /app
RUN mkdir files
RUN mkdir template
COPY ./template /app/template
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]