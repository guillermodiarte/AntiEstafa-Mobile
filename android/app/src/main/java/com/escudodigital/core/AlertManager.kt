package com.escudodigital.core

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.escudodigital.R
import com.escudodigital.ui.ThreatInterceptActivity

/**
 * Gestiona la emisión de alertas preventivas al usuario.
 * Sección 6 de AGENTS.md: Flujo principal de alerta simple.
 * Sección 25 de AGENTS.md: Niveles de riesgo y qué mostrar.
 *
 * Emite una notificación de alta prioridad y ejecuta una ventana modal (ThreatInterceptActivity)
 * que se muestra sobre cualquier aplicación con acciones contextuales de protección.
 */
object AlertManager {

    private const val TAG = "AlertManager"
    private const val CHANNEL_ID = "escudo_digital_alerts"
    private const val NOTIFICATION_ID_BASE = 1000

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.channel_scam_alerts_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.channel_scam_alerts_desc)
                enableLights(true)
                enableVibration(true)
                setBypassDnd(true)
            }
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Emite una notificación de alerta preventiva y abre la ventana modal de intercepción.
     * Muestra las opciones contextuales para cortar llamada, eliminar mensaje o salir de la URL hacia google.com.
     */
    fun sendAlert(
        context: Context,
        result: RiskResult,
        notificationId: Int = NOTIFICATION_ID_BASE,
        threatType: String? = null
    ) {
        // No enviar alerta si el riesgo es bajo o la fuente es la lista de confianza
        if (!result.isMediumOrHigh) return

        val resolvedType = threatType ?: resolveThreatType(result)

        val title = when (result.level) {
            RiskLevel.HIGH -> "🚨 ALERTA: Amenaza detectada"
            RiskLevel.MEDIUM -> "⚠️ Advertencia de seguridad"
            else -> return
        }

        val signalsFormatted = result.signals.joinToString("\n• ", "• ")
        val adviceText = result.advice ?: "Tené precaución. No compartas claves ni realices transferencias."

        // Intent para abrir la ventana modal interactiva
        val modalIntent = Intent(context, ThreatInterceptActivity::class.java).apply {
            putExtra(ThreatInterceptActivity.EXTRA_THREAT_TYPE, resolvedType)
            putExtra(ThreatInterceptActivity.EXTRA_RISK_LEVEL, result.level.name)
            putExtra(ThreatInterceptActivity.EXTRA_DETECTED_VALUE, result.detectedValue)
            putExtra(ThreatInterceptActivity.EXTRA_CATEGORY, result.category ?: "Amenaza detectada")
            putExtra(ThreatInterceptActivity.EXTRA_SIGNALS, signalsFormatted)
            putExtra(ThreatInterceptActivity.EXTRA_ADVICE, adviceText)
            putExtra(ThreatInterceptActivity.EXTRA_ORIGINAL_URL, result.detectedValue)
            putExtra(ThreatInterceptActivity.EXTRA_NOTIFICATION_ID, notificationId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            modalIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            notificationId + 20000,
            modalIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val summaryText = result.signals.firstOrNull() ?: "Tocá para revisar la amenaza y tomar una acción segura."

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle(title)
            .setContentText(summaryText)
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("$summaryText\nRecomendación: $adviceText")
                .setSummaryText("Escudo Digital"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notificationId, notification)

        // Lanzar inmediatamente la ventana modal sobre la pantalla actual
        try {
            context.startActivity(modalIntent)
            Log.d(TAG, "Ventana modal ThreatInterceptActivity desplegada con éxito")
        } catch (e: Exception) {
            Log.w(TAG, "No se pudo iniciar ThreatInterceptActivity directamente: ${e.message}")
        }
    }

    private fun resolveThreatType(result: RiskResult): String {
        val detected = result.detectedValue.lowercase()
        val cat = result.category?.lowercase() ?: ""
        val signals = result.signals.joinToString(" ").lowercase()

        return when {
            cat.contains("llamada") || signals.contains("llamada") -> ThreatInterceptActivity.TYPE_CALL
            detected.startsWith("http://") || detected.startsWith("https://") ||
            cat.contains("web") || cat.contains("phishing") || signals.contains("dominio") -> ThreatInterceptActivity.TYPE_URL
            else -> ThreatInterceptActivity.TYPE_SMS
        }
    }
}
