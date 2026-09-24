package com.escudodigital.core

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.escudodigital.R
import com.escudodigital.ui.AlertDetailActivity

/**
 * Gestiona la emisión de alertas preventivas al usuario.
 * Sección 6 de AGENTS.md: Flujo principal de alerta simple.
 * Sección 25 de AGENTS.md: Niveles de riesgo y qué mostrar.
 *
 * Las alertas solo aparecen cuando hay señales importantes (no se molesta innecesariamente).
 */
object AlertManager {

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
            }
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Emite una notificación de alerta preventiva al usuario.
     * Al tocarla, abre AlertDetailActivity con las 3 preguntas clave (AGENTS.md §25).
     */
    fun sendAlert(context: Context, result: RiskResult, notificationId: Int = NOTIFICATION_ID_BASE) {
        // No enviar alerta si el riesgo es bajo o la fuente es la lista de confianza
        if (!result.isMediumOrHigh) return

        val (title, emoji) = when (result.level) {
            RiskLevel.HIGH -> Pair("⚠️ Señal de alerta", R.string.alert_danger_title)
            RiskLevel.MEDIUM -> Pair("⚠️ Mensaje sospechoso", R.string.alert_warning_title)
            else -> return
        }

        val detailIntent = Intent(context, AlertDetailActivity::class.java).apply {
            putExtra(AlertDetailActivity.EXTRA_RISK_LEVEL, result.level.name)
            putExtra(AlertDetailActivity.EXTRA_DETECTED_VALUE, result.detectedValue)
            putExtra(AlertDetailActivity.EXTRA_CATEGORY, result.category ?: "Sin categoría")
            putExtra(AlertDetailActivity.EXTRA_SIGNALS, result.signals.joinToString("\n• ", "• "))
            putExtra(AlertDetailActivity.EXTRA_ADVICE, result.advice ?: "Consultá con un familiar de confianza.")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            detailIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val summaryText = result.signals.firstOrNull() ?: "Revisá el detalle."

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle(title)
            .setContentText(summaryText)
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText(summaryText)
                .setSummaryText("Tocá para ver qué hacer"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(notificationId, notification)
    }
}
