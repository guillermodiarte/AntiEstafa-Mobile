from typing import List, Optional
from pydantic import BaseModel


class SyncItem(BaseModel):
    id: int
    type: str  # 'phone', 'domain', 'url'
    value: str
    risk_level: str
    category: Optional[str] = None
    version: int
    is_deleted: bool


class SyncResponse(BaseModel):
    current_version: int
    since_version: int
    has_more: bool = False
    items: List[SyncItem]
    total_changes: int
