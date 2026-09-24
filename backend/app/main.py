from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models import *  # Asegura carga de todos los modelos
from app.seeds.seed_data import seed_database
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Crear tablas y cargar dataset semilla si está vacío
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
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


@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }
