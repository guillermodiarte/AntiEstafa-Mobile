package com.escudodigital.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.escudodigital.core.AlertManager
import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.core.RiskLevel
import com.escudodigital.data.local.EscudoDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Escucha notificaciones de WhatsApp y SMS de forma no invasiva.
 * Secciones 7, 8 y 9 de AGENTS.md: límites, reglas y prioridades.
 *
 * Solo procesa:
 * - WhatsApp (com.whatsapp)
 * - SMS por defecto del dispositivo
 *
 * NO accede al chat completo. Solo analiza el snippet visible en la notificación.
 * El contenido temporal es descartado inmediatamente tras el análisis.
 */
class ScamNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var riskEngine: LocalRiskEngine
    private var notificationCounter = 2000

    // Paquetes de apps analizadas. Solo los necesarios (Sección 9 de AGENTS.md).
    private val MONITORED_PACKAGES = setOf(
        "com.whatsapp",           // WhatsApp
        "com.whatsapp.w4b",       // WhatsApp Business
        "com.android.mms",        // Mensajes Android stock
        "com.google.android.apps.messaging", // Google Messages
        "com.samsung.android.messaging"      // Samsung Messages
    )

    override fun onCreate() {
        super.onCreate()
        val db = EscudoDatabase.getInstance(applicationContext)
        riskEngine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())
        AlertManager.createNotificationChannel(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        // Filtrar solo las apps que nos interesan
        if (sbn.packageName !in MONITORED_PACKAGES) return

        val extras = sbn.notification?.extras ?: return
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""

        // Si no hay texto visible, no tenemos información para analizar (Sección 7 de AGENTS.md)
        val contentToAnalyze = bigText.ifBlank { text }
        if (contentToAnalyze.isBlank()) return

        val isWhatsApp = sbn.packageName.startsWith("com.whatsapp")
        val notifId = notificationCounter++

        scope.launch {
            analyzeAndAlert(
                rawText = contentToAnalyze,
                senderHint = title,
                isWhatsApp = isWhatsApp,
                notifId = notifId
            )
        }
    }

    private suspend fun analyzeAndAlert(
        rawText: String,
        senderHint: String,
        isWhatsApp: Boolean,
        notifId: Int
    ) {
        // Detectar si el título contiene un número de teléfono (llamada de WA o remitente)
        val phoneRegex = Regex("""[\+]?[\d\s\-().]{7,20}""")
        val phoneMatch = phoneRegex.find(senderHint)

        if (phoneMatch != null) {
            val phoneResult = riskEngine.evaluatePhone(phoneMatch.value)
            if (phoneResult.isMediumOrHigh) {
                AlertManager.sendAlert(applicationContext, phoneResult, notifId)
                return // Prioridad: resultado de base > heurístico
            }
        }

        // Analizar el contenido textual de la notificación con heurísticas
        val textResult = riskEngine.evaluateNotificationText(rawText)
        if (textResult.isMediumOrHigh) {
            AlertManager.sendAlert(applicationContext, textResult, notifId)
        }

        // Detectar llamada de WhatsApp (Sección 13 de AGENTS.md)
        if (isWhatsApp && rawText.contains("llamada", ignoreCase = true) && phoneMatch == null) {
            val callResult = textResult.copy(
                level = RiskLevel.MEDIUM,
                signals = listOf("Llamada entrante de WhatsApp de contacto no identificado"),
                advice = "Tené cuidado si solicita dinero, códigos o información personal."
            )
            AlertManager.sendAlert(applicationContext, callResult, notifId + 1)
        }
    }

    override fun onListenerDisconnected() {
        // El sistema Android desconectó el listener - no alarmar al usuario
        // La protección continuará cuando vuelva a conectarse
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
