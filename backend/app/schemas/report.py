from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.scam_type import ScamTypeRead


class ReportBase(BaseModel):
    channel: str = "web"  # 'whatsapp', 'sms', 'call', 'web'
    threat_type: str  # 'phone', 'domain', 'url'
    threat_value: str
    description: str
    evidence: Optional[str] = None
    images: Optional[str] = None  # JSON array string or comma separated URLs
    attached_url: Optional[str] = None  # Enlace o sitio web opcional adjunto en SMS/llamada/WhatsApp
    scam_type_id: Optional[int] = None
    scam_type_ids: Optional[List[int]] = None
    country: Optional[str] = "AR"


class ReportCreate(ReportBase):
    captcha_token: Optional[str] = None
    captcha_answer: Optional[str] = None
    hp_token: Optional[str] = None  # Honeypot field for bot detection


class ReportUpdate(BaseModel):
    channel: Optional[str] = None
    threat_type: Optional[str] = None
    threat_value: Optional[str] = None
    description: Optional[str] = None
    evidence: Optional[str] = None
    images: Optional[str] = None
    attached_url: Optional[str] = None
    scam_type_id: Optional[int] = None
    scam_type_ids: Optional[List[int]] = None
    status: Optional[str] = None
    reviewer_notes: Optional[str] = None


class ReportUpdateStatus(BaseModel):
    status: str  # 'pending', 'in_review', 'validated', 'rejected', 'duplicate'
    reviewer_notes: Optional[str] = None
    create_or_update_threat: bool = True  # Al validar, incorporar automáticamente a la base
    validate_attached_url: bool = True  # Al validar, incorporar también el enlace/dominio adjunto si existe


class ReportRead(ReportBase):
    id: int
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None
    scam_type: Optional[ScamTypeRead] = None
    scam_types: List[ScamTypeRead] = []
    existing_threat_id: Optional[int] = None
    is_update: bool = False
    already_in_database: bool = False
    existing_threat_value: Optional[str] = None
    existing_threat_modalities: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class GroupedReport(BaseModel):
    canonical_value: str
    threat_type: str
    total_reports: int
    pending_reports: int
    validated_reports: int
    rejected_reports: int
    channels: List[str]
    all_images: List[str]
    attached_urls: List[str] = []  # Enlaces o dominios web reportados junto al teléfono
    sample_descriptions: List[str]
    scam_type_id: Optional[int] = None
    scam_type_ids: List[int] = []
    scam_type_name: Optional[str] = None
    scam_types: List[ScamTypeRead] = []
    latest_created_at: datetime
    report_ids: List[int]
    reports: List[ReportRead]
    is_existing_threat: bool = False
    existing_threat_id: Optional[int] = None
    existing_threat_modalities: List[str] = []


class GroupValidateRequest(BaseModel):
    canonical_value: str
    threat_type: str
    scam_type_id: Optional[int] = None
    risk_level: str = "high"
    reviewer_notes: Optional[str] = "Aprobado y consolidado por moderación comunitaria"
    report_ids: Optional[List[int]] = None
    validate_attached_urls: Optional[List[str]] = None  # Lista específica de URLs adjuntas a validar como amenazas web


class GroupRejectRequest(BaseModel):
    canonical_value: str
    threat_type: str
    reviewer_notes: Optional[str] = "Descartado por moderador (reporte falso o inválido)"
    report_ids: Optional[List[int]] = None
