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
    scam_type_id: Optional[int] = None
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
    scam_type_id: Optional[int] = None
    status: Optional[str] = None
    reviewer_notes: Optional[str] = None


class ReportUpdateStatus(BaseModel):
    status: str  # 'pending', 'in_review', 'validated', 'rejected', 'duplicate'
    reviewer_notes: Optional[str] = None
    create_or_update_threat: bool = True  # Al validar, incorporar automáticamente a la base


class ReportRead(ReportBase):
    id: int
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None
    scam_type: Optional[ScamTypeRead] = None

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
    sample_descriptions: List[str]
    scam_type_id: Optional[int] = None
    scam_type_name: Optional[str] = None
    latest_created_at: datetime
    report_ids: List[int]
    reports: List[ReportRead]


class GroupValidateRequest(BaseModel):
    canonical_value: str
    threat_type: str
    scam_type_id: Optional[int] = None
    risk_level: str = "high"
    reviewer_notes: Optional[str] = "Aprobado y consolidado por moderación comunitaria"
    report_ids: Optional[List[int]] = None


class GroupRejectRequest(BaseModel):
    canonical_value: str
    threat_type: str
    reviewer_notes: Optional[str] = "Descartado por moderador (reporte falso o inválido)"
    report_ids: Optional[List[int]] = None
