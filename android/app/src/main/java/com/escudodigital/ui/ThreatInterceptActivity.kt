package com.escudodigital.ui

import android.Manifest
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.escudodigital.R
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.notifications.ScamNotificationListener
import kotlinx.coroutines.launch

/**
 * Ventana modal / pantalla de intercepción de amenaza en tiempo real.
 * Aparece inmediatamente cuando Escudo Digital detecta una amenaza
 * (llamada entrante sospechosa, SMS/WhatsApp fraudulento o URL peligrosa).
 *
 * Muestra el tipo de alerta, señales encontradas y dos opciones claras:
 * - Acción segura y recomendada (cortar llamada, eliminar mensaje, salir a google.com).
 * - Continuar bajo su propio riesgo (siempre desaconsejado, redirigiendo a la app correspondiente).
 *
 * Muestra el contenido del mensaje recibido y adapta las recomendaciones según el canal.
 */
class ThreatInterceptActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "ThreatIntercept"

        const val EXTRA_THREAT_TYPE = "extra_threat_type" // CALL, SMS, WHATSAPP, URL
        const val EXTRA_RISK_LEVEL = "extra_risk_level"
        const val EXTRA_DETECTED_VALUE = "extra_detected_value"
        const val EXTRA_CATEGORY = "extra_category"
        const val EXTRA_SIGNALS = "extra_signals"
        const val EXTRA_ADVICE = "extra_advice"
        const val EXTRA_ORIGINAL_URL = "extra_original_url"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
        const val EXTRA_MESSAGE_TEXT = "extra_message_text"

        const val TYPE_CALL = "CALL"
        const val TYPE_SMS = "SMS"
        const val TYPE_WHATSAPP = "WHATSAPP"
        const val TYPE_URL = "URL"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configuración para mostrar la ventana sobre la pantalla de bloqueo y encender pantalla
        setupWindowFlags()

        // Limpiar cualquier notificación activa para no molestar al usuario
        clearAllNotifications()

        setContentView(R.layout.activity_threat_intercept)

        // Caso 1: Se abrió un enlace web directamente con Escudo Digital (ACTION_VIEW)
        if (intent.action == Intent.ACTION_VIEW && intent.data != null && !intent.hasExtra(EXTRA_THREAT_TYPE)) {
            val rawUrl = intent.data.toString()
            val host = intent.data?.host?.removePrefix("www.")?.lowercase() ?: ""

            lifecycleScope.launch {
                val db = EscudoDatabase.getInstance(applicationContext)
                val threat = db.threatDao().findDomainThreat(host)
                if (threat != null && !threat.isDeleted) {
                    setupUI(
                        threatType = TYPE_URL,
                        riskLevel = threat.riskLevel,
                        detectedValue = rawUrl,
                        category = threat.category ?: "Sitio Web Peligroso / Phishing",
                        signals = "• Dominio registrado en la base de amenazas de seguridad\n• Riesgo de robo de credenciales o estafa",
                        advice = "No ingreses tus datos personales ni claves en este sitio. Te recomendamos salir inmediatamente.",
                        originalUrl = rawUrl,
                        notificationId = -1,
                        messageText = ""
                    )
                } else {
                    // Si no es amenaza conocida, abrir con Chrome u otro navegador
                    try {
                        val browserIntent = Intent(Intent.ACTION_VIEW, intent.data).apply {
                            setPackage("com.android.chrome")
                        }
                        startActivity(browserIntent)
                    } catch (e: Exception) {
                        // ignore
                    }
                    finish()
                }
            }
            return
        }

        // Caso 2: Se abrió desde AlertManager o intento con extras
        val threatType = determineThreatType()
        val riskLevel = intent.getStringExtra(EXTRA_RISK_LEVEL) ?: "HIGH"
        val detectedValue = intent.getStringExtra(EXTRA_DETECTED_VALUE) ?: ""
        val category = intent.getStringExtra(EXTRA_CATEGORY) ?: "Amenaza detectada"
        val signals = intent.getStringExtra(EXTRA_SIGNALS) ?: "• Señal de riesgo detectada por el motor de seguridad"
        val rawAdvice = intent.getStringExtra(EXTRA_ADVICE) ?: "No brindes datos personales ni claves bancarias."
        val originalUrl = intent.getStringExtra(EXTRA_ORIGINAL_URL) ?: detectedValue
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)
        val messageText = intent.getStringExtra(EXTRA_MESSAGE_TEXT) ?: ""

        setupUI(threatType, riskLevel, detectedValue, category, signals, rawAdvice, originalUrl, notificationId, messageText)
    }

    private fun setupUI(
        threatType: String,
        riskLevel: String,
        detectedValue: String,
        category: String,
        signals: String,
        rawAdvice: String,
        originalUrl: String,
        notificationId: Int,
        messageText: String
    ) {
        val tvRiskBadge = findViewById<TextView>(R.id.tvRiskBadge)
        val tvThreatTypeEmoji = findViewById<TextView>(R.id.tvThreatTypeEmoji)
        val tvThreatTitle = findViewById<TextView>(R.id.tvThreatTitle)
        val tvThreatValue = findViewById<TextView>(R.id.tvThreatValue)
        val cardMessageContent = findViewById<View>(R.id.cardMessageContent)
        val tvMessageContent = findViewById<TextView>(R.id.tvMessageContent)
        val tvCategory = findViewById<TextView>(R.id.tvCategory)
        val tvSignals = findViewById<TextView>(R.id.tvSignals)
        val tvAdvice = findViewById<TextView>(R.id.tvAdvice)
        val btnSafeAction = findViewById<Button>(R.id.btnSafeAction)
        val btnRiskyAction = findViewById<Button>(R.id.btnRiskyAction)

        // Configuración visual según nivel de riesgo
        if (riskLevel.equals("MEDIUM", ignoreCase = true)) {
            tvRiskBadge.text = "⚠️ RIESGO MEDIO DETECTADO"
            tvRiskBadge.setBackgroundResource(R.drawable.card_warning)
        } else {
            tvRiskBadge.text = "🔴 RIESGO ALTO DETECTADO"
            tvRiskBadge.setBackgroundResource(R.drawable.badge_background)
        }

        tvThreatValue.text = detectedValue
        tvCategory.text = category
        tvSignals.text = signals

        // Mostrar el contenido del mensaje recibido si aplica
        if ((threatType == TYPE_SMS || threatType == TYPE_WHATSAPP) && messageText.isNotBlank()) {
            cardMessageContent.visibility = View.VISIBLE
            tvMessageContent.text = "\"$messageText\""
        } else {
            cardMessageContent.visibility = View.GONE
        }

        // Adaptar la recomendación según sea mensaje vs llamada
        val resolvedAdvice = when {
            (threatType == TYPE_SMS || threatType == TYPE_WHATSAPP) &&
            (category.contains("Familiar", ignoreCase = true) || rawAdvice.contains("llamada", ignoreCase = true)) -> {
                "Eliminá el mensaje y no envíes dinero ni respondas. Comunicate con tu familiar llamándolo directamente al número habitual que tengas agendado en tus contactos."
            }
            (threatType == TYPE_SMS || threatType == TYPE_WHATSAPP) &&
            (category.contains("Banco", ignoreCase = true) || category.contains("Fintech", ignoreCase = true)) -> {
                "Eliminá el mensaje de inmediato. Ningún banco te pedirá validar cuentas o enviar claves por mensaje."
            }
            threatType == TYPE_SMS || threatType == TYPE_WHATSAPP -> {
                if (rawAdvice.contains("llamada", ignoreCase = true)) {
                    "Eliminá el mensaje y no ingreses a ningún enlace. No compartas códigos ni datos personales."
                } else rawAdvice
            }
            else -> rawAdvice
        }
        tvAdvice.text = resolvedAdvice

        // Personalización según el tipo de amenaza (Llamada / Mensaje / URL)
        when (threatType) {
            TYPE_CALL -> {
                tvThreatTypeEmoji.text = "📞"
                tvThreatTitle.text = "Llamada sospechosa detectada"
                btnSafeAction.text = "Cortar llamada (Recomendado)"
                btnRiskyAction.text = "Continuar con la llamada (No recomendado)"

                btnSafeAction.setOnClickListener {
                    endCurrentCall()
                    clearAllNotifications()
                    Toast.makeText(this, "Llamada finalizada por seguridad", Toast.LENGTH_SHORT).show()
                    finish()
                }

                btnRiskyAction.setOnClickListener {
                    Toast.makeText(this, "Atención: no brindes datos bancarios ni claves", Toast.LENGTH_LONG).show()
                    finish()
                }
            }

            TYPE_URL -> {
                tvThreatTypeEmoji.text = "🌐"
                tvThreatTitle.text = "Sitio web peligroso detectado"
                btnSafeAction.text = "Salir de esta web e ir a Google (Recomendado)"
                btnRiskyAction.text = "Continuar al sitio web (Peligroso / No recomendado)"

                btnSafeAction.setOnClickListener {
                    val googleIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    startActivity(googleIntent)
                    clearAllNotifications()
                    Toast.makeText(this, "Redirigido a un sitio seguro (Google)", Toast.LENGTH_SHORT).show()
                    finish()
                }

                btnRiskyAction.setOnClickListener {
                    try {
                        val proceedUrl = if (originalUrl.startsWith("http://") || originalUrl.startsWith("https://")) {
                            originalUrl
                        } else {
                            "http://$originalUrl"
                        }
                        val proceedIntent = Intent(Intent.ACTION_VIEW, Uri.parse(proceedUrl)).apply {
                            setPackage("com.android.chrome")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(proceedIntent)
                    } catch (e: Exception) {
                        // ignore
                    }
                    Toast.makeText(this, "Peligro: No ingreses claves ni contraseñas en este sitio", Toast.LENGTH_LONG).show()
                    finish()
                }
            }

            else -> { // SMS o WHATSAPP
                tvThreatTypeEmoji.text = "💬"
                tvThreatTitle.text = "Mensaje fraudulento detectado"
                btnSafeAction.text = "Eliminar mensaje (Recomendado)"
                btnRiskyAction.text = "Continuar y ver mensaje (No recomendado)"

                // Acción segura: Borrar mensaje y volver a inicio limpio
                btnSafeAction.setOnClickListener {
                    deleteSmsMessage(detectedValue, messageText)
                    clearAllNotifications()
                    Toast.makeText(this, "Mensaje descartado y alerta eliminada.", Toast.LENGTH_SHORT).show()
                    goToHomeScreen()
                    finish()
                }

                // Acción peligrosa: Abrir la app de mensajería (SMS o WhatsApp) para ver el mensaje
                btnRiskyAction.setOnClickListener {
                    Toast.makeText(this, "Atención: Nunca compartas códigos ni transfieras dinero", Toast.LENGTH_LONG).show()
                    openMessagingApp(threatType, detectedValue)
                    finish()
                }
            }
        }
    }

    private fun openMessagingApp(threatType: String, detectedValue: String) {
        if (threatType == TYPE_WHATSAPP) {
            val waIntent = packageManager.getLaunchIntentForPackage("com.whatsapp")
            if (waIntent != null) {
                waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(waIntent)
                return
            }
        }

        // Para SMS: abrir la conversación del remitente o la app de mensajería
        val cleanNumber = detectedValue.replace(Regex("[^0-9+]"), "").trim()
        val smsIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse(if (cleanNumber.isNotEmpty()) "sms:$cleanNumber" else "sms:")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try {
            startActivity(smsIntent)
        } catch (e: Exception) {
            val appIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_APP_MESSAGING)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            try {
                startActivity(appIntent)
            } catch (ex: Exception) {
                Log.e(TAG, "No se pudo abrir la app de mensajería: ${ex.message}")
            }
        }
    }

    private fun determineThreatType(): String {
        val explicitType = intent.getStringExtra(EXTRA_THREAT_TYPE)
        if (!explicitType.isNullOrBlank()) return explicitType

        val detectedValue = intent.getStringExtra(EXTRA_DETECTED_VALUE) ?: ""
        val category = intent.getStringExtra(EXTRA_CATEGORY) ?: ""
        val signals = intent.getStringExtra(EXTRA_SIGNALS) ?: ""

        return when {
            detectedValue.startsWith("http://") || detectedValue.startsWith("https://") ||
            detectedValue.contains(".site") || detectedValue.contains(".com") ||
            category.contains("Web", ignoreCase = true) || category.contains("Phishing", ignoreCase = true) -> TYPE_URL

            category.contains("Llamada", ignoreCase = true) || signals.contains("Llamada", ignoreCase = true) -> TYPE_CALL
            else -> TYPE_SMS
        }
    }

    private fun setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
    }

    private fun endCurrentCall() {
        var ended = false

        // 1. TelecomManager.endCall() (Android 9+ / API 28+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val telecomManager = getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            try {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED) {
                    ended = telecomManager?.endCall() ?: false
                    Log.d(TAG, "TelecomManager.endCall() ejecutado con resultado: $ended")
                } else {
                    Log.w(TAG, "No se cuenta con permiso ANSWER_PHONE_CALLS")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error invocando telecomManager.endCall(): ${e.message}")
            }
        }

        // 2. TelephonyManager reflection fallback
        if (!ended) {
            try {
                val tm = getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                val method = tm?.javaClass?.getDeclaredMethod("getITelephony")
                method?.isAccessible = true
                val telephony = method?.invoke(tm)
                val endCallMethod = telephony?.javaClass?.getDeclaredMethod("endCall")
                endCallMethod?.invoke(telephony)
                Log.d(TAG, "Llamada finalizada mediante Telephony reflection fallback")
            } catch (e: Exception) {
                Log.w(TAG, "Fallback Telephony reflection no disponible: ${e.message}")
            }
        }

        // 3. Regresar inmediatamente a la pantalla de inicio para despejar la pantalla
        goToHomeScreen()
    }

    private fun deleteSmsMessage(detectedValue: String, messageText: String) {
        val cleanNumber = detectedValue.replace(Regex("[^0-9+]"), "").trim()
        val uri = Uri.parse("content://sms")
        var count = 0

        try {
            if (cleanNumber.isNotEmpty()) {
                count += contentResolver.delete(uri, "address LIKE ?", arrayOf("%$cleanNumber%"))
            }
            if (count == 0 && messageText.isNotBlank()) {
                val snippet = messageText.take(30).trim()
                if (snippet.length >= 5) {
                    count += contentResolver.delete(uri, "body LIKE ?", arrayOf("%$snippet%"))
                }
            }
            Log.d(TAG, "SMS eliminados de content://sms: $count")
        } catch (e: Exception) {
            Log.w(TAG, "No se pudo borrar directamente de content://sms: ${e.message}")
        }

        // Cancelar cualquier notificación activa del listener
        try {
            ScamNotificationListener.instance?.cancelAllNotifications()
        } catch (e: Exception) {
            // ignore
        }
    }

    private fun goToHomeScreen() {
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
    }

    private fun clearAllNotifications() {
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancelAll()
        } catch (e: Exception) {
            Log.e(TAG, "Error cancelando notificaciones: ${e.message}")
        }
    }
}
