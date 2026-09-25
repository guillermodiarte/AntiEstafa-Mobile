package com.escudodigital.ui

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.TelecomManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.escudodigital.R
import com.escudodigital.data.local.EscudoDatabase
import kotlinx.coroutines.launch

/**
 * Ventana modal / pantalla de intercepción de amenaza en tiempo real.
 * Aparece inmediatamente cuando Escudo Digital detecta una amenaza
 * (llamada entrante sospechosa, SMS/WhatsApp fraudulento o URL peligrosa).
 *
 * Muestra el tipo de alerta, señales encontradas y dos opciones claras:
 * - Acción segura y recomendada (cortar llamada, eliminar mensaje, salir a google.com).
 * - Continuar bajo su propio riesgo (siempre desaconsejado).
 */
class ThreatInterceptActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_THREAT_TYPE = "extra_threat_type" // CALL, SMS, WHATSAPP, URL
        const val EXTRA_RISK_LEVEL = "extra_risk_level"
        const val EXTRA_DETECTED_VALUE = "extra_detected_value"
        const val EXTRA_CATEGORY = "extra_category"
        const val EXTRA_SIGNALS = "extra_signals"
        const val EXTRA_ADVICE = "extra_advice"
        const val EXTRA_ORIGINAL_URL = "extra_original_url"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"

        const val TYPE_CALL = "CALL"
        const val TYPE_SMS = "SMS"
        const val TYPE_WHATSAPP = "WHATSAPP"
        const val TYPE_URL = "URL"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configuración para mostrar la ventana sobre la pantalla de bloqueo y encender pantalla
        setupWindowFlags()

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
                        notificationId = -1
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

        // Caso 2: Se abrió desde AlertManager o notificación con extras
        val threatType = determineThreatType()
        val riskLevel = intent.getStringExtra(EXTRA_RISK_LEVEL) ?: "HIGH"
        val detectedValue = intent.getStringExtra(EXTRA_DETECTED_VALUE) ?: ""
        val category = intent.getStringExtra(EXTRA_CATEGORY) ?: "Amenaza detectada"
        val signals = intent.getStringExtra(EXTRA_SIGNALS) ?: "• Señal de riesgo detectada por el motor de seguridad"
        val advice = intent.getStringExtra(EXTRA_ADVICE) ?: "No brindes datos personales ni claves bancarias."
        val originalUrl = intent.getStringExtra(EXTRA_ORIGINAL_URL) ?: detectedValue
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)

        setupUI(threatType, riskLevel, detectedValue, category, signals, advice, originalUrl, notificationId)
    }

    private fun setupUI(
        threatType: String,
        riskLevel: String,
        detectedValue: String,
        category: String,
        signals: String,
        advice: String,
        originalUrl: String,
        notificationId: Int
    ) {
        val tvRiskBadge = findViewById<TextView>(R.id.tvRiskBadge)
        val tvThreatTypeEmoji = findViewById<TextView>(R.id.tvThreatTypeEmoji)
        val tvThreatTitle = findViewById<TextView>(R.id.tvThreatTitle)
        val tvThreatValue = findViewById<TextView>(R.id.tvThreatValue)
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
        tvAdvice.text = advice

        // Personalización según el tipo de amenaza (Llamada / Mensaje / URL)
        when (threatType) {
            TYPE_CALL -> {
                tvThreatTypeEmoji.text = "📞"
                tvThreatTitle.text = "Llamada sospechosa detectada"
                btnSafeAction.text = "Cortar llamada (Recomendado)"
                btnRiskyAction.text = "Continuar con la llamada (No recomendado)"

                btnSafeAction.setOnClickListener {
                    endCurrentCall()
                    dismissNotification(notificationId)
                    Toast.makeText(this, "Llamada finalizada por seguridad", Toast.LENGTH_SHORT).show()
                    goToHomeScreen()
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
                    // Redirigir a google.com como solicita la especificación
                    val googleIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    startActivity(googleIntent)
                    dismissNotification(notificationId)
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

                btnSafeAction.setOnClickListener {
                    dismissNotification(notificationId)
                    // Abrir la app de mensajería para que el usuario pueda borrarlo
                    val messagingIntent = Intent(Intent.ACTION_MAIN).apply {
                        addCategory(Intent.CATEGORY_APP_MESSAGING)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    try {
                        startActivity(messagingIntent)
                    } catch (e: Exception) {
                        val smsIntent = Intent(Intent.ACTION_VIEW).apply {
                            data = Uri.parse("sms:")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(smsIntent)
                    }
                    Toast.makeText(this, "Notificación descartada. Elimina el mensaje por seguridad.", Toast.LENGTH_LONG).show()
                    finish()
                }

                btnRiskyAction.setOnClickListener {
                    Toast.makeText(this, "Advertencia: Nunca compartas códigos ni transfieras dinero", Toast.LENGTH_LONG).show()
                    finish()
                }
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val telecomManager = getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            try {
                telecomManager?.endCall()
            } catch (e: SecurityException) {
                // Requiere permiso ANSWER_PHONE_CALLS
            }
        }
    }

    private fun goToHomeScreen() {
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
    }

    private fun dismissNotification(notificationId: Int) {
        if (notificationId != -1) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancel(notificationId)
        }
    }
}
