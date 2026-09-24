from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.scam_type import ScamType
from app.schemas.scam_type import ScamTypeRead, ScamTypeCreate

router = APIRouter()


@router.get("", response_model=List[ScamTypeRead])
def list_scam_types(db: Session = Depends(get_db)):
    """Lista las modalidades de estafas activas con consejos preventivos."""
    return db.query(ScamType).filter(ScamType.is_active == True).all()


@router.post("", response_model=ScamTypeRead, status_code=201)
def create_scam_type(scam_in: ScamTypeCreate, db: Session = Depends(get_db)):
    """Permite incorporar nuevas modalidades dinámicamente."""
    existing = db.query(ScamType).filter(ScamType.slug == scam_in.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una modalidad con ese slug")

    st = ScamType(
        name=scam_in.name,
        slug=scam_in.slug,
        description=scam_in.description,
        advice=scam_in.advice,
        icon=scam_in.icon,
        is_active=scam_in.is_active
    )
    db.add(st)
    db.commit()
    db.refresh(st)
    return st
