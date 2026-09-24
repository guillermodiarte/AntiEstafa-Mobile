package com.escudodigital.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.escudodigital.R
import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.core.RiskLevel
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.databinding.ActivityAlertDetailBinding
import kotlinx.coroutines.launch

/**
 * Pantalla de detalle de una alerta preventiva.
 * Sección 25 de AGENTS.md: Qué mostrar en cada alerta (3 preguntas).
 * Sección 3 de AGENTS.md: UX accesible con letra grande y lenguaje cotidiano.
 *
 * Muestra al usuario:
 *  1. ¿Qué detectamos?
 *  2. ¿Por qué importa?
 *  3. ¿Qué hacer ahora?
 *
 * Siempre ofrece: "Permitir este número" (Sección 12 de AGENTS.md).
 */
class AlertDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_RISK_LEVEL = "risk_level"
        const val EXTRA_DETECTED_VALUE = "detected_value"
        const val EXTRA_CATEGORY = "category"
        const val EXTRA_SIGNALS = "signals"
        const val EXTRA_ADVICE = "advice"
    }

    private lateinit var binding: ActivityAlertDetailBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAlertDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val riskLevelStr = intent.getStringExtra(EXTRA_RISK_LEVEL) ?: "MEDIUM"
        val detectedValue = intent.getStringExtra(EXTRA_DETECTED_VALUE) ?: "Desconocido"
        val category = intent.getStringExtra(EXTRA_CATEGORY) ?: "Mensaje sospechoso"
        val signals = intent.getStringExtra(EXTRA_SIGNALS) ?: "• Señales de posible fraude detectadas"
        val advice = intent.getStringExtra(EXTRA_ADVICE) ?: "Consultá con un familiar de confianza."

        val riskLevel = try {
            RiskLevel.valueOf(riskLevelStr)
        } catch (e: Exception) {
            RiskLevel.MEDIUM
        }

        setupContent(riskLevel, detectedValue, category, signals, advice)
        setupButtons(detectedValue)
    }

    private fun setupContent(
        riskLevel: RiskLevel,
        detectedValue: String,
        category: String,
        signals: String,
        advice: String
    ) {
        // Badge de riesgo
        binding.tvAlertBadge.text = when (riskLevel) {
            RiskLevel.HIGH -> "🔴 RIESGO ALTO DETECTADO"
            RiskLevel.MEDIUM -> "🟡 SEÑAL SOSPECHOSA"
            else -> "⚪ REVISÁ CON CALMA"
        }
        binding.tvAlertBadge.setTextColor(
            getColor(
                when (riskLevel) {
                    RiskLevel.HIGH -> R.color.shield_danger
                    RiskLevel.MEDIUM -> R.color.shield_warning
                    else -> R.color.text_secondary
                }
            )
        )

        // Valor detectado (número / dominio)
        binding.tvAlertTarget.text = detectedValue

        // 1. ¿Qué detectamos?
        binding.tvWhatDetected.text = "Modalidad: $category"

        // 2. ¿Por qué importa? — usando las señales detectadas
        binding.tvWhyDanger.text = signals.replace("• ", "\n• ").trim()

        // 3. ¿Qué hacer ahora?
        binding.tvWhatToDo.text = advice
    }

    private fun setupButtons(detectedValue: String) {
        // Botón: Permitir número (Sección 12 de AGENTS.md)
        binding.btnAllowContact.setOnClickListener {
            addToTrustedList(detectedValue)
        }

        // Botón: Cerrar la alerta
        binding.btnCloseAlert.setOnClickListener {
            finish()
        }
    }

    private fun addToTrustedList(value: String) {
        lifecycleScope.launch {
            val db = EscudoDatabase.getInstance(applicationContext)
            val engine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())
            engine.addToTrustedList(value)
            Toast.makeText(
                this@AlertDetailActivity,
                "\"$value\" fue agregado a tu lista de contactos de confianza.",
                Toast.LENGTH_LONG
            ).show()
            finish()
        }
    }
}
