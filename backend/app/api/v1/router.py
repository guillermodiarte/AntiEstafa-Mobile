from fastapi import APIRouter
from app.api.v1.endpoints import threats, reports, scam_types, sync, stats

api_router = APIRouter()

api_router.include_router(threats.router, prefix="/threats", tags=["Threats - Amenazas"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports - Reportes Ciudadanos"])
api_router.include_router(scam_types.router, prefix="/scam-types", tags=["Scam Types - Modalidades"])
api_router.include_router(sync.router, prefix="/mobile/sync", tags=["Mobile - Sincronización Incremental"])
api_router.include_router(stats.router, prefix="/stats", tags=["Stats - Estadísticas"])
