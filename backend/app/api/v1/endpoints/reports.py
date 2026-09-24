from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.models.threat import Threat
from app.schemas.report import ReportRead, ReportCreate, ReportUpdateStatus, ReportUpdate
from app.services.threat_service import normalize_phone, normalize_domain, increment_sync_version
from app.api.v1.endpoints.captcha import verify_captcha_token

router = APIRouter()


@router.post("", response_model=ReportRead, status_code=201)
def submit_report(report_in: ReportCreate, db: Session = Depends(get_db)):
    """
    Permite a la ciudadanía reportar un intento de estafa desde la Web o la App.
    Incluye protección anti-bot con Honeypot y Desafío de Seguridad.
    Permite adjuntar una o más imágenes como evidencia.
    """
    # 1. Filtro Honeypot: si el campo trampa tiene contenido, es un bot
    if report_in.hp_token and report_in.hp_token.strip():
        raise HTTPException(
            status_code=400,
            detail="Petición bloqueada por sistema de detección de robots (Honeypot)."
        )

    # 2. Verificación de Desafío Anti-Bot (Captcha humano)
    if report_in.captcha_token:
        is_valid_human = verify_captcha_token(
            report_in.captcha_token,
            report_in.captcha_answer or ""
        )
        if not is_valid_human:
            raise HTTPException(
                status_code=400,
                detail="La respuesta a la verificación de seguridad es incorrecta o expiró. Por favor resolvé el cálculo nuevamente."
            )

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
        images=report_in.images,
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


@router.get("/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: Session = Depends(get_db)):
    """Obtiene el detalle completo de un reporte específico."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return report


@router.patch("/{report_id}", response_model=ReportRead)
def edit_report(
    report_id: int,
    report_in: ReportUpdate,
    db: Session = Depends(get_db)
):
    """
    Permite a los administradores / moderadores editar cualquiera de los campos
    de un caso o reporte comunitario (ventana modal de edición).
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    if report_in.channel is not None:
        report.channel = report_in.channel
    if report_in.threat_type is not None:
        report.threat_type = report_in.threat_type
    if report_in.threat_value is not None:
        val = report_in.threat_value.strip()
        if report.threat_type == "phone":
            val = normalize_phone(val)
        elif report.threat_type == "domain":
            val = normalize_domain(val)
        report.threat_value = val
    if report_in.description is not None:
        report.description = report_in.description
    if report_in.evidence is not None:
        report.evidence = report_in.evidence
    if report_in.images is not None:
        report.images = report_in.images
    if report_in.scam_type_id is not None:
        report.scam_type_id = report_in.scam_type_id
    if report_in.status is not None:
        report.status = report_in.status
        report.reviewed_at = datetime.now(timezone.utc)
    if report_in.reviewer_notes is not None:
        report.reviewer_notes = report_in.reviewer_notes

    db.commit()
    db.refresh(report)
    return report


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
            existing.images = report.images or existing.images
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
                images=report.images,
                country=report.country,
                version=new_version,
                is_deleted=False
            )
            db.add(new_threat)

    db.commit()
    db.refresh(report)
    return report
