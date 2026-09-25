from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
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
    images = Column(Text, nullable=True)  # JSON array of image URLs
    attached_url = Column(String(500), nullable=True)  # Enlace o sitio web opcional recibido junto al mensaje/llamada
    
    scam_type_id = Column(Integer, ForeignKey("scam_types.id"), nullable=True)
    scam_type_ids = Column(Text, nullable=True)  # JSON array of scam_type IDs
    existing_threat_id = Column(Integer, ForeignKey("threats.id"), nullable=True)
    is_update = Column(Boolean, default=False)
    
    # Status: 'pending', 'in_review', 'validated', 'rejected', 'duplicate'
    status = Column(String(20), default="pending", nullable=False, index=True)
    country = Column(String(10), default="AR", nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_notes = Column(Text, nullable=True)

    scam_type = relationship("ScamType", back_populates="reports")
    existing_threat = relationship("Threat", foreign_keys=[existing_threat_id])

    def get_scam_type_ids_list(self):
        import json
        ids = []
        if self.scam_type_ids:
            try:
                ids = json.loads(self.scam_type_ids)
                if not isinstance(ids, list):
                    ids = [ids]
            except Exception:
                pass
        if not ids and self.scam_type_id:
            ids = [self.scam_type_id]
        return ids
