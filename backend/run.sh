#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ ! -d "venv" ]; then
    echo "Creando entorno virtual..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

echo "Iniciando Escudo Digital Backend en http://localhost:8000..."
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
