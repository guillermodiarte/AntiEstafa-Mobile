#!/usr/bin/env bash
# =============================================================================
# ESCUDO DIGITAL — Script de pruebas en emulador Android (ADB)
# Usar desde la Mac con el emulador Pixel 6 corriendo en Android Studio
# =============================================================================

# Agregar ADB al PATH (Android Studio SDK)
export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"

ADB="adb"
EMULATOR_SERIAL="emulator-5554"  # Cambiar si el emulador usa otro puerto

# Verificar que el emulador esté conectado
check_emulator() {
    if ! $ADB -s $EMULATOR_SERIAL get-state &>/dev/null; then
        echo "❌ Emulador no encontrado en $EMULATOR_SERIAL"
        echo "   Dispositivos disponibles:"
        $ADB devices
        exit 1
    fi
    echo "✅ Emulador conectado: $EMULATOR_SERIAL"
}

# ─────────────────────────────────────────────────────────────────────────────
# 0. SETUP INICIAL: conceder permisos críticos via ADB (sin rebuild)
#    Ejecutar UNA VEZ después de instalar la app
# ─────────────────────────────────────────────────────────────────────────────
setup_permissions() {
    echo ""
    echo "🔐 Concediendo permisos críticos a Escudo Digital..."
    
    # POST_NOTIFICATIONS: necesario para mostrar alertas en Android 13+
    $ADB -s $EMULATOR_SERIAL shell pm grant com.escudodigital android.permission.POST_NOTIFICATIONS
    echo "   ✅ POST_NOTIFICATIONS concedido"
    
    # CALL_SCREENING: necesario para interceptar llamadas
    $ADB -s $EMULATOR_SERIAL shell cmd role add-role-holder android.app.role.CALL_SCREENING com.escudodigital
    echo "   ✅ Rol CALL_SCREENING asignado"

    # SYSTEM_ALERT_WINDOW: para desplegar ventana modal sobre otras apps
    $ADB -s $EMULATOR_SERIAL shell appops set com.escudodigital SYSTEM_ALERT_WINDOW allow
    echo "   ✅ Ventana flotante (SYSTEM_ALERT_WINDOW) permitida"

    # ANSWER_PHONE_CALLS: para colgar llamadas sospechosas desde el modal
    $ADB -s $EMULATOR_SERIAL shell pm grant com.escudodigital android.permission.ANSWER_PHONE_CALLS 2>/dev/null || true
    echo "   ✅ Permiso de gestión de llamadas concedido"

    # SMS: permisos para leer y borrar SMS fraudulentos
    $ADB -s $EMULATOR_SERIAL shell pm grant com.escudodigital android.permission.READ_SMS 2>/dev/null || true
    $ADB -s $EMULATOR_SERIAL shell pm grant com.escudodigital android.permission.RECEIVE_SMS 2>/dev/null || true
    $ADB -s $EMULATOR_SERIAL shell appops set com.escudodigital WRITE_SMS allow
    echo "   ✅ Permisos de lectura y gestión de SMS concedidos"

    # ACCESSIBILITY: activa el servicio de protección de navegación web en navegadores (Chrome, etc.)
    $ADB -s $EMULATOR_SERIAL shell settings put secure enabled_accessibility_services com.escudodigital/com.escudodigital.services.ScamBrowserProtectionService
    $ADB -s $EMULATOR_SERIAL shell settings put secure accessibility_enabled 1
    echo "   ✅ Servicio de Accesibilidad (Protección Web en tiempo real) activado"
    
    echo ""
    echo "=== Verificación ==="
    $ADB -s $EMULATOR_SERIAL shell dumpsys package com.escudodigital | grep "POST_NOTIFICATIONS.*granted"
    $ADB -s $EMULATOR_SERIAL shell cmd role get-role-holders android.app.role.CALL_SCREENING
    $ADB -s $EMULATOR_SERIAL shell settings get secure enabled_accessibility_services
    echo ""
    echo "   Listo. Ahora las alertas, el modal y la protección web funcionarán."
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. SIMULAR SMS SOSPECHOSO
# ─────────────────────────────────────────────────────────────────────────────
send_sms() {
    local NUMBER="${1:-+5491138901234}"
    local TEXT="${2:-Estimado cliente: su cuenta fue bloqueada. Ingrese urgente a http://banco-seguro-arg.site para validar sus datos o perderá acceso.}"
    echo ""
    echo "📱 Enviando SMS desde $NUMBER..."
    {
        echo "auth $(cat ~/.emulator_console_auth_token 2>/dev/null || echo '')"
        echo "sms send $NUMBER $TEXT"
        echo "exit"
    } | nc -w 3 localhost 5554
    echo "   SMS enviado. Verificá las notificaciones en el emulador."
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. SIMULAR LLAMADA ENTRANTE
# ─────────────────────────────────────────────────────────────────────────────
simulate_call() {
    local NUMBER="${1:-+5493704048860}"
    echo ""
    echo "📞 Simulando llamada entrante desde $NUMBER..."
    {
        echo "auth $(cat ~/.emulator_console_auth_token 2>/dev/null || echo '')"
        echo "gsm call $NUMBER"
        sleep 30
        echo "gsm cancel $NUMBER"
        echo "exit"
    } | nc -w 25 localhost 5554
    echo "   Llamada simulada desde número sospechoso: $NUMBER"
    echo "   Este número está en la base de Escudo Digital (Suplantación Bancaria)"
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. SIMULAR LLAMADA PERDIDA
# ─────────────────────────────────────────────────────────────────────────────
simulate_missed_call() {
    local NUMBER="${1:-+5491140028899}"
    echo ""
    echo "📞 Simulando llamada perdida desde $NUMBER (ANSES falso)..."
    {
        echo "auth $(cat ~/.emulator_console_auth_token 2>/dev/null || echo '')"
        echo "gsm call $NUMBER"
        sleep 2
        echo "gsm cancel $NUMBER"
        echo "exit"
    } | nc -w 8 localhost 5554
    echo "   Llamada perdida registrada."
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. ABRIR URL SOSPECHOSA EN EL EMULADOR (Chrome)
# ─────────────────────────────────────────────────────────────────────────────
open_scam_url() {
    local URL="${1:-http://infobae.com}"
    echo ""
    echo "🌐 Abriendo URL sospechosa en Google Chrome: $URL"
    $ADB -s $EMULATOR_SERIAL shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -d "$URL"
    echo "   Chrome navegando a $URL."
    echo "   ScamBrowserProtectionService leerá la URL en la barra de direcciones y desplegará el modal interactivo."
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. ENVIAR NOTIFICACIÓN DE WHATSAPP FALSA (sin WhatsApp instalado)
# ─────────────────────────────────────────────────────────────────────────────
send_test_notification() {
    echo ""
    echo "🔔 Enviando notificación de WhatsApp simulada..."
    $ADB -s $EMULATOR_SERIAL shell cmd notification post \
        -S bigtext \
        --title "+5491138901234" \
        --content "Hola mamá, tuve un accidente. Transferime 80000 pesos urgente a este nuevo número. No le digas a nadie." \
        --group "com.whatsapp" \
        com.whatsapp 99
    echo "   Notificación enviada. El ScamNotificationListener debería procesarla."
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. FORZAR SINCRONIZACIÓN INMEDIATA DE LA BASE LOCAL
# ─────────────────────────────────────────────────────────────────────────────
force_sync() {
    echo ""
    echo "🔄 Forzando sincronización de la base local..."
    $ADB -s $EMULATOR_SERIAL shell am broadcast \
        -a androidx.work.impl.background.systemalarm.RescheduleReceiver \
        com.escudodigital
    echo "   WorkManager notificado. Verificá Logcat para 'SyncWorker'."
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. VER LOGS EN TIEMPO REAL
# ─────────────────────────────────────────────────────────────────────────────
watch_logs() {
    echo ""
    echo "📋 Mostrando logs de Escudo Digital en tiempo real..."
    echo "   (Ctrl+C para salir)"
    $ADB -s $EMULATOR_SERIAL logcat -s "SyncWorker:D" "ScamNotificationListener:D" "AlertManager:D" "ScamCallScreening:D" "BrowserProtection:D" "ThreatIntercept:D"
}

# ─────────────────────────────────────────────────────────────────────────────
# 8. DEMO COMPLETA DEL HACKATHON
# ─────────────────────────────────────────────────────────────────────────────
full_demo() {
    echo "======================================================"
    echo "  ESCUDO DIGITAL — Demo Hackathon (secuencia completa)"
    echo "======================================================"
    check_emulator

    echo ""
    echo "Paso 1/4: SMS sospechoso (phishing bancario)"
    send_sms "+5493517894561" "ALERTA: Detectamos actividad inusual en su cuenta bancaria. Acceda a http://banco-seguro-arg.site para verificar su identidad."
    sleep 3

    echo ""
    echo "Paso 2/4: Llamada desde número reportado (ANSES falso)"
    simulate_call "+5491140028899"
    sleep 3

    echo ""
    echo "Paso 3/4: SMS de 'familiar' pidiendo dinero urgente"
    send_sms "+5491138901234" "Hola mamá es yo con el nuevo número. Tuve un accidente con el auto. Necesito que me transfieras 80000 pesos urgente por favor no le cuentes a papá."
    sleep 3

    echo ""
    echo "Paso 4/4: URL de phishing"
    open_scam_url "http://anses-beneficios-gob-ar.site"

    echo ""
    echo "======================================================"
    echo "  Demo completada."
    echo "  Verificá las alertas preventivas en el emulador."
    echo "======================================================"
}

# ─────────────────────────────────────────────────────────────────────────────
# MENÚ PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────
echo "======================================================"
echo "  ESCUDO DIGITAL — Herramienta de pruebas ADB"
echo "======================================================"
echo ""
echo "Uso: $0 [comando] [argumentos opcionales]"
echo ""
echo "Comandos:"
echo "  setup                   — ⚠️ EJECUTAR PRIMERO: concede permisos críticos"
echo "  sms [numero] [texto]    — Enviar SMS sospechoso al emulador"
echo "  call [numero]           — Simular llamada entrante sospechosa"
echo "  missed [numero]         — Simular llamada perdida"
echo "  url [url]               — Abrir URL de phishing en Chrome"
echo "  notif                   — Enviar notificación de WhatsApp falsa"
echo "  sync                    — Forzar sincronización de base local"
echo "  logs                    — Ver logs en tiempo real"
echo "  demo                    — Demo completa del Hackathon"
echo ""
echo "Números de prueba en la base de datos:"
echo "  +5491138901234  → Alto riesgo: Falso Familiar / Urgencia"
echo "  +5493517894561  → Alto riesgo: Suplantación Bancaria"
echo "  +5491140028899  → Alto riesgo: Falso Organismo Público (ANSES)"
echo "  +5492615551234  → Riesgo medio: Tienda Online / Préstamo Falso"
echo ""
echo "Dominios de prueba:"
echo "  anses-beneficios-gob-ar.site  → Alto riesgo"
echo "  bcra-validacion-cuenta.com    → Alto riesgo"
echo "  mercadopago-bonificacion.net  → Alto riesgo"

case "${1:-}" in
    setup)  check_emulator; setup_permissions ;;
    sms)    check_emulator; send_sms "$2" "$3" ;;
    call)   check_emulator; simulate_call "$2" ;;
    missed) check_emulator; simulate_missed_call "$2" ;;
    url)    check_emulator; open_scam_url "$2" ;;
    notif)  check_emulator; send_test_notification ;;
    sync)   check_emulator; force_sync ;;
    logs)   check_emulator; watch_logs ;;
    demo)   full_demo ;;
    *)      echo ""; echo "Ejecutá '$0 setup' primero, luego '$0 demo' para la demo completa." ;;
esac
