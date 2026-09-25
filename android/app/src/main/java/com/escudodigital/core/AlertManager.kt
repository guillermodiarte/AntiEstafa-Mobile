package com.escudodigital.core

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.escudodigital.R
import com.escudodigital.ui.ThreatInterceptActivity

/**
 * Gestiona la emisión de alertas preventivas al usuario.
 *
 * Modo sin notificaciones molestas:
 * No deja notificaciones persistentes en la barra de estado.
 * Despliega inmediatamente la ventana modal ThreatInterceptActivity sobre la pantalla
 * con opciones contextuales claras para protegerse (cortar llamada, eliminar mensaje, salir de la URL).
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
     * Lanza la ventana modal de intercepción directamente sobre la pantalla actual.
     * Cancela cualquier notificación residual para no saturar la bandeja del usuario.
     */
    fun sendAlert(
        context: Context,
        result: RiskResult,
        notificationId: Int = NOTIFICATION_ID_BASE,
        threatType: String? = null
    ) {
        if (!result.isMediumOrHigh) return

        val resolvedType = threatType ?: resolveThreatType(result)
        val signalsFormatted = result.signals.joinToString("\n• ", "• ")
        val adviceText = result.advice ?: "Tené precaución. No compartas claves ni realices transferencias."

        // Limpiar cualquier notificación activa previa para no dejar basura en la barra de estado
        try {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(notificationId)
            notificationManager.cancelAll()
        } catch (e: Exception) {
            Log.e(TAG, "Error limpiando notificaciones previas: ${e.message}")
        }

        // Intent para abrir inmediatamente la ventana modal interactiva
        val modalIntent = Intent(context, ThreatInterceptActivity::class.java).apply {
            putExtra(ThreatInterceptActivity.EXTRA_THREAT_TYPE, resolvedType)
            putExtra(ThreatInterceptActivity.EXTRA_RISK_LEVEL, result.level.name)
            putExtra(ThreatInterceptActivity.EXTRA_DETECTED_VALUE, result.detectedValue)
            putExtra(ThreatInterceptActivity.EXTRA_CATEGORY, result.category ?: "Amenaza detectada")
            putExtra(ThreatInterceptActivity.EXTRA_SIGNALS, signalsFormatted)
            putExtra(ThreatInterceptActivity.EXTRA_ADVICE, adviceText)
            putExtra(ThreatInterceptActivity.EXTRA_ORIGINAL_URL, result.detectedValue)
            putExtra(ThreatInterceptActivity.EXTRA_NOTIFICATION_ID, notificationId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        }

        try {
            context.startActivity(modalIntent)
            Log.d(TAG, "Modal interactivo desplegado con éxito (sin notificación en bandeja)")
        } catch (e: Exception) {
            Log.e(TAG, "No se pudo iniciar ThreatInterceptActivity: ${e.message}")
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
