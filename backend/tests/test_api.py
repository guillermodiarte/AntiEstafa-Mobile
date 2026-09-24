import pytest
from fastapi.testclient import TestClient
from app.main import app




def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "api_v1" in data


def test_check_threat_phone(client):
    # Número sembrado
    response = client.get("/api/v1/threats/phone/+5491138901234")
    assert response.status_code == 200
    data = response.json()
    assert data["is_threat"] is True
    assert data["risk_level"] == "high"
    assert data["details"]["tipo"] == "phone"

    # Número limpio/desconocido
    response_clean = client.get("/api/v1/threats/phone/+5491199990000")
    assert response_clean.status_code == 200
    assert response_clean.json()["is_threat"] is False


def test_check_threat_domain(client):
    # Dominio sembrado
    response = client.get("/api/v1/threats/domain/anses-beneficios-gob-ar.site")
    assert response.status_code == 200
    data = response.json()
    assert data["is_threat"] is True
    assert data["details"]["tipo"] == "domain"


def test_check_threat_url(client):
    response = client.get("/api/v1/threats/url?url=http://pami-credencial-digital-actualizar.online/verificar?user=30123456")
    assert response.status_code == 200
    data = response.json()
    assert data["is_threat"] is True


def test_scam_types(client):
    response = client.get("/api/v1/scam-types")
    assert response.status_code == 200
    types = response.json()
    assert len(types) >= 4
    slugs = [t["slug"] for t in types]
    assert "falso-familiar" in slugs
    assert "suplantacion-banco" in slugs


def test_mobile_sync(client):
    # Sincronización completa inicial (since_version=0)
    response = client.get("/api/v1/mobile/sync?since_version=0")
    assert response.status_code == 200
    data = response.json()
    assert data["current_version"] > 0
    assert len(data["items"]) > 0

    # Sincronización incremental con versión al día
    current_v = data["current_version"]
    sync_up_to_date = client.get(f"/api/v1/mobile/sync?since_version={current_v}")
    assert sync_up_to_date.status_code == 200
    assert len(sync_up_to_date.json()["items"]) == 0


def test_citizen_report_and_validation_flow(client):
    # 1. Crear reporte ciudadano
    new_report = {
        "channel": "whatsapp",
        "threat_type": "phone",
        "threat_value": "+5491177778888",
        "description": "Llegó mensaje sospechoso pidiendo código de verificación de WhatsApp.",
        "evidence": "Texto del mensaje recibido.",
        "country": "AR"
    }
    create_res = client.post("/api/v1/reports", json=new_report)
    assert create_res.status_code == 201
    report_data = create_res.json()
    report_id = report_data["id"]
    assert report_data["status"] == "pending"

    # 2. Verificar que no está aún en la base de amenazas
    threat_check = client.get("/api/v1/threats/phone/+5491177778888")
    assert threat_check.json()["is_threat"] is False

    # 3. Administrador valida el reporte
    validate_res = client.patch(
        f"/api/v1/reports/{report_id}/status",
        json={"status": "validated", "reviewer_notes": "Confirmado intento de secuestro de cuenta.", "create_or_update_threat": True}
    )
    assert validate_res.status_code == 200
    assert validate_res.json()["status"] == "validated"

    # 4. Ahora sí debe aparecer como amenaza
    threat_check_after = client.get("/api/v1/threats/phone/+5491177778888")
    assert threat_check_after.json()["is_threat"] is True

    # 5. La sincronización móvil debe detectar este nuevo cambio
    sync_delta = client.get("/api/v1/mobile/sync?since_version=1")
    items_values = [i["value"] for i in sync_delta.json()["items"]]
    assert "+5491177778888" in items_values


def test_stats(client):
    response = client.get("/api/v1/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["total_threats"] > 0
    assert data["status"] == "operational"
    assert "top_scam_types" in data
