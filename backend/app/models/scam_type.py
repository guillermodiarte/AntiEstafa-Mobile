from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class ScamType(Base):
    __tablename__ = "scam_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=False)
    advice = Column(Text, nullable=True)  # Recomendaciones claras para el adulto mayor / usuario
    icon = Column(String(50), default="alert-triangle")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    threats = relationship("Threat", back_populates="scam_type")
    reports = relationship("Report", back_populates="scam_type")
