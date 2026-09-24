from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.threat import Threat
from app.models.report import Report
from app.models.scam_type import ScamType
from app.schemas.stats import SystemStatsResponse, ScamTypeStat
from app.services.threat_service import get_or_create_sync_state

router = APIRouter()


@router.get("", response_model=SystemStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Métricas agregadas del ecosistema de seguridad (para el público y dashboard web)."""
    total_threats = db.query(Threat).filter(Threat.is_deleted == False, Threat.status == "validated").count()
    phone_threats = db.query(Threat).filter(Threat.type == "phone", Threat.is_deleted == False, Threat.status == "validated").count()
    domain_threats = db.query(Threat).filter(Threat.type == "domain", Threat.is_deleted == False, Threat.status == "validated").count()
    url_threats = db.query(Threat).filter(Threat.type == "url", Threat.is_deleted == False, Threat.status == "validated").count()

    total_reports = db.query(Report).count()
    total_validated_reports = db.query(Report).filter(Report.status == "validated").count()

    state = get_or_create_sync_state(db)

    # Top modalidades con amenazas
    top_categories = db.query(
        ScamType.name,
        func.count(Threat.id).label("count")
    ).join(Threat, Threat.scam_type_id == ScamType.id, isouter=True)\
     .filter(Threat.is_deleted == False)\
     .group_by(ScamType.name)\
     .order_by(func.count(Threat.id).desc())\
     .limit(5).all()

    top_stats = [ScamTypeStat(category=cat[0], count=cat[1]) for cat in top_categories]

    return SystemStatsResponse(
        total_threats=total_threats,
        total_phone_threats=phone_threats,
        total_domain_threats=domain_threats,
        total_url_threats=url_threats,
        total_reports=total_reports,
        total_validated_reports=total_validated_reports,
        current_sync_version=state.current_version,
        top_scam_types=top_stats,
        status="operational"
    )
