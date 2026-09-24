from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.scam_type import ScamTypeRead


class ReportBase(BaseModel):
    channel: str = "web"  # 'whatsapp', 'sms', 'call', 'web'
    threat_type: str  # 'phone', 'domain', 'url'
    threat_value: str
    description: str
    evidence: Optional[str] = None
    scam_type_id: Optional[int] = None
    country: Optional[str] = "AR"


class ReportCreate(ReportBase):
    pass


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
