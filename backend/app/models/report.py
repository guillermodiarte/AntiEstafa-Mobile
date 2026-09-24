from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    # Channel: 'whatsapp', 'sms', 'call', 'web'
    channel = Column(String(30), default="web", nullable=False)
    
    # Threat Type: 'phone', 'domain', 'url', 'other'
    threat_type = Column(String(20), nullable=False)
    threat_value = Column(String(255), nullable=False, index=True)
    
    description = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)
    
    scam_type_id = Column(Integer, ForeignKey("scam_types.id"), nullable=True)
    
    # Status: 'pending', 'in_review', 'validated', 'rejected', 'duplicate'
    status = Column(String(20), default="pending", nullable=False, index=True)
    country = Column(String(10), default="AR", nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_notes = Column(Text, nullable=True)

    scam_type = relationship("ScamType", back_populates="reports")
