package com.escudodigital.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
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
 * Al detectar una amenaza:
 * 1. Cancela y remueve inmediatamente la notificación fraudulenta de la barra de estado
 *    para no molestar al usuario con alertas acumuladas.
 * 2. Lanza de forma directa la ventana modal ThreatInterceptActivity.
 */
class ScamNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var riskEngine: LocalRiskEngine
    private var notificationCounter = 2000

    companion object {
        private const val TAG = "ScamNotifListener"
        var instance: ScamNotificationListener? = null
    }

    // Paquetes monitoreados. Solo los necesarios (Sección 9 de AGENTS.md).
    private val MONITORED_PACKAGES = setOf(
        "com.whatsapp",
        "com.whatsapp.w4b",
        "com.android.mms",
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging"
    )

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.d(TAG, "ScamNotificationListener iniciado")
        val db = EscudoDatabase.getInstance(applicationContext)
        riskEngine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())
        AlertManager.createNotificationChannel(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        Log.d(TAG, "Notificación recibida de: ${sbn.packageName}")

        // Filtrar solo las apps que nos interesan
        if (sbn.packageName !in MONITORED_PACKAGES) {
            return
        }

        val extras = sbn.notification?.extras ?: return
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""

        val contentToAnalyze = bigText.ifBlank { text }

        Log.d(TAG, "Analizando — título: '$title' texto: '${contentToAnalyze.take(80)}'")

        // Si no hay texto visible, no tenemos información para analizar
        if (contentToAnalyze.isBlank()) {
            Log.d(TAG, "Sin texto para analizar")
            return
        }

        val isWhatsApp = sbn.packageName.startsWith("com.whatsapp")
        val notifId = notificationCounter++
        val sbnKey = sbn.key

        scope.launch {
            analyzeAndAlert(
                rawText = contentToAnalyze,
                senderHint = title,
                isWhatsApp = isWhatsApp,
                notifId = notifId,
                sbnKey = sbnKey
            )
        }
    }

    private suspend fun analyzeAndAlert(
        rawText: String,
        senderHint: String,
        isWhatsApp: Boolean,
        notifId: Int,
        sbnKey: String
    ) {
        // Detectar si el título contiene un número de teléfono
        val phoneRegex = Regex("""[\+]?[\d\s\-(). ]{7,20}""")
        val phoneMatch = phoneRegex.find(senderHint)

        if (phoneMatch != null) {
            Log.d(TAG, "Número detectado en título: '${phoneMatch.value}'")
            val phoneResult = riskEngine.evaluatePhone(phoneMatch.value)
            Log.d(TAG, "Resultado teléfono: ${phoneResult.level} — ${phoneResult.signals}")
            if (phoneResult.isMediumOrHigh) {
                Log.d(TAG, "🚨 ALERTA por número reportado: ${phoneResult.level}")
                // Cancelar inmediatamente la notificación sospechosa para que no quede en la barra
                cancelScamNotification(sbnKey)
                val threatType = if (isWhatsApp) com.escudodigital.ui.ThreatInterceptActivity.TYPE_WHATSAPP else com.escudodigital.ui.ThreatInterceptActivity.TYPE_SMS
                AlertManager.sendAlert(applicationContext, phoneResult, notifId, threatType = threatType)
                return
            }
        }

        // Analizar el contenido (incluyendo URLs sospechosas y heurísticas de texto)
        val contentResult = riskEngine.evaluateNotificationContent(rawText)
        Log.d(TAG, "Resultado contenido: ${contentResult.level} — ${contentResult.signals}")

        if (contentResult.isMediumOrHigh) {
            Log.d(TAG, "🚨 ALERTA por contenido sospechoso o URL peligrosa: ${contentResult.level}")
            // Cancelar inmediatamente la notificación sospechosa de la barra
            cancelScamNotification(sbnKey)
            val threatType = when {
                contentResult.signals.any { it.contains("Dominio", ignoreCase = true) } ||
                contentResult.detectedValue.startsWith("http://") ||
                contentResult.detectedValue.startsWith("https://") -> com.escudodigital.ui.ThreatInterceptActivity.TYPE_URL

                isWhatsApp -> com.escudodigital.ui.ThreatInterceptActivity.TYPE_WHATSAPP
                else -> com.escudodigital.ui.ThreatInterceptActivity.TYPE_SMS
            }
            AlertManager.sendAlert(applicationContext, contentResult, notifId, threatType = threatType)
            return
        }

        // Detectar llamada de WhatsApp (Sección 13 de AGENTS.md)
        if (isWhatsApp && rawText.contains("llamada", ignoreCase = true) && phoneMatch == null) {
            val callResult = contentResult.copy(
                level = RiskLevel.MEDIUM,
                signals = listOf("Llamada entrante de WhatsApp de contacto no identificado"),
                advice = "Tené cuidado si solicita dinero, códigos o información personal."
            )
            cancelScamNotification(sbnKey)
            AlertManager.sendAlert(applicationContext, callResult, notifId + 1, threatType = com.escudodigital.ui.ThreatInterceptActivity.TYPE_CALL)
        }
    }

    fun cancelScamNotification(key: String) {
        try {
            cancelNotification(key)
            Log.d(TAG, "Notificación fraudulenta cancelada y retirada de la barra: $key")
        } catch (e: Exception) {
            Log.w(TAG, "No se pudo cancelar notificación por clave: ${e.message}")
        }
    }

    override fun onListenerConnected() {
        Log.d(TAG, "NotificationListenerService conectado al sistema")
    }

    override fun onListenerDisconnected() {
        Log.w(TAG, "NotificationListenerService desconectado — aguardando reconexión del sistema")
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) instance = null
        Log.d(TAG, "ScamNotificationListener destruido")
        scope.cancel()
    }
}
