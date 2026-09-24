from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.threat import Threat
from app.models.scam_type import ScamType
from app.schemas.threat import ThreatRead, ThreatCreate, ThreatUpdate, ThreatCheckResult, ThreatPublicView
from app.services.threat_service import (
    check_phone_threat,
    check_domain_threat,
    check_url_threat,
    normalize_phone,
    normalize_domain,
    increment_sync_version
)

router = APIRouter()


def build_public_view(threat: Threat) -> ThreatPublicView:
    return ThreatPublicView(
        tipo=threat.type,
        valor=threat.value,
        nivel=threat.risk_level,
        estado=threat.status,
        categoria=threat.scam_type.name if threat.scam_type else "No clasificada",
        recomendacion=threat.scam_type.advice if threat.scam_type else None,
        cantidad_reportes=threat.report_count,
        ultima_actualizacion=threat.updated_at.strftime("%Y-%m-%d") if threat.updated_at else threat.created_at.strftime("%Y-%m-%d")
    )


@router.get("/phone/{number}", response_model=ThreatCheckResult)
def query_phone(number: str, db: Session = Depends(get_db)):
    """Consulta la reputación y reportes de un número telefónico."""
    threat = check_phone_threat(db, number)
    if threat:
        return ThreatCheckResult(
            is_threat=True,
            risk_level=threat.risk_level,
            message="El número está registrado en la base de sospechas de estafas.",
            details=build_public_view(threat)
        )
    return ThreatCheckResult(
        is_threat=False,
        risk_level="low",
        message="No se encontraron reportes confirmados para este número.",
        details=None
    )


@router.get("/domain/{domain}", response_model=ThreatCheckResult)
def query_domain(domain: str, db: Session = Depends(get_db)):
    """Consulta si un dominio web está asociado a phishing o fraude."""
    threat = check_domain_threat(db, domain)
    if threat:
        return ThreatCheckResult(
            is_threat=True,
            risk_level=threat.risk_level,
            message="Este sitio web fue reportado como potencialmente peligroso.",
            details=build_public_view(threat)
        )
    return ThreatCheckResult(
        is_threat=False,
        risk_level="low",
        message="No se registran antecedentes negativos para este dominio.",
        details=None
    )


@router.get("/url", response_model=ThreatCheckResult)
def query_url(url: str = Query(..., description="URL completa a verificar"), db: Session = Depends(get_db)):
    """Consulta la reputación de una URL completa o su dominio base."""
    threat = check_url_threat(db, url)
    if threat:
        return ThreatCheckResult(
            is_threat=True,
            risk_level=threat.risk_level,
            message="El enlace presenta señales directas asociadas a posibles estafas.",
            details=build_public_view(threat)
        )
    return ThreatCheckResult(
        is_threat=False,
        risk_level="low",
        message="No se encontraron alertas para este enlace.",
        details=None
    )


@router.get("", response_model=List[ThreatRead])
def list_threats(
    type: Optional[str] = Query(None, description="Filtrar por tipo: phone, domain, url"),
    risk_level: Optional[str] = Query(None, description="Filtrar por nivel de riesgo: low, medium, high"),
    q: Optional[str] = Query(None, description="Término de búsqueda"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Lista las amenazas con filtros opcionales (para administración y búsqueda pública)."""
    query = db.query(Threat).filter(Threat.is_deleted == False)
    if type:
        query = query.filter(Threat.type == type)
    if risk_level:
        query = query.filter(Threat.risk_level == risk_level)
    if q:
        query = query.filter(Threat.value.contains(q.strip()))
    
    return query.order_by(Threat.updated_at.desc()).offset(skip).limit(limit).all()


@router.post("", response_model=ThreatRead, status_code=201)
def create_threat(threat_in: ThreatCreate, db: Session = Depends(get_db)):
    """Crea una amenaza manualmente (panel administrativo)."""
    norm_val = threat_in.value
    if threat_in.type == "phone":
        norm_val = normalize_phone(threat_in.value)
    elif threat_in.type == "domain":
        norm_val = normalize_domain(threat_in.value)

    new_version = increment_sync_version(db)
    threat = Threat(
        type=threat_in.type,
        value=norm_val,
        risk_level=threat_in.risk_level,
        status=threat_in.status,
        scam_type_id=threat_in.scam_type_id,
        report_count=threat_in.report_count,
        confidence_score=threat_in.confidence_score,
        evidence_notes=threat_in.evidence_notes,
        country=threat_in.country,
        version=new_version,
        is_deleted=False
    )
    db.add(threat)
    db.commit()
    db.refresh(threat)
    return threat


@router.get("/{threat_id}", response_model=ThreatRead)
def get_threat(threat_id: int, db: Session = Depends(get_db)):
    """Obtiene el detalle de una amenaza específica."""
    threat = db.query(Threat).filter(Threat.id == threat_id, Threat.is_deleted == False).first()
    if not threat:
        raise HTTPException(status_code=404, detail="Amenaza no encontrada")
    return threat


@router.patch("/{threat_id}", response_model=ThreatRead)
def edit_threat(
    threat_id: int,
    threat_in: ThreatUpdate,
    db: Session = Depends(get_db)
):
    """
    Permite editar los datos de una amenaza en la base central (ventana modal de administración).
    Si se modifica un valor relevante, incrementa la versión de sincronización para propagar a los móviles.
    """
    threat = db.query(Threat).filter(Threat.id == threat_id, Threat.is_deleted == False).first()
    if not threat:
        raise HTTPException(status_code=404, detail="Amenaza no encontrada")

    data_changed = False

    if threat_in.type is not None and threat_in.type != threat.type:
        threat.type = threat_in.type
        data_changed = True
    if threat_in.value is not None:
        val = threat_in.value.strip()
        if threat.type == "phone":
            val = normalize_phone(val)
        elif threat.type == "domain":
            val = normalize_domain(val)
        if val != threat.value:
            threat.value = val
            data_changed = True
    if threat_in.risk_level is not None and threat_in.risk_level != threat.risk_level:
        threat.risk_level = threat_in.risk_level
        data_changed = True
    if threat_in.status is not None and threat_in.status != threat.status:
        threat.status = threat_in.status
        data_changed = True
    if threat_in.scam_type_id is not None:
        threat.scam_type_id = threat_in.scam_type_id
        data_changed = True
    if threat_in.report_count is not None:
        threat.report_count = threat_in.report_count
    if threat_in.confidence_score is not None:
        threat.confidence_score = threat_in.confidence_score
    if threat_in.evidence_notes is not None:
        threat.evidence_notes = threat_in.evidence_notes
    if threat_in.images is not None:
        threat.images = threat_in.images
    if threat_in.is_deleted is not None:
        threat.is_deleted = threat_in.is_deleted
        data_changed = True

    if data_changed:
        threat.version = increment_sync_version(db)

    db.commit()
    db.refresh(threat)
    return threat
