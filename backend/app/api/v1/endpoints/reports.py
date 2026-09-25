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
from app.models.scam_type import ScamType
from app.api.v1.endpoints.captcha import verify_captcha_token

router = APIRouter()


def _get_scam_types_map(db: Session):
    all_sts = db.query(ScamType).all()
    return {st.id: st for st in all_sts}


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


def _enrich_report(report: Report, sts_map: dict, existing_threat: Optional[Threat] = None) -> ReportRead:
    ids = report.get_scam_type_ids_list()
    sts_list = [sts_map[sid] for sid in ids if sid in sts_map]
    
    already_in_db = False
    ex_id = report.existing_threat_id
    ex_val = None
    ex_modalities = []

    if existing_threat:
        already_in_db = True
        ex_id = existing_threat.id
        ex_val = existing_threat.value
        ex_modalities = [sts_map[sid].name for sid in existing_threat.get_scam_type_ids_list() if sid in sts_map]
    elif report.existing_threat:
        already_in_db = True
        ex_id = report.existing_threat.id
        ex_val = report.existing_threat.value
        ex_modalities = [sts_map[sid].name for sid in report.existing_threat.get_scam_type_ids_list() if sid in sts_map]

    return ReportRead(
        id=report.id,
        channel=report.channel,
        threat_type=report.threat_type,
        threat_value=report.threat_value,
        description=report.description,
        evidence=report.evidence,
        images=report.images,
        attached_url=getattr(report, 'attached_url', None),
        scam_type_id=report.scam_type_id,
        scam_type_ids=ids,
        country=report.country,
        status=report.status,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
        reviewer_notes=report.reviewer_notes,
        scam_type=report.scam_type,
        scam_types=sts_list,
        existing_threat_id=ex_id,
        is_update=report.is_update or already_in_db,
        already_in_database=already_in_db,
        existing_threat_value=ex_val,
        existing_threat_modalities=ex_modalities
    )


@router.post("", response_model=ReportRead, status_code=201)
def submit_report(report_in: ReportCreate, db: Session = Depends(get_db)):
    """
    Permite a la ciudadanía reportar un intento de estafa desde la Web o la App.
    Incluye protección anti-bot con Honeypot y Desafío de Seguridad.
    Permite adjuntar una o más imágenes como evidencia y opcionalmente un enlace/dominio recibido en SMS/WhatsApp.
    Si el identificador ya existe en la base central, se clasifica como actualización de caso existente.
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

    norm_attached_url = None
    if report_in.attached_url and report_in.attached_url.strip():
        norm_attached_url = normalize_domain(report_in.attached_url.strip())

    # Verificar si ya existe en la base central de amenazas
    c_key = get_canonical_threat_key(report_in.threat_type, norm_val)
    g_type = "phone" if report_in.threat_type == "phone" else "domain"
    existing_threat = db.query(Threat).filter(
        Threat.type == g_type,
        Threat.value == c_key,
        Threat.is_deleted == False
    ).first()

    scam_ids = report_in.scam_type_ids or ([report_in.scam_type_id] if report_in.scam_type_id else [])
    main_scam_id = report_in.scam_type_id or (scam_ids[0] if scam_ids else None)

    report = Report(
        channel=report_in.channel,
        threat_type=report_in.threat_type,
        threat_value=norm_val,
        description=report_in.description,
        evidence=report_in.evidence,
        images=report_in.images,
        attached_url=norm_attached_url,
        scam_type_id=main_scam_id,
        scam_type_ids=json.dumps(scam_ids) if scam_ids else None,
        existing_threat_id=existing_threat.id if existing_threat else None,
        is_update=(existing_threat is not None),
        country=report_in.country or "AR",
        status="pending"
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    sts_map = _get_scam_types_map(db)
    return _enrich_report(report, sts_map, existing_threat)


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

    sts_map = _get_scam_types_map(db)

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

        # Consolidar URLs/dominios adjuntos únicos reportados en este grupo
        attached_urls_set = set()
        for r in rep_list:
            att = getattr(r, 'attached_url', None)
            if att and att.strip():
                attached_urls_set.add(att.strip())
        group_attached_urls = sorted(list(attached_urls_set))

        # Muestras de descripciones de los denunciantes
        sample_descriptions = [r.description for r in rep_list if r.description][:5]

        # Scam types presentes en este grupo
        group_scam_ids = set()
        for r in rep_list:
            for sid in r.get_scam_type_ids_list():
                if sid:
                    group_scam_ids.add(sid)
        
        group_scam_ids_list = sorted(list(group_scam_ids))
        group_scam_types = [sts_map[sid] for sid in group_scam_ids_list if sid in sts_map]
        
        first_scam_type = group_scam_types[0] if group_scam_types else None
        scam_type_id = first_scam_type.id if first_scam_type else None
        scam_type_name = first_scam_type.name if first_scam_type else None

        # Fecha más reciente
        latest_created_at = max(r.created_at for r in rep_list)

        # Verificar si ya existe en la base central de amenazas
        existing_threat = db.query(Threat).filter(
            Threat.type == g_type,
            Threat.value == c_key,
            Threat.is_deleted == False
        ).first()

        is_ex = existing_threat is not None
        ex_id = existing_threat.id if existing_threat else None
        ex_mods = [sts_map[sid].name for sid in existing_threat.get_scam_type_ids_list() if sid in sts_map] if existing_threat else []

        enriched_reports = [_enrich_report(r, sts_map, existing_threat) for r in rep_list]

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
                attached_urls=group_attached_urls,
                sample_descriptions=sample_descriptions,
                scam_type_id=scam_type_id,
                scam_type_ids=group_scam_ids_list,
                scam_type_name=scam_type_name,
                scam_types=group_scam_types,
                latest_created_at=latest_created_at,
                report_ids=[r.id for r in rep_list],
                reports=enriched_reports,
                is_existing_threat=is_ex,
                existing_threat_id=ex_id,
                existing_threat_modalities=ex_mods
            )
        )

    # Ordenar: primero los grupos con denuncias pendientes, luego por fecha más reciente
    result.sort(key=lambda g: (g.pending_reports > 0, g.latest_created_at), reverse=True)
    return result


@router.get("/updates")
def list_pending_updates(db: Session = Depends(get_db)):
    """
    Retorna reportes ciudadanos pendientes que coinciden con amenazas ya existentes en la base central.
    Permite al equipo de moderación revisar la nueva evidencia (comentario, fotos, modalidad)
    para anexarla y actualizar el caso existente.
    """
    from app.api.v1.endpoints.threats import _enrich_threat
    sts_map = _get_scam_types_map(db)
    
    pending_reports = db.query(Report).filter(Report.status == "pending").order_by(Report.created_at.desc()).all()
    
    updates = []
    for r in pending_reports:
        c_key = get_canonical_threat_key(r.threat_type, r.threat_value)
        g_type = "phone" if r.threat_type == "phone" else "domain"
        
        existing_threat = None
        if r.existing_threat_id:
            existing_threat = db.query(Threat).filter(Threat.id == r.existing_threat_id, Threat.is_deleted == False).first()
        if not existing_threat:
            existing_threat = db.query(Threat).filter(
                Threat.type == g_type,
                Threat.value == c_key,
                Threat.is_deleted == False
            ).first()
            if existing_threat and not r.existing_threat_id:
                r.existing_threat_id = existing_threat.id
                r.is_update = True
                db.commit()

        if existing_threat:
            enriched_report = _enrich_report(r, sts_map, existing_threat)
            enriched_threat = _enrich_threat(existing_threat, sts_map)
            
            existing_mod_ids = set(existing_threat.get_scam_type_ids_list())
            new_mod_ids = set(r.get_scam_type_ids_list())
            is_new_modality = len(new_mod_ids - existing_mod_ids) > 0
            new_modalities_list = [sts_map[sid].name for sid in new_mod_ids if sid in sts_map and sid not in existing_mod_ids]
            
            updates.append({
                "report": enriched_report,
                "existing_threat": enriched_threat,
                "is_new_modality": is_new_modality,
                "new_modalities": new_modalities_list,
                "new_images": _parse_images_list(r.images),
                "new_images_count": len(_parse_images_list(r.images)),
                "has_new_images": len(_parse_images_list(r.images)) > 0
            })

    return updates


@router.post("/group/validate")
def validate_grouped_reports(
    req: GroupValidateRequest,
    db: Session = Depends(get_db)
):
    """
    Acepta y valida conjuntamente todas las denuncias asociadas a una misma amenaza canónica.
    Crea o actualiza la Amenaza central con todas las imágenes y descripciones consolidadas,
    conservando y fusionando todas las modalidades registradas.
    """
    c_key = req.canonical_value.strip()
    
    if req.report_ids and len(req.report_ids) > 0:
        reports_to_validate = db.query(Report).filter(
            Report.id.in_(req.report_ids),
            Report.status == "pending"
        ).all()
    else:
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

    threat_type = "phone" if req.threat_type == "phone" else "domain"
    existing_threat = db.query(Threat).filter(
        Threat.type == threat_type,
        Threat.value == c_key,
        Threat.is_deleted == False
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

        # Combinar modalidades
        existing_scam_ids = set(existing_threat.get_scam_type_ids_list())
        new_scam_ids = set()
        if req.scam_type_id:
            new_scam_ids.add(req.scam_type_id)
        for r in reports_to_validate:
            for sid in r.get_scam_type_ids_list():
                if sid:
                    new_scam_ids.add(sid)
        combined_scam_ids = sorted(list(existing_scam_ids.union(new_scam_ids)))
        if combined_scam_ids:
            existing_threat.scam_type_ids = json.dumps(combined_scam_ids)
            if not existing_threat.scam_type_id:
                existing_threat.scam_type_id = combined_scam_ids[0]

        if combined_notes:
            existing_notes = existing_threat.evidence_notes or ""
            existing_threat.evidence_notes = (existing_notes + " | " + " // ".join(combined_notes)).strip(" | ")
    else:
        new_scam_ids = set()
        if req.scam_type_id:
            new_scam_ids.add(req.scam_type_id)
        for r in reports_to_validate:
            for sid in r.get_scam_type_ids_list():
                if sid:
                    new_scam_ids.add(sid)
        scam_ids_list = sorted(list(new_scam_ids))
        main_scam_id = req.scam_type_id or (scam_ids_list[0] if scam_ids_list else reports_to_validate[0].scam_type_id)

        new_threat = Threat(
            type=threat_type,
            value=c_key,
            risk_level=req.risk_level or "high",
            status="validated",
            scam_type_id=main_scam_id,
            scam_type_ids=json.dumps(scam_ids_list) if scam_ids_list else None,
            report_count=len(reports_to_validate),
            confidence_score=0.95,
            evidence_notes=" // ".join(combined_notes) if combined_notes else "Consolidado de reportes ciudadanos",
            images=json.dumps(all_images_list) if all_images_list else None,
            country="AR",
            version=new_version,
            is_deleted=False
        )
        db.add(new_threat)

    # Incorporar y validar URLs / Dominios adjuntos si corresponde
    attached_urls_to_process = []
    if req.validate_attached_urls is not None:
        attached_urls_to_process = req.validate_attached_urls
    else:
        # Por defecto tomar todas las URLs adjuntas reportadas en el grupo
        for r in reports_to_validate:
            att = getattr(r, 'attached_url', None)
            if att and att.strip():
                attached_urls_to_process.append(att.strip())

    validated_domains_count = 0
    modalities_for_dom = json.dumps(scam_ids_list) if 'scam_ids_list' in locals() and scam_ids_list else None
    if not modalities_for_dom and existing_threat and existing_threat.scam_type_ids:
        modalities_for_dom = existing_threat.scam_type_ids

    for raw_url in set(attached_urls_to_process):
        raw_clean = raw_url.strip()
        if not raw_clean:
            continue
        c_dom_key = get_canonical_threat_key('domain', raw_clean)
        if not c_dom_key:
            continue

        existing_dom = db.query(Threat).filter(
            Threat.type == "domain",
            Threat.value == c_dom_key,
            Threat.is_deleted == False
        ).first()

        dom_ver = increment_sync_version(db)
        if existing_dom:
            existing_dom.report_count += 1
            existing_dom.status = "validated"
            existing_dom.is_deleted = False
            existing_dom.version = dom_ver
            existing_dom.updated_at = now
            if c_key not in (existing_dom.evidence_notes or ""):
                prev_n = existing_dom.evidence_notes or ""
                existing_dom.evidence_notes = (prev_n + f" | Vinculado a reportes del teléfono {c_key}").strip(" | ")
        else:
            new_dom = Threat(
                type="domain",
                value=c_dom_key,
                risk_level=req.risk_level or "high",
                status="validated",
                scam_type_id=main_scam_id if 'main_scam_id' in locals() else req.scam_type_id,
                scam_type_ids=modalities_for_dom,
                report_count=1,
                confidence_score=0.95,
                evidence_notes=f"Enlace fraudulento reportado junto al teléfono {c_key}",
                images=json.dumps(all_images_list) if all_images_list else None,
                country="AR",
                version=dom_ver,
                is_deleted=False
            )
            db.add(new_dom)
        validated_domains_count += 1

    db.commit()

    extra_msg = f" y {validated_domains_count} enlaces web asociados" if validated_domains_count > 0 else ""
    return {
        "message": f"Se validaron exitosamente {len(reports_to_validate)} denuncias para {c_key}{extra_msg}.",
        "canonical_value": c_key,
        "validated_count": len(reports_to_validate),
        "validated_domains_count": validated_domains_count,
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


@router.post("/{report_id}/accept-update")
def accept_report_update(
    report_id: int,
    db: Session = Depends(get_db)
):
    """
    Acepta un reporte de actualización para una amenaza existente.
    Anexa el comentario ciudadano, suma las nuevas imágenes, y suma la/s nueva/s modalidades
    a las modalidades que ya tenía la amenaza, incrementando la versión de sincronización.
    """
    from app.api.v1.endpoints.threats import _enrich_threat
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    c_key = get_canonical_threat_key(report.threat_type, report.threat_value)
    g_type = "phone" if report.threat_type == "phone" else "domain"

    existing_threat = None
    if report.existing_threat_id:
        existing_threat = db.query(Threat).filter(Threat.id == report.existing_threat_id, Threat.is_deleted == False).first()
    if not existing_threat:
        existing_threat = db.query(Threat).filter(
            Threat.type == g_type,
            Threat.value == c_key,
            Threat.is_deleted == False
        ).first()

    if not existing_threat:
        raise HTTPException(status_code=404, detail="No se encontró la amenaza existente correspondiente a este reporte.")

    now = datetime.now(timezone.utc)
    new_version = increment_sync_version(db)

    # 1. Sumar comentario a evidence_notes
    if report.description:
        new_note = f"[{report.channel.upper()} {now.strftime('%d/%m/%Y')}]: {report.description}"
        if report.evidence:
            new_note += f" (Detalle: {report.evidence})"
        exist_notes = existing_threat.evidence_notes or ""
        existing_threat.evidence_notes = (exist_notes + " | " + new_note).strip(" | ")

    # 2. Sumar imágenes sin duplicados
    if report.images:
        exist_imgs = set(_parse_images_list(existing_threat.images))
        new_imgs = set(_parse_images_list(report.images))
        combined_imgs = list(exist_imgs.union(new_imgs))
        if combined_imgs:
            existing_threat.images = json.dumps(combined_imgs)

    # 3. Sumar modalidades (conservando las anteriores)
    exist_scam_ids = set(existing_threat.get_scam_type_ids_list())
    rep_scam_ids = set(report.get_scam_type_ids_list())
    combined_scam_ids = sorted(list(exist_scam_ids.union(rep_scam_ids)))
    if combined_scam_ids:
        existing_threat.scam_type_ids = json.dumps(combined_scam_ids)
        if not existing_threat.scam_type_id:
            existing_threat.scam_type_id = combined_scam_ids[0]

    # 4. Actualizar conteo, versión y timestamp
    existing_threat.report_count += 1
    existing_threat.status = "validated"
    existing_threat.version = new_version
    existing_threat.updated_at = now

    # 5. Marcar reporte como validado
    report.status = "validated"
    report.reviewed_at = now
    report.reviewer_notes = f"Actualización aceptada e incorporada a la Amenaza #{existing_threat.id}"

    db.commit()
    db.refresh(existing_threat)
    db.refresh(report)

    all_sts = _get_scam_types_map(db)
    return {
        "message": f"Actualización incorporada con éxito a la amenaza #{existing_threat.id} ({existing_threat.value}).",
        "threat": _enrich_threat(existing_threat, all_sts),
        "report": _enrich_report(report, all_sts, existing_threat),
        "sync_version": new_version
    }


@router.post("/{report_id}/reject-update")
def reject_report_update(
    report_id: int,
    notes: Optional[str] = Query(None, description="Motivo del descarte"),
    db: Session = Depends(get_db)
):
    """
    Descarta un reporte de actualización de caso existente (no modifica la amenaza).
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    report.status = "rejected"
    report.reviewed_at = datetime.now(timezone.utc)
    report.reviewer_notes = notes or "Descartado: la información no aporta nuevos elementos al caso existente."

    db.commit()
    return {
        "message": f"Reporte de actualización #{report_id} descartado.",
        "id": report_id
    }


@router.get("", response_model=List[ReportRead])
def list_reports(
    status: Optional[str] = Query(None, description="Filtrar por estado: pending, in_review, validated, rejected"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Listado administrativo de reportes individuales de la comunidad."""
    query = db.query(Report)
    if status and status != "all":
        query = query.filter(Report.status == status)
    reports = query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()
    sts_map = _get_scam_types_map(db)
    return [_enrich_report(r, sts_map) for r in reports]


@router.get("/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: Session = Depends(get_db)):
    """Obtiene el detalle completo de un reporte específico."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    sts_map = _get_scam_types_map(db)
    return _enrich_report(report, sts_map)


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
    if report_in.attached_url is not None:
        report.attached_url = report_in.attached_url.strip() if report_in.attached_url else None
    if report_in.scam_type_ids is not None:
        report.scam_type_ids = json.dumps(report_in.scam_type_ids)
        if report_in.scam_type_ids:
            report.scam_type_id = report_in.scam_type_ids[0]
    elif report_in.scam_type_id is not None:
        report.scam_type_id = report_in.scam_type_id
        cur_ids = report.get_scam_type_ids_list()
        if report_in.scam_type_id not in cur_ids:
            cur_ids.append(report_in.scam_type_id)
        report.scam_type_ids = json.dumps(cur_ids)
    if report_in.status is not None:
        report.status = report_in.status
        report.reviewed_at = datetime.now(timezone.utc)
    if report_in.reviewer_notes is not None:
        report.reviewer_notes = report_in.reviewer_notes

    db.commit()
    db.refresh(report)
    sts_map = _get_scam_types_map(db)
    return _enrich_report(report, sts_map)


@router.patch("/{report_id}/status", response_model=ReportRead)
def update_report_status(
    report_id: int,
    status_update: ReportUpdateStatus,
    db: Session = Depends(get_db)
):
    """
    Panel administrativo: Cambia el estado de un reporte individual (e.g. Validar o Rechazar).
    Si se valida con create_or_update_threat=True, se actualiza o crea la amenaza en la base central,
    combinando imágenes y modalidades, y se incrementa la versión de sincronización para que impacte en los celulares Android.
    Si el reporte contiene una URL o dominio adjunto y validate_attached_url=True, también se crea/actualiza la amenaza web.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")

    report.status = status_update.status
    report.reviewer_notes = status_update.reviewer_notes
    report.reviewed_at = datetime.now(timezone.utc)

    existing_threat_ref = None

    if status_update.status == "validated" and status_update.create_or_update_threat:
        canonical_key = get_canonical_threat_key(report.threat_type, report.threat_value)
        threat_type = "phone" if report.threat_type == "phone" else "domain"
        
        existing = db.query(Threat).filter(
            Threat.type == threat_type,
            Threat.value == canonical_key,
            Threat.is_deleted == False
        ).first()

        new_version = increment_sync_version(db)

        if existing:
            existing.report_count += 1
            existing.status = "validated"
            existing.is_deleted = False
            existing.version = new_version
            if report.images:
                exist_imgs = set(_parse_images_list(existing.images))
                new_imgs = set(_parse_images_list(report.images))
                combined = list(exist_imgs.union(new_imgs))
                existing.images = json.dumps(combined)
            
            # Combinar modalidades
            exist_scam_ids = set(existing.get_scam_type_ids_list())
            rep_ids = set(report.get_scam_type_ids_list())
            combined_scam_ids = sorted(list(exist_scam_ids.union(rep_ids)))
            if combined_scam_ids:
                existing.scam_type_ids = json.dumps(combined_scam_ids)
                if not existing.scam_type_id:
                    existing.scam_type_id = combined_scam_ids[0]

            if report.description:
                exist_notes = existing.evidence_notes or ""
                existing.evidence_notes = (exist_notes + f" | [{report.channel.upper()}]: {report.description}").strip(" | ")
            existing.updated_at = datetime.now(timezone.utc)
            existing_threat_ref = existing
        else:
            rep_ids = report.get_scam_type_ids_list()
            new_threat = Threat(
                type=threat_type,
                value=canonical_key,
                risk_level="high",
                status="validated",
                scam_type_id=report.scam_type_id or (rep_ids[0] if rep_ids else None),
                scam_type_ids=json.dumps(rep_ids) if rep_ids else None,
                report_count=1,
                confidence_score=0.95,
                evidence_notes=report.description,
                images=report.images,
                country=report.country,
                version=new_version,
                is_deleted=False
            )
            db.add(new_threat)
            existing_threat_ref = new_threat

        # Validar e incorporar URL/dominio adjunto si existe
        if status_update.validate_attached_url and getattr(report, 'attached_url', None):
            raw_att = report.attached_url.strip()
            if raw_att:
                c_dom_key = get_canonical_threat_key('domain', raw_att)
                if c_dom_key:
                    existing_dom = db.query(Threat).filter(
                        Threat.type == "domain",
                        Threat.value == c_dom_key,
                        Threat.is_deleted == False
                    ).first()
                    dom_v = increment_sync_version(db)
                    if existing_dom:
                        existing_dom.report_count += 1
                        existing_dom.status = "validated"
                        existing_dom.is_deleted = False
                        existing_dom.version = dom_v
                        existing_dom.updated_at = datetime.now(timezone.utc)
                    else:
                        rep_s_ids = report.get_scam_type_ids_list()
                        new_dom_th = Threat(
                            type="domain",
                            value=c_dom_key,
                            risk_level="high",
                            status="validated",
                            scam_type_id=report.scam_type_id or (rep_s_ids[0] if rep_s_ids else None),
                            scam_type_ids=json.dumps(rep_s_ids) if rep_s_ids else None,
                            report_count=1,
                            confidence_score=0.95,
                            evidence_notes=f"Enlace fraudulento reportado en la denuncia #{report.id} ({canonical_key})",
                            images=report.images,
                            country=report.country,
                            version=dom_v,
                            is_deleted=False
                        )
                        db.add(new_dom_th)

    db.commit()
    db.refresh(report)
    sts_map = _get_scam_types_map(db)
    return _enrich_report(report, sts_map, existing_threat_ref)
