import io
import os
import uuid
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image, ImageOps
from app.core.config import settings

router = APIRouter()

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".jfif"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # Acepta hasta 15MB de entrada, pero lo comprime fuertemente
MAX_DIMENSION = 1280  # Dimensión máxima en píxeles (suficiente para ver capturas y comprobantes sin perder nitidez)
WEBP_QUALITY = 82     # Calidad de compresión WebP óptima (ahorro de más de 85% de espacio)


@router.post("", response_model=List[str])
async def upload_images(files: List[UploadFile] = File(...)):
    """
    Sube y optimiza una o más imágenes de evidencia (capturas de pantalla, fotos de comprobantes).
    Convierte automáticamente a formato WebP optimizado y redimensiona para ahorrar espacio en servidor.
    Retorna la lista de URLs relativas (/uploads/evidencia_xxxx.webp).
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
                detail=f"Formato no permitido ({ext}). Formatos válidos: PNG, JPG, JPEG, WEBP, GIF, BMP"
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo {file.filename} supera el límite de 15 MB"
            )

        try:
            # Abrir la imagen en memoria con Pillow
            image = Image.open(io.BytesIO(content))

            # Corregir orientación basada en metadatos EXIF (común en fotos de teléfonos)
            image = ImageOps.exif_transpose(image)

            # Convertir modo de color adecuado para WebP
            if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
                image = image.convert("RGBA")
            elif image.mode != "RGB":
                image = image.convert("RGB")

            # Redimensionar si supera la resolución máxima para ahorrar disco sin perder legibilidad
            if image.width > MAX_DIMENSION or image.height > MAX_DIMENSION:
                image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

            # Nombre único siempre en formato .webp
            unique_name = f"evidencia_{uuid.uuid4().hex[:12]}.webp"
            destination_path = os.path.join(UPLOAD_DIR, unique_name)

            # Guardar comprimido como WebP
            image.save(
                destination_path,
                format="WEBP",
                quality=WEBP_QUALITY,
                method=6
            )

            saved_urls.append(f"/uploads/{unique_name}")

        except Exception as e:
            # Si Pillow falla al procesar la imagen
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo procesar la imagen {file.filename}: {str(e)}"
            )

    return saved_urls
