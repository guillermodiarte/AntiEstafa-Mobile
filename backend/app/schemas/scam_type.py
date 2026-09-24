from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ScamTypeBase(BaseModel):
    name: str
    slug: str
    description: str
    advice: Optional[str] = None
    icon: Optional[str] = "alert-triangle"
    is_active: bool = True


class ScamTypeCreate(ScamTypeBase):
    pass


class ScamTypeRead(ScamTypeBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
