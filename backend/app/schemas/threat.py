from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.scam_type import ScamTypeRead


class ThreatBase(BaseModel):
    type: str  # 'phone', 'domain', 'url'
    value: str
    risk_level: str = "high"  # 'low', 'medium', 'high'
    status: str = "validated"  # 'pending', 'in_review', 'validated', 'rejected'
    scam_type_id: Optional[int] = None
    report_count: int = 1
    confidence_score: float = 0.9
    evidence_notes: Optional[str] = None
    country: Optional[str] = "AR"


class ThreatCreate(ThreatBase):
    pass


class ThreatUpdate(BaseModel):
    risk_level: Optional[str] = None
    status: Optional[str] = None
    scam_type_id: Optional[int] = None
    report_count: Optional[int] = None
    confidence_score: Optional[float] = None
    evidence_notes: Optional[str] = None
    is_deleted: Optional[bool] = None


class ThreatRead(ThreatBase):
    id: int
    version: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    scam_type: Optional[ScamTypeRead] = None

    model_config = ConfigDict(from_attributes=True)


class ThreatPublicView(BaseModel):
    """Formato compatible con Section 27 del manual AGENTS.md"""
    tipo: str
    valor: str
    nivel: str
    estado: str
    categoria: Optional[str] = None
    recomendacion: Optional[str] = None
    cantidad_reportes: int = 1
    ultima_actualizacion: str

    model_config = ConfigDict(from_attributes=True)


class ThreatCheckResult(BaseModel):
    is_threat: bool
    risk_level: str  # 'low', 'medium', 'high', 'unknown'
    message: str
    details: Optional[ThreatPublicView] = None
