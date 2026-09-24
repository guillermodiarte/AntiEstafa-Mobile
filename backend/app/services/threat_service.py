import re
from urllib.parse import urlparse
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.threat import Threat
from app.models.sync_meta import SyncState
from app.models.report import Report
from app.models.scam_type import ScamType


def normalize_phone(phone: str) -> str:
    """
    Normaliza números de teléfono mediante expresiones regulares para agrupar todas las variantes:
    - +543513146924
    - +5493513146924
    - 3513146924
    - 03513146924
    - 0351-15-3146924
    Todas convergen a la clave canónica unificada: +5493513146924.
    """
    if not phone:
        return ""
    
    # Extraer únicamente los dígitos numéricos
    digits = re.sub(r"\D", "", phone.strip())
    if not digits:
        return ""

    # 1. Remover '15' si está en formato de marcado móvil local argentino:
    # Códigos de área: 11 (2 dígitos), 2xx/3xx (3 dígitos, ej 351, 370), o 4 dígitos (ej 3718, 2966)
    m_15 = re.match(r"^(?:0)?((?:11|[23]\d{2,3}))15(\d{6,8})$", digits)
    if m_15:
        digits = m_15.group(1) + m_15.group(2)

    # 2. Remover prefijos comunes de Argentina (549, 54, 0) para aislar los 10 dígitos nacionales
    if digits.startswith("549") and len(digits) == 13:
        digits = digits[3:]
    elif digits.startswith("54") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    # 3. Si quedaron exactamente 10 dígitos (código de área + número local de Argentina)
    if len(digits) == 10:
        return f"+549{digits}"

    # 4. Para números internacionales con indicativo de país
    if phone.strip().startswith("+"):
        return f"+{digits}"
    return f"+{digits}" if len(digits) > 8 else digits


def normalize_domain(domain_or_url: str) -> str:
    """
    Normaliza URLs y dominios mediante regex y parsing para agrupar variantes equivalentes:
    - www.webfalsa.com
    - webfalsa.com
    - webfalsa.com/algo
    - https://webfalsa.com/pepito
    - http://www.webfalsa.com:8080/login?token=xyz
    Todas convergen al host canónico unificado: webfalsa.com.
    """
    if not domain_or_url:
        return ""
    
    raw = domain_or_url.strip().lower()

    # Si no tiene protocolo, agregarlo temporalmente para parsear limpiamente
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", raw):
        raw_to_parse = "http://" + raw
    else:
        raw_to_parse = raw

    try:
        parsed = urlparse(raw_to_parse)
        host = parsed.hostname or parsed.netloc or parsed.path.split("/")[0]
    except Exception:
        host = raw.split("/")[0]

    # Quitar puerto si quedó adherido
    host = host.split(":")[0]

    # Quitar credenciales si existieran (ej: user:pass@host)
    if "@" in host:
        host = host.split("@")[-1]

    # Quitar prefijo www (www., www1., www2., etc.)
    host = re.sub(r"^www\d*\.", "", host)

    return host.strip().rstrip(".")


def get_canonical_threat_key(threat_type: str, threat_value: str) -> str:
    """Obtiene la clave canónica unificada para agrupar denuncias del mismo objetivo."""
    if not threat_value:
        return ""
    t_type = (threat_type or "").lower()
    if t_type == "phone":
        return normalize_phone(threat_value)
    elif t_type in ("domain", "url"):
        return normalize_domain(threat_value)
    return threat_value.strip().lower()


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
    
    # Búsqueda exacta canónica o por últimos 10/8 dígitos
    national_10 = normalized[-10:] if len(normalized) >= 10 else normalized
    threat = db.query(Threat).filter(
        Threat.type == "phone",
        Threat.is_deleted == False,
        Threat.status == "validated"
    ).filter(
        (Threat.value == normalized) |
        (Threat.value.endswith(national_10)) |
        (Threat.value.endswith(normalized[-8:] if len(normalized) >= 8 else normalized))
    ).first()
    return threat


def check_domain_threat(db: Session, domain: str) -> Optional[Threat]:
    normalized = normalize_domain(domain)
    if not normalized:
        return None
    
    threat = db.query(Threat).filter(
        Threat.type.in_(["domain", "url"]),
        Threat.is_deleted == False,
        Threat.status == "validated"
    ).filter(
        (Threat.value == normalized) |
        (Threat.value.endswith("." + normalized))
    ).first()
    return threat


def check_url_threat(db: Session, url: str) -> Optional[Threat]:
    clean_url = url.strip()
    threat = db.query(Threat).filter(
        Threat.type == "url",
        Threat.is_deleted == False,
        Threat.status == "validated",
        Threat.value == clean_url
    ).first()
    
    if not threat:
        domain = normalize_domain(url)
        if domain:
            threat = check_domain_threat(db, domain)
            
    return threat
