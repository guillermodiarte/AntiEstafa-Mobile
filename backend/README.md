# Escudo Digital — Backend API

Backend centralizado en **FastAPI** para la prevención de estafas digitales en el ecosistema **Escudo Digital** (FormosaHack).

## Características principales

- **Base de amenazas**: Gestión de números de teléfono, dominios y URLs asociadas a fraudes.
- **Sincronización móvil incremental** (`/api/v1/mobile/sync`): Permite que la app Android sincronice deltas de amenazas utilizando números de versión monótonos para operar 100% offline.
- **Canal de reportes ciudadanos** (`/api/v1/reports`): Reportes anónimos clasificados con moderación administrativa.
- **Detección y consulta pública** (`/api/v1/threats/phone/...`, `/api/v1/threats/domain/...`, `/api/v1/threats/url`): Búsqueda en tiempo real para terceros y panel web.
- **Dataset semilla (Seed Data)**: Precargado con casos reales de estafas regionales (ANSES, falso familiar, clonación bancaria, loterías falsas).

---

## Ejecución rápida

```bash
cd backend
./run.sh
```

La API estará disponible en:
- **API Base**: [http://localhost:8000](http://localhost:8000)
- **Documentación Interactiva Swagger**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Ejecutar Pruebas Automatizadas

```bash
cd backend
./venv/bin/pytest -v
```
