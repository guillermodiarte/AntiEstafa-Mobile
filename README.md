# 🛡️ Escudo Digital — Ecosistema de Prevención de Estafas Digitales

**FormosaHack 2026** — Solución a la problemática de Seguridad y Ciberdelito orientada prioritariamente a adultos mayores y a la comunidad.

---

## 📌 Propósito y Visión

**Escudo Digital** es un ecosistema colaborativo y preventivo diseñado para proteger a usuarios frente a fraudes telefónicos, estafas por WhatsApp/SMS, suplantación bancaria y enlaces de phishing.

### Principios Fundamentales
1. **Protección en Segundo Plano**: Funciona de forma automática sin exigir al adulto mayor copiar/pegar textos ni comprender términos técnicos.
2. **Privacidad por Diseño**: No almacena conversaciones ni lee contenido privado; solo evalúa señales disponibles (remitentes, números, dominios de destino).
3. **Funcionamiento 100% Offline**: El dispositivo Android cuenta con su propia base local y motor heurístico de riesgo, protegiendo aun sin internet.
4. **Sincronización Incremental Eficiente**: Actualizaciones por deltas de versión (`v1`, `v2`, etc.) que cuidan la batería y el consumo de datos móviles.
5. **Ecosistema Abierto**: API pública y canal de reportes para que la información comunitaria beneficie a toda la sociedad.

---

## 🏗️ Arquitectura del Proyecto

```text
FormosaHack/
├── backend/            # FastAPI + SQLite/PostgreSQL (Base Central, API Pública, Sync Móvil)
│   ├── app/
│   │   ├── api/v1/     # Endpoints: /threats, /reports, /scam-types, /mobile/sync, /stats
│   │   ├── core/       # Configuración y conexión de BD
│   │   ├── models/     # Modelos SQLAlchemy (Threat, ScamType, Report, SyncState)
│   │   ├── schemas/    # Validación Pydantic v2
│   │   └── seeds/      # Casos reales de estafas en Argentina (ANSES, Mercado Pago, etc.)
│   └── tests/          # Suite de pruebas unitarias e integración (100% pasando)
├── web/                # Next.js 16 + TypeScript + Tailwind (Portal Ciudadano & Panel de Control)
│   ├── src/app/        # App Router, Layout y estilos con Glassmorphism
│   ├── src/components/ # Buscador de Amenazas, Modalidades, Reportes, Moderador y API
│   ├── src/services/   # Cliente API resiliente con fallbacks
│   └── src/types/      # Tipado estricto
└── android/            # (Fase Siguiente: App nativa Kotlin + Jetpack + Room)
```

---

## 🚀 Cómo Ejecutar el Proyecto

### 1. Backend (FastAPI)
Requiere Python 3.10+:

```bash
cd backend
./run.sh
```
- API Base: `http://localhost:8000`
- Documentación Interactiva Swagger: `http://localhost:8000/docs`
- Pruebas automatizadas: `./venv/bin/pytest -v`

### 2. Portal Web (Next.js)
Requiere Node.js 18+:

```bash
cd web
./run.sh
```
- Portal Web: `http://localhost:3000`

---

## 🧪 Pruebas de Demostración (Demo en Vivo)

1. **Búsqueda Preventiva**: Probar números conocidos como `+5491138901234` (Falso familiar) o `anses-beneficios-gob-ar.site` (Phishing).
2. **Reporte Ciudadano**: Denunciar un nuevo número o sitio web sospechoso desde el formulario.
3. **Moderación y Sync**: En el panel moderador, validar el reporte y observar cómo la versión global de sincronización se incrementa inmediatamente para alimentar a los celulares.
4. **API Pública**: Consultar endpoints como `GET /api/v1/threats/phone/+5491138901234` o `GET /api/v1/mobile/sync?since_version=0`.
