import time
import hmac
import hashlib
import random
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter()

CAPTCHA_SECRET = settings.SECRET_KEY or "escudo-digital-anti-bot-secret"
EXPIRATION_SECONDS = 900  # 15 minutos


class CaptchaResponse(BaseModel):
    token: str
    question: str
    expires_in: int = EXPIRATION_SECONDS


def generate_captcha_token(answer: int, timestamp: int) -> str:
    message = f"{answer}:{timestamp}"
    signature = hmac.new(CAPTCHA_SECRET.encode(), message.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{timestamp}:{signature}"


def verify_captcha_token(token: str, user_answer: str) -> bool:
    if not token or not user_answer:
        return False

    try:
        parts = token.split(":")
        if len(parts) != 2:
            return False

        timestamp_str, signature = parts
        timestamp = int(timestamp_str)

        # Verificar expiración
        now = int(time.time())
        if now - timestamp > EXPIRATION_SECONDS or timestamp > now + 30:
            return False

        # Verificar valor numérico
        ans_clean = user_answer.strip()
        ans_num = int(ans_clean)

        expected_sig = hmac.new(CAPTCHA_SECRET.encode(), f"{ans_num}:{timestamp}".encode(), hashlib.sha256).hexdigest()[:24]
        return hmac.compare_digest(signature, expected_sig)
    except Exception:
        return False


@router.get("", response_model=CaptchaResponse)
def get_captcha_challenge():
    """
    Genera un desafío anti-bot simple y accesible para humanos (e.g. adultos mayores):
    Una suma o resta básica de un solo dígito con token criptográfico firmado.
    """
    op = random.choice(["+", "-"])
    if op == "+":
        a = random.randint(2, 8)
        b = random.randint(1, 7)
        ans = a + b
        question = f"¿Cuánto es {a} + {b}?"
    else:
        a = random.randint(5, 9)
        b = random.randint(1, 4)
        ans = a - b
        question = f"¿Cuánto es {a} - {b}?"

    now = int(time.time())
    token = generate_captcha_token(ans, now)

    return CaptchaResponse(
        token=token,
        question=question,
        expires_in=EXPIRATION_SECONDS
    )
