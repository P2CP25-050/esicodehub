FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app/backend

COPY requirements/base.txt .
COPY requirements/dev.txt .

RUN apk update && \
    apk add --no-cache build-base linux-headers postgresql-dev python3-dev postgresql-client libmagic libffi-dev && \
    pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r dev.txt

COPY . .

COPY wait-for-postgres.sh /wait-for-postgres.sh
RUN sed -i 's/\r$//' /wait-for-postgres.sh && chmod +x /wait-for-postgres.sh

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
