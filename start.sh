#!/bin/bash

# Mudar para o diretório do backend
cd /app/backend

# Usar porta do Railway ou 8000 como fallback
PORT=${PORT:-8000}

# Iniciar aplicação
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT