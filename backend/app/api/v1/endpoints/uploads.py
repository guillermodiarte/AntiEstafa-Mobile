import os
import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()

# Directorio donde se guardan las imágenes subidas
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB por imagen


@router.post("", response_model=List[str])
async def upload_images(files: List[UploadFile] = File(...)):
    """
    Permite subir una o más imágenes de evidencia (capturas de WhatsApp, SMS, comprobantes).
    Guarda los archivos en el servidor y retorna las URLs relativas para previsualización y guardado.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No se enviaron archivos")

    saved_urls: List[str] = []

    for file in files:
        _, ext = os.path.splitext(file.filename or "")
        ext = ext.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Formato no permitido ({ext}). Formatos válidos: PNG, JPG, JPEG, WEBP, GIF"
            )

        # Generar nombre único para evitar colisiones
        unique_name = f"evidencia_{uuid.uuid4().hex[:12]}{ext}"
        destination_path = os.path.join(UPLOAD_DIR, unique_name)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo {file.filename} supera el límite de 10 MB"
            )

        with open(destination_path, "wb") as f:
            f.write(content)

        saved_urls.append(f"/uploads/{unique_name}")

    return saved_urls
