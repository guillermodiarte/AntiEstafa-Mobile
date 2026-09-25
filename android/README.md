# Escudo Digital — Módulo Android

Aplicación Android nativa de **Escudo Digital**: el motor de protección preventiva que corre en segundo plano para cuidar a adultos mayores de estafas telefónicas, mensajes fraudulentos y páginas de phishing.

---

## Arquitectura del Módulo Android

```text
app/
├── EscudoApp.kt                          # Application class (canales + sync periódico)
├── core/
│   ├── LocalRiskEngine.kt                # Motor de evaluación heurística + base local
│   ├── RiskResult.kt                     # Modelo de resultado de riesgo (LOW/MEDIUM/HIGH)
│   └── AlertManager.kt                  # Gestión de alertas preventivas al usuario
├── data/
│   ├── local/
│   │   ├── EscudoDatabase.kt             # Room Database (SQLite local, 100% offline)
│   │   ├── dao/
│   │   │   ├── ThreatDao.kt              # Consultas de amenazas con matching flexible
│   │   │   ├── TrustedNumberDao.kt       # Lista blanca del usuario
│   │   │   └── SyncStateDao.kt          # Versión de sincronización incremental
│   │   └── entity/
│   │       ├── LocalThreat.kt            # Amenaza (teléfono / dominio / URL)
│   │       ├── TrustedNumber.kt          # Número de confianza del usuario
│   │       └── SyncState.kt             # Estado de versión local
│   └── repository/
│       └── ThreatRepository.kt           # Repositorio único expuesto a UI
├── notifications/
│   └── ScamNotificationListener.kt       # NotificationListenerService (WhatsApp / SMS)
├── calls/
│   └── ScamCallScreeningService.kt       # CallScreeningService (llamadas entrantes)
├── sync/
│   └── SyncWorker.kt                     # WorkManager: sync incremental con backend
└── ui/
    ├── MainActivity.kt                   # Pantalla principal: "🟢 Protección activa"
    ├── AlertDetailActivity.kt            # Pantalla de alerta (3 preguntas clave)
    └── PermissionGuideActivity.kt        # Guía de permisos
```

---

## Flujo Principal de Protección (AGENTS.md §6)

```text
Android activo en segundo plano
   ↓
Evento recibido (notificación WhatsApp/SMS o llamada entrante)
   ↓
Motor Local (LocalRiskEngine)
   ├── 1. ¿Está en lista de confianza del usuario?  → Sí: permitir (no molestar)
   ├── 2. ¿Coincide en base Room local (offline)?   → Sí: riesgo ALTO
   └── 3. Análisis heurístico de texto              → urgencia + dinero + código
   ↓
¿Hay señales importantes?
   ├── No  → No molestar al usuario
   └── Sí  → Alerta simple con las 3 preguntas clave
```

---

## Cómo Abrir en Android Studio

### Prerrequisitos
- **Android Studio Hedgehog** (2023.1.1) o superior
- **JDK 17** (incluido en Android Studio)
- **Android SDK 34** (API Level 34)

### Pasos
1. Abrir Android Studio
2. **File → Open** y seleccionar la carpeta `/android`
3. Crear `android/local.properties` copiando `local.properties.example` y apuntando al SDK:
   ```
   sdk.dir=/Users/TU_USUARIO/Library/Android/sdk
   ```
4. Esperar que Gradle sincronice las dependencias
5. Crear un AVD (emulador) con **API 31+** desde AVD Manager
6. Presionar **▶ Run** para instalar en el emulador

### Demo Automatizada en el Emulador (`test_emulator.sh`)

Para probar el flujo completo en el emulador sin necesidad de interacción manual, ejecutá desde la terminal:

```bash
# 1. Configurar permisos iniciales del sistema (roles, notificaciones, accesibilidad)
./test_emulator.sh setup

# 2. Comandos individuales de prueba
./test_emulator.sh call "+5493704048860"      # Simular llamada sospechosa
./test_emulator.sh missed "+5491140028899"    # Simular llamada perdida
./test_emulator.sh sms "+5493517894561" "..." # Simular SMS con phishing
./test_emulator.sh notif                      # Simular notificación de WhatsApp
./test_emulator.sh url "http://anses-beneficios-gob-ar.site" # Intercepción en Chrome
./test_emulator.sh sync                       # Forzar sincronización con el backend
./test_emulator.sh logs                       # Monitoreo de logs en tiempo real

# 3. Demo Completa Guiada para el Jurado
./test_emulator.sh demo
```

---

## Funcionalidades Implementadas (Fase 1 y 2 de AGENTS.md §35)

| Funcionalidad | Estado |
|---|---|
| Base de datos local Room (offline) | ✅ Implementada |
| Motor de riesgo heurístico local | ✅ Implementada |
| Evaluación de números telefónicos | ✅ Implementada |
| Evaluación de dominios y URLs | ✅ Implementada |
| Lista de confianza del usuario | ✅ Implementada |
| NotificationListenerService (WhatsApp/SMS) | ✅ Implementada |
| CallScreeningService (llamadas) | ✅ Implementada |
| Alertas preventivas con 3 preguntas | ✅ Implementada |
| Sincronización incremental WorkManager | ✅ Implementada |
| Pantalla principal accesible | ✅ Implementada |
| Tests unitarios del motor (JVM) | ✅ Implementados |

---

## Privacidad y Seguridad (AGENTS.md §23 y §24)

- ❌ No se accede al chat completo de WhatsApp
- ❌ No se almacenan conversaciones ni historial de mensajes
- ❌ No se leen bases de datos privadas de otras apps
- ❌ No se envían datos personales al servidor
- ✅ Análisis 100% local con heurísticas en el dispositivo
- ✅ Funciona sin Internet (base Room + reglas)
- ✅ El usuario puede revertir cualquier decisión (lista de confianza reversible)
