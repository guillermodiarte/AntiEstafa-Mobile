from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.threat import Threat
from app.schemas.sync import SyncResponse, SyncItem
from app.services.threat_service import get_or_create_sync_state

router = APIRouter()


@router.get("", response_model=SyncResponse)
def mobile_sync(
    since_version: int = Query(0, description="Última versión conocida en la base Room local del dispositivo"),
    limit: int = Query(500, description="Límite de cambios por lote"),
    db: Session = Depends(get_db)
):
    """
    Endpoint de sincronización incremental para la aplicación móvil Android.
    Devuelve únicamente los registros modificados o eliminados a partir de `since_version`.
    Permite funcionamiento 100% offline con bajo consumo de datos y batería.
    """
    state = get_or_create_sync_state(db)
    current_version = state.current_version

    changes_query = db.query(Threat).filter(
        Threat.version > since_version
    ).order_by(Threat.version.asc())

    total_changes = changes_query.count()
    threats = changes_query.limit(limit).all()

    items = [
        SyncItem(
            id=t.id,
            type=t.type,
            value=t.value,
            risk_level=t.risk_level,
            category=t.scam_type.name if t.scam_type else None,
            version=t.version,
            is_deleted=t.is_deleted
        )
        for t in threats
    ]

    return SyncResponse(
        current_version=current_version,
        since_version=since_version,
        has_more=(total_changes > limit),
        items=items,
        total_changes=len(items)
    )
