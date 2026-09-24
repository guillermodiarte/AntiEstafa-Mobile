from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class SyncState(Base):
    __tablename__ = "sync_states"

    id = Column(Integer, primary_key=True)
    current_version = Column(Integer, default=1, nullable=False)
    last_updated = Column(DateTime, default=utc_now, onupdate=utc_now)
