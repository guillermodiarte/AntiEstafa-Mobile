import re
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.threat import Threat
from app.models.sync_meta import SyncState
from app.models.report import Report
from app.models.scam_type import ScamType


def normalize_phone(phone: str) -> str:
    """Normaliza un número de teléfono a solo dígitos o con prefijo +"""
    if not phone:
        return ""
    clean = re.sub(r"[^\d+]", "", phone.strip())
    # Si no tiene +, normalizamos formatos locales argentinos típicos (ej: 011 -> +5411, 15...)
    return clean


def normalize_domain(domain_or_url: str) -> str:
    """Normaliza un dominio extrayendo host en minúsculas sin www ni protocolos"""
    if not domain_or_url:
        return ""
    raw = domain_or_url.strip().lower()
    # Remover protocolo
    raw = re.sub(r"^https?://", "", raw)
    # Extraer primer segmento de path
    parts = raw.split("/")
    host = parts[0]
    # Remover puerto
    host = host.split(":")[0]
    # Remover www.
    if host.startswith("www."):
        host = host[4:]
    return host


def get_or_create_sync_state(db: Session) -> SyncState:
    state = db.query(SyncState).first()
    if not state:
        state = SyncState(id=1, current_version=1)
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def increment_sync_version(db: Session) -> int:
    state = get_or_create_sync_state(db)
    state.current_version += 1
    db.commit()
    db.refresh(state)
    return state.current_version


def check_phone_threat(db: Session, phone: str) -> Optional[Threat]:
    normalized = normalize_phone(phone)
    if not normalized:
        return None
    
    # Búsqueda exacta o sufijo (ej: si buscan 1123456789 y está guardado +5491123456789 o viceversa)
    threat = db.query(Threat).filter(
        Threat.type == "phone",
        Threat.is_deleted == False,
        Threat.status == "validated"
    ).filter(
        (Threat.value == normalized) | 
        (Threat.value.endswith(normalized[-8:] if len(normalized) >= 8 else normalized))
    ).first()
    return threat


def check_domain_threat(db: Session, domain: str) -> Optional[Threat]:
    normalized = normalize_domain(domain)
    if not normalized:
        return None
    
    threat = db.query(Threat).filter(
        Threat.type == "domain",
        Threat.is_deleted == False,
        Threat.status == "validated"
    ).filter(
        (Threat.value == normalized) |
        (Threat.value.endswith("." + normalized))
    ).first()
    return threat


def check_url_threat(db: Session, url: str) -> Optional[Threat]:
    clean_url = url.strip()
    # Primero chequeamos URL exacta
    threat = db.query(Threat).filter(
        Threat.type == "url",
        Threat.is_deleted == False,
        Threat.status == "validated",
        Threat.value == clean_url
    ).first()
    
    if not threat:
        # Chequear por el dominio de la URL
        domain = normalize_domain(url)
        if domain:
            threat = check_domain_threat(db, domain)
            
    return threat
