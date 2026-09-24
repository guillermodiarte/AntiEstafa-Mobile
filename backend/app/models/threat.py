from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Threat(Base):
    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, index=True)
    # Type: 'phone', 'domain', 'url'
    type = Column(String(20), nullable=False, index=True)
    # Value normalized: e.g. "+5491123456789", "banco-galicia-seguro.com", "https://..."
    value = Column(String(255), nullable=False, index=True)
    
    # Risk Level: 'low', 'medium', 'high'
    risk_level = Column(String(20), default="high", nullable=False)
    
    # Status: 'pending', 'in_review', 'validated', 'rejected'
    status = Column(String(20), default="validated", nullable=False, index=True)
    
    scam_type_id = Column(Integer, ForeignKey("scam_types.id"), nullable=True)
    report_count = Column(Integer, default=1)
    confidence_score = Column(Float, default=0.9)  # 0.0 to 1.0
    evidence_notes = Column(Text, nullable=True)
    country = Column(String(10), default="AR", nullable=True)
    
    # Sincronización móvil incremental (versión monótona creciente)
    version = Column(Integer, default=1, index=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    scam_type = relationship("ScamType", back_populates="threats")
