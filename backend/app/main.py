import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models import *  # Asegura carga de todos los modelos
from app.seeds.seed_data import seed_database
from app.api.v1.router import api_router

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Crear tablas y cargar dataset semilla si está vacío
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Migración ligera para columnas nuevas en SQLite existente
        try:
            db.execute(text("ALTER TABLE reports ADD COLUMN images TEXT"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE threats ADD COLUMN images TEXT"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE threats ADD COLUMN scam_type_ids TEXT"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE reports ADD COLUMN scam_type_ids TEXT"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE reports ADD COLUMN existing_threat_id INTEGER"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE reports ADD COLUMN is_update BOOLEAN DEFAULT 0"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE reports ADD COLUMN attached_url TEXT"))
            db.commit()
        except Exception:
            db.rollback()

        seed_database(db)
    finally:
        db.close()
    yield
    # Shutdown logic if needed


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    description="""
### Escudo Digital — Ecosistema de Prevención de Estafas Digitales (FormosaHack)
API REST centralizada para consulta y sincronización de amenazas digitales:
- **Protección de Llamadas y Mensajería**: Detección de números reportados y modalidades de ingeniería social.
- **Protección Web**: Verificación de dominios fraudulentos y URLs de phishing.
- **Sincronización Incremental**: Endpoint optimizado para la app Android (`/api/v1/mobile/sync`).
- **Validación Comunitaria**: Flujo de reportes ciudadanos y moderación administrativa.
    """
)

# Configuración de CORS
origins = settings.CORS_ORIGINS
if isinstance(origins, list):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if "*" not in origins else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }
