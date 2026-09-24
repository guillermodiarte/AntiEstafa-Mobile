import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.report import Report
from app.models.threat import Threat
from app.schemas.report import (
    ReportRead,
    ReportCreate,
    ReportUpdateStatus,
    ReportUpdate,
    GroupedReport,
    GroupValidateRequest,
    GroupRejectRequest
)
from app.services.threat_service import (
    normalize_phone,
    normalize_domain,
    get_canonical_threat_key,
    increment_sync_version
)
from app.api.v1.endpoints.captcha import verify_captcha_token

router = APIRouter()


def _parse_images_list(img_str: Optional[str]) -> List[str]:
    """Helper para parsear el campo images (JSON o lista separada por comas)."""
    if not img_str:
        return []
    try:
        if img_str.startswith("["):
            return json.loads(img_str)
        return [s.strip() for s in img_str.split(",") if s.strip()]
    except Exception:
        return [img_str.strip()] if img_str.strip() else []


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
    elif report_in.threat_type in ("domain", "url"):
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


@router.get("/grouped", response_model=List[GroupedReport])
def list_grouped_reports(
    status: Optional[str] = Query(None, description="Filtrar por estado: pending, validated, rejected"),
    threat_type: Optional[str] = Query(None, description="Filtrar por tipo: phone, domain, url"),
    db: Session = Depends(get_db)
):
    """
    Agrupa denuncias ciudadanas por identificador canónico unificado usando Regex:
    - Todos los números de un mismo teléfono (+543513146924, +5493513146924, 3513146924, etc.)
    - Todos los dominios/URLs de un mismo sitio (www.falso.com, https://falso.com/login, etc.)
    Retorna cada grupo con la totalidad de denuncias e imágenes enviadas para moderación conjunta.
    """
    query = db.query(Report)
    if status and status != "all":
        query = query.filter(Report.status == status)
    
    all_reports = query.order_by(Report.created_at.desc()).all()

    # Estructura para agrupar: clave -> lista de reportes
    groups_dict = defaultdict(list)

    for r in all_reports:
        # Calcular clave canónica
        c_key = get_canonical_threat_key(r.threat_type, r.threat_value)
        # Tipo agrupador: phone o domain
        group_type = "phone" if r.threat_type == "phone" else "domain"

        if threat_type and threat_type != "all":
            if group_type != threat_type and r.threat_type != threat_type:
                continue

        groups_dict[(group_type, c_key)].append(r)

    result: List[GroupedReport] = []

    for (g_type, c_key), rep_list in groups_dict.items():
        total_reports = len(rep_list)
        pending_reports = sum(1 for x in rep_list if x.status == "pending")
        validated_reports = sum(1 for x in rep_list if x.status == "validated")
        rejected_reports = sum(1 for x in rep_list if x.status == "rejected")

        # Canales únicos
        channels = list(dict.fromkeys(x.channel for x in rep_list if x.channel))

        # Consolidar todas las imágenes únicas
        unique_images: List[str] = []
        for r in rep_list:
            imgs = _parse_images_list(r.images)
            for img in imgs:
                if img and img not in unique_images:
                    unique_images.append(img)

        # Muestras de descripciones de los denunciantes
        sample_descriptions = [r.description for r in rep_list if r.description][:5]

        # Scam type más representativo
        first_scam_type = next((r.scam_type for r in rep_list if r.scam_type is not None), None)
        scam_type_id = first_scam_type.id if first_scam_type else None
        scam_type_name = first_scam_type.name if first_scam_type else None

        # Fecha más reciente
        latest_created_at = max(r.created_at for r in rep_list)

        result.append(
            GroupedReport(
                canonical_value=c_key,
                threat_type=g_type,
                total_reports=total_reports,
                pending_reports=pending_reports,
                validated_reports=validated_reports,
                rejected_reports=rejected_reports,
                channels=channels,
                all_images=unique_images,
                sample_descriptions=sample_descriptions,
                scam_type_id=scam_type_id,
                scam_type_name=scam_type_name,
                latest_created_at=latest_created_at,
                report_ids=[r.id for r in rep_list],
                reports=rep_list
            )
        )

    # Ordenar: primero los grupos con denuncias pendientes, luego por fecha más reciente
    result.sort(key=lambda g: (g.pending_reports > 0, g.latest_created_at), reverse=True)
    return result


@router.post("/group/validate")
def validate_grouped_reports(
    req: GroupValidateRequest,
    db: Session = Depends(get_db)
):
    """
    Acepta y valida conjuntamente todas las denuncias asociadas a una misma amenaza canónica.
    Crea o actualiza la Amenaza central con todas las imágenes y descripciones consolidadas,
    e incrementa la versión de sincronización para que impacte en la app Android.
    """
    # Buscar todos los reportes correspondientes
    c_key = req.canonical_value.strip()
    
    if req.report_ids and len(req.report_ids) > 0:
        reports_to_validate = db.query(Report).filter(
            Report.id.in_(req.report_ids),
            Report.status == "pending"
        ).all()
    else:
        # Buscar por coincidencia canónica
        all_pending = db.query(Report).filter(Report.status == "pending").all()
        reports_to_validate = [
            r for r in all_pending
            if get_canonical_threat_key(r.threat_type, r.threat_value) == c_key
        ]

    if not reports_to_validate:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron denuncias pendientes para este grupo o ya fueron procesadas."
        )

    now = datetime.now(timezone.utc)
    all_images_set = set()
    combined_notes = []

    for r in reports_to_validate:
        r.status = "validated"
        r.reviewed_at = now
        r.reviewer_notes = req.reviewer_notes or "Validado en bloque agrupado"
        if r.description:
            combined_notes.append(f"[{r.channel.upper()}]: {r.description}")
        for img in _parse_images_list(r.images):
            if img:
                all_images_set.add(img)

    # Buscar amenaza existente en base central
    threat_type = "phone" if req.threat_type == "phone" else "domain"
    existing_threat = db.query(Threat).filter(
        Threat.type == threat_type,
        Threat.value == c_key
    ).first()

    new_version = increment_sync_version(db)
    all_images_list = list(all_images_set)

    if existing_threat:
        existing_threat.report_count += len(reports_to_validate)
        existing_threat.status = "validated"
        existing_threat.is_deleted = False
        existing_threat.version = new_version
        existing_threat.updated_at = now
        
        # Combinar imágenes previas con nuevas
        existing_imgs = set(_parse_images_list(existing_threat.images))
        combined_imgs = list(existing_imgs.union(all_images_set))
        if combined_imgs:
            existing_threat.images = json.dumps(combined_imgs)

        if combined_notes:
            existing_notes = existing_threat.evidence_notes or ""
            existing_threat.evidence_notes = (existing_notes + " | " + " // ".join(combined_notes)).strip(" | ")
    else:
        new_threat = Threat(
            type=threat_type,
            value=c_key,
            risk_level=req.risk_level or "high",
            status="validated",
            scam_type_id=req.scam_type_id or reports_to_validate[0].scam_type_id,
            report_count=len(reports_to_validate),
            confidence_score=0.95,
            evidence_notes=" // ".join(combined_notes) if combined_notes else "Consolidado de reportes ciudadanos",
            images=json.dumps(all_images_list) if all_images_list else None,
            country="AR",
            version=new_version,
            is_deleted=False
        )
        db.add(new_threat)

    db.commit()

    return {
        "message": f"Se validaron exitosamente {len(reports_to_validate)} denuncias para {c_key}.",
        "canonical_value": c_key,
        "validated_count": len(reports_to_validate),
        "total_images": len(all_images_list),
        "new_sync_version": new_version
    }


@router.post("/group/reject")
def reject_grouped_reports(
    req: GroupRejectRequest,
    db: Session = Depends(get_db)
):
    """Descarta conjuntamente todas las denuncias pendientes de un grupo."""
    c_key = req.canonical_value.strip()

    if req.report_ids and len(req.report_ids) > 0:
        reports_to_reject = db.query(Report).filter(
            Report.id.in_(req.report_ids),
            Report.status == "pending"
        ).all()
    else:
        all_pending = db.query(Report).filter(Report.status == "pending").all()
        reports_to_reject = [
            r for r in all_pending
            if get_canonical_threat_key(r.threat_type, r.threat_value) == c_key
        ]

    if not reports_to_reject:
        raise HTTPException(
            status_code=404,
            detail="No se encontraron denuncias pendientes para este grupo."
        )

    now = datetime.now(timezone.utc)
    for r in reports_to_reject:
        r.status = "rejected"
        r.reviewed_at = now
        r.reviewer_notes = req.reviewer_notes or "Descartado en moderación de grupo"

    db.commit()

    return {
        "message": f"Se descartaron {len(reports_to_reject)} denuncias para {c_key}.",
        "rejected_count": len(reports_to_reject)
    }


@router.get("", response_model=List[ReportRead])
def list_reports(
    status: Optional[str] = Query(None, description="Filtrar por estado: pending, in_review, validated, rejected"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Listado administrativo de reportes individuales de la comunidad."""
    query = db.query(Report)
    if status and status != "all":
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
        elif report.threat_type in ("domain", "url"):
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
    Panel administrativo: Cambia el estado de un reporte individual (e.g. Validar o Rechazar).
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
        canonical_key = get_canonical_threat_key(report.threat_type, report.threat_value)
        threat_type = "phone" if report.threat_type == "phone" else "domain"
        
        existing = db.query(Threat).filter(
            Threat.type == threat_type,
            Threat.value == canonical_key
        ).first()

        new_version = increment_sync_version(db)

        if existing:
            existing.report_count += 1
            existing.status = "validated"
            existing.is_deleted = False
            existing.version = new_version
            if report.images:
                # Combinar imágenes
                exist_imgs = set(_parse_images_list(existing.images))
                new_imgs = set(_parse_images_list(report.images))
                combined = list(exist_imgs.union(new_imgs))
                existing.images = json.dumps(combined)
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_threat = Threat(
                type=threat_type,
                value=canonical_key,
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
