# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Instalar dependências de build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copiar requirements
COPY backend/requirements.txt .

# Instalar dependências em virtual env
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Instalar dependências CORE primeiro (sem whisper)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    fastapi==0.115.5 \
    uvicorn[standard]==0.32.1 \
    sqlmodel==0.0.22 \
    sqlalchemy==2.0.36 \
    psycopg2-binary==2.9.10 \
    python-dateutil==2.9.0.post0 \
    pydantic==2.9.2 \
    pydantic-settings==2.6.0 \
    python-multipart==0.0.9 \
    requests==2.32.3

# Instalar whisper SEPARADAMENTE (para melhor cache)
RUN pip install --no-cache-dir openai-whisper==20231117

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Instalar apenas runtime ESSENCIAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && useradd -m -u 1000 appuser

# Copiar virtual env do builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copiar aplicação
COPY backend/app ./app

# Baixar modelo whisper base (apenas 150MB)
RUN python -c "import whisper; whisper.load_model('base')"

# Mudar para usuário não-root
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)" || exit 1

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]