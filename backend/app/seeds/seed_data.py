from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.scam_type import ScamType
from app.models.threat import Threat
from app.models.report import Report
from app.models.sync_meta import SyncState
from app.services.threat_service import normalize_phone, normalize_domain


INITIAL_SCAM_TYPES = [
    {
        "name": "Falso Familiar / Urgencia",
        "slug": "falso-familiar",
        "description": "El estafador se hace pasar por un hijo, nieto o sobrino afirmando que cambió de número y pidiendo dinero de forma urgente para una supuesta emergencia.",
        "advice": "Cortá la llamada o no contestes el mensaje. Llamá directamente a tu familiar a su número de siempre para comprobarlo.",
        "icon": "users"
    },
    {
        "name": "Suplantación Bancaria / Fintech",
        "slug": "suplantacion-banco",
        "description": "Mensajes o llamadas fingiendo ser de Mercado Pago, Banco Nación, Galicia, Provincia, etc., alertando sobre un 'bloqueo de cuenta' o 'compra sospechosa' para robar claves y tokens.",
        "advice": "Los bancos nunca piden claves, tokens de seguridad ni contraseñas por WhatsApp o llamada. No hagas clic en ningún enlace.",
        "icon": "credit-card"
    },
    {
        "name": "Falso Organismo Público (ANSES / PAMI)",
        "slug": "falso-organismo-anses",
        "description": "Falsos trámites de bonos, reparaciones históricas, medicamentos o turnos de ANSES/PAMI requiriendo ir a un cajero automático o compartir datos personales.",
        "advice": "PAMI y ANSES no se comunican por WhatsApp para pedirte datos bancarios ni te mandan al cajero para cobrar bonos.",
        "icon": "landmark"
    },
    {
        "name": "Falso Soporte Técnico / Lotería",
        "slug": "falso-soporte-premio",
        "description": "Avisos de premios millonarios de WhatsApp, autos 0km o falsos técnicos pidiendo instalar aplicaciones como AnyDesk o TeamViewer.",
        "advice": "Nunca instales aplicaciones que te pida un desconocido por teléfono. Permiten que controlen tu celular a distancia.",
        "icon": "shield-alert"
    },
    {
        "name": "Tienda Online / Préstamo Falso",
        "slug": "tienda-prestamo-falso",
        "description": "Publicidades con ofertas inverosímiles (ej: electrodomésticos a precios ridículos) o préstamos inmediatos 'sin requisitos' que exigen un adelanto por transferencia.",
        "advice": "Si el precio es demasiado bueno para ser real o te piden transferir dinero antes de darte el préstamo, es una estafa.",
        "icon": "shopping-bag"
    }
]


INITIAL_THREATS = [
    # Teléfonos reportados en estafas reales
    {
        "type": "phone",
        "value": "+5491138901234",
        "risk_level": "high",
        "scam_type_slug": "falso-familiar",
        "report_count": 14,
        "confidence_score": 0.98,
        "evidence_notes": "Modus operandi: 'Hola mamá, agendá mi nuevo número, tuve un problema con el auto y necesito una transferencia'.",
    },
    {
        "type": "phone",
        "value": "+5493517894561",
        "risk_level": "high",
        "scam_type_slug": "suplantacion-banco",
        "report_count": 27,
        "confidence_score": 0.99,
        "evidence_notes": "Llamada fingiendo ser del centro de seguridad de Mercado Pago alertando de compra no autorizada de un Smart TV.",
    },
    {
        "type": "phone",
        "value": "+5491140028899",
        "risk_level": "high",
        "scam_type_slug": "falso-organismo-anses",
        "report_count": 8,
        "confidence_score": 0.95,
        "evidence_notes": "SMS: 'ANSES informa: bono pendiente de cobro de $70.000. Ingrese para validar datos bancarios'.",
    },
    {
        "type": "phone",
        "value": "+5492615551234",
        "risk_level": "medium",
        "scam_type_slug": "tienda-prestamo-falso",
        "report_count": 3,
        "confidence_score": 0.80,
        "evidence_notes": "Ofrecimiento de créditos personales a tasa 0% solicitando $15.000 de gastos administrativos previos.",
    },
    
    # Dominios de phishing reportados
    {
        "type": "domain",
        "value": "anses-beneficios-gob-ar.site",
        "risk_level": "high",
        "scam_type_slug": "falso-organismo-anses",
        "report_count": 32,
        "confidence_score": 0.99,
        "evidence_notes": "Portal clonado de Mi ANSES con formulario que solicita CBU y clave de homebanking.",
    },
    {
        "type": "domain",
        "value": "seguridad-mercadopago-alerta.com",
        "risk_level": "high",
        "scam_type_slug": "suplantacion-banco",
        "report_count": 45,
        "confidence_score": 1.0,
        "evidence_notes": "Sitio falso imitando el login de Mercado Pago con solicitud de código de 6 dígitos (SMS / WhatsApp).",
    },
    {
        "type": "domain",
        "value": "banco-galicia-recupero-cuenta.xyz",
        "risk_level": "high",
        "scam_type_slug": "suplantacion-banco",
        "report_count": 19,
        "confidence_score": 0.97,
        "evidence_notes": "Página falsa para captura de usuario y clave Galicia Token.",
    },
    {
        "type": "domain",
        "value": "tienda-ofertas-express-arg.shop",
        "risk_level": "high",
        "scam_type_slug": "tienda-prestamo-falso",
        "report_count": 12,
        "confidence_score": 0.92,
        "evidence_notes": "Tienda fantasma promocionada en TikTok/Instagram sin razón social ni CUIT verificable.",
    },

    # URLs específicas
    {
        "type": "url",
        "value": "http://pami-credencial-digital-actualizar.online/verificar?user=30123456",
        "risk_level": "high",
        "scam_type_slug": "falso-organismo-anses",
        "report_count": 16,
        "confidence_score": 0.96,
        "evidence_notes": "Enlace directo distribuido por WhatsApp simulando actualización obligatoria de credencial de jubilado.",
    }
]


INITIAL_REPORTS = [
    {
        "channel": "whatsapp",
        "threat_type": "phone",
        "threat_value": "+5491138901234",
        "description": "Me mandó mensaje diciendo 'Hola abu, se me rompió el teléfono' y me pedía 80 mil pesos para el mecánico.",
        "evidence": "Captura de chat donde pide CBU urgente.",
        "scam_type_slug": "falso-familiar",
        "status": "validated",
        "reviewer_notes": "Patrón confirmado de estafa del falso familiar. Número incorporado a la base."
    },
    {
        "channel": "sms",
        "threat_type": "domain",
        "threat_value": "anses-beneficios-gob-ar.site",
        "description": "Llegó un SMS con un enlace raro diciendo que tenía que confirmar un cobro de ayuda escolar.",
        "evidence": "SMS remitente desconocido.",
        "scam_type_slug": "falso-organismo-anses",
        "status": "validated",
        "reviewer_notes": "Dominio apócrifo verificado. Suplanta organismo estatal."
    },
    {
        "channel": "call",
        "threat_type": "phone",
        "threat_value": "+5491166667777",
        "description": "Me llamaron diciendo que eran de Claro y que había ganado un auto, pero que tenía que pagar el flete.",
        "evidence": "Llamada telefónica insistente.",
        "scam_type_slug": "falso-soporte-premio",
        "status": "pending",
        "reviewer_notes": None
    }
]


def seed_database(db: Session) -> None:
    # 1. Asegurar estado de sincronización
    state = db.query(SyncState).first()
    if not state:
        state = SyncState(id=1, current_version=1)
        db.add(state)
        db.commit()

    # 2. Cargar modalidades si no existen
    slug_to_id = {}
    for item in INITIAL_SCAM_TYPES:
        existing = db.query(ScamType).filter(ScamType.slug == item["slug"]).first()
        if not existing:
            st = ScamType(
                name=item["name"],
                slug=item["slug"],
                description=item["description"],
                advice=item["advice"],
                icon=item["icon"],
                is_active=True
            )
            db.add(st)
            db.commit()
            db.refresh(st)
            slug_to_id[st.slug] = st.id
        else:
            slug_to_id[existing.slug] = existing.id

    # 3. Cargar amenazas iniciales si la tabla está vacía
    if db.query(Threat).count() == 0:
        current_v = state.current_version
        for item in INITIAL_THREATS:
            current_v += 1
            cat_id = slug_to_id.get(item.get("scam_type_slug"))
            
            norm_val = item["value"]
            if item["type"] == "phone":
                norm_val = normalize_phone(item["value"])
            elif item["type"] == "domain":
                norm_val = normalize_domain(item["value"])

            threat = Threat(
                type=item["type"],
                value=norm_val,
                risk_level=item["risk_level"],
                status="validated",
                scam_type_id=cat_id,
                report_count=item["report_count"],
                confidence_score=item["confidence_score"],
                evidence_notes=item["evidence_notes"],
                version=current_v,
                is_deleted=False
            )
            db.add(threat)

        state.current_version = current_v
        db.commit()

    # 4. Cargar reportes iniciales si está vacío
    if db.query(Report).count() == 0:
        for r in INITIAL_REPORTS:
            cat_id = slug_to_id.get(r.get("scam_type_slug"))
            report = Report(
                channel=r["channel"],
                threat_type=r["threat_type"],
                threat_value=r["threat_value"],
                description=r["description"],
                evidence=r["evidence"],
                scam_type_id=cat_id,
                status=r["status"],
                reviewer_notes=r["reviewer_notes"],
                reviewed_at=datetime.now(timezone.utc) if r["status"] == "validated" else None
            )
            db.add(report)
        db.commit()
