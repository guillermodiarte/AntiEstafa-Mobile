from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.models.threat import Threat
from app.schemas.report import ReportRead, ReportCreate, ReportUpdateStatus
from app.services.threat_service import normalize_phone, normalize_domain, increment_sync_version

router = APIRouter()


@router.post("", response_model=ReportRead, status_code=201)
def submit_report(report_in: ReportCreate, db: Session = Depends(get_db)):
    """
    Permite a la ciudadanía reportar un intento de estafa desde la Web o la App.
    El reporte ingresa en estado 'pending' para revisión y no va a la base pública automáticamente.
    """
    norm_val = report_in.threat_value.strip()
    if report_in.threat_type == "phone":
        norm_val = normalize_phone(norm_val)
    elif report_in.threat_type == "domain":
        norm_val = normalize_domain(norm_val)

    report = Report(
        channel=report_in.channel,
        threat_type=report_in.threat_type,
        threat_value=norm_val,
        description=report_in.description,
        evidence=report_in.evidence,
        scam_type_id=report_in.scam_type_id,
        country=report_in.country or "AR",
        status="pending"
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("", response_model=List[ReportRead])
def list_reports(
    status: Optional[str] = Query(None, description="Filtrar por estado: pending, in_review, validated, rejected"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Listado administrativo de reportes de la comunidad."""
    query = db.query(Report)
    if status:
        query = query.filter(Report.status == status)
    return query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()


@router.patch("/{report_id}/status", response_model=ReportRead)
def update_report_status(
    report_id: int,
    status_update: ReportUpdateStatus,
    db: Session = Depends(get_db)
):
    """
    Panel administrativo: Cambia el estado de un reporte (e.g. Validar o Rechazar).
    Si se valida con create_or_update_threat=True, se actualiza o crea la amenaza en la base central,
    y se incrementa la versión de sincronización para que impacte en los celulares Android.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    report.status = status_update.status
    report.reviewer_notes = status_update.reviewer_notes
    report.reviewed_at = datetime.now(timezone.utc)

    if status_update.status == "validated" and status_update.create_or_update_threat:
        # Buscar si ya existe la amenaza para sumar reportes o crearla
        existing = db.query(Threat).filter(
            Threat.type == report.threat_type,
            Threat.value == report.threat_value
        ).first()

        new_version = increment_sync_version(db)

        if existing:
            existing.report_count += 1
            existing.status = "validated"
            existing.is_deleted = False
            existing.version = new_version
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_threat = Threat(
                type=report.threat_type,
                value=report.threat_value,
                risk_level="high",
                status="validated",
                scam_type_id=report.scam_type_id,
                report_count=1,
                confidence_score=0.95,
                evidence_notes=report.description,
                country=report.country,
                version=new_version,
                is_deleted=False
            )
            db.add(new_threat)

    db.commit()
    db.refresh(report)
    return report
