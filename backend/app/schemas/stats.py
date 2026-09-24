from typing import List, Dict, Any
from pydantic import BaseModel


class ScamTypeStat(BaseModel):
    category: str
    count: int


class SystemStatsResponse(BaseModel):
    total_threats: int
    total_phone_threats: int
    total_domain_threats: int
    total_url_threats: int
    total_reports: int
    total_validated_reports: int
    current_sync_version: int
    top_scam_types: List[ScamTypeStat]
    status: str = "operational"
