FROM python:3.11-slim

WORKDIR /app

# Instalar dependências mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copiar requirements primeiro
COPY backend/requirements.txt .

# Instalar dependências CORE
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    fastapi==0.115.5 \
    uvicorn[standard]==0.32.1 \
    sqlmodel==0.0.22 \
    sqlalchemy==2.0.36 \
    psycopg2-binary==2.9.10 \
    python-dateutil==2.9.0.post0 \
    pydantic==2.9.2 \
    python-multipart==0.0.9 \
    requests==2.32.3

# Instalar whisper
RUN pip install --no-cache-dir \
    torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir openai-whisper==20231117

# Copiar APENAS a aplicação (não a pasta backend)
COPY backend/app/ ./app/

# Baixar modelo whisper base
RUN python -c "import whisper; whisper.load_model('base')" && \
    echo "Whisper base model loaded successfully"

EXPOSE 8000

# Comando direto - a aplicação está em /app/
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]