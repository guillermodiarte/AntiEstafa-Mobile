#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "Iniciando Escudo Digital Web en http://localhost:3000..."
npm run dev -- -p 3000
