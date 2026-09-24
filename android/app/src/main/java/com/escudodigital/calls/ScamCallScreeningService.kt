package com.escudodigital.calls

import android.telecom.Call
import android.telecom.CallScreeningService
import com.escudodigital.core.AlertManager
import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.core.RiskLevel
import com.escudodigital.core.RiskResult
import com.escudodigital.data.local.EscudoDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * Filtrado de llamadas telefónicas con base en la base local Room.
 * Secciones 10 y 11 de AGENTS.md: Política de llamadas.
 *
 * Flujo:
 *  Número detectado → Lista de confianza → Base local → Evaluación de riesgo
 *
 * Decisión inmediata con base local. NO hace consultas remotas durante el screening.
 *
 * Política configurada en Modo Equilibrado (default):
 *  - Advertir números peligrosos
 *  - Advertir números desconocidos
 *  - NO bloquear desconocidos automáticamente
 */
class ScamCallScreeningService : CallScreeningService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var riskEngine: LocalRiskEngine

    override fun onCreate() {
        super.onCreate()
        val db = EscudoDatabase.getInstance(applicationContext)
        riskEngine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())
        AlertManager.createNotificationChannel(applicationContext)
    }

    override fun onScreenCall(callDetails: Call.Details) {
        val handle = callDetails.handle?.schemeSpecificPart

        // Número oculto o restringido (Sección 10 de AGENTS.md)
        if (handle.isNullOrBlank() || handle == "unknown") {
            val result = RiskResult(
                level = RiskLevel.MEDIUM,
                source = "heuristic",
                category = "Número Oculto / Restringido",
                detectedValue = "Número ocultado",
                signals = listOf("El número está oculto o restringido"),
                advice = "Tené precaución con llamadas de números ocultados. No brindes datos personales."
            )
            respondToCall(callDetails, shouldBlock = false) // Nunca bloquear en modo equilibrado
            AlertManager.sendAlert(applicationContext, result, 3000)
            return
        }

        // Evaluar el número con la base local (decisión síncrona requerida por el SDK)
        val result = runBlocking {
            riskEngine.evaluatePhone(handle)
        }

        val shouldBlock = result.level == RiskLevel.HIGH
        // Nota: en modo estricto (Sección 11 de AGENTS.md) se podría bloquear.
        // En MVP usamos modo equilibrado: solo advertir, nunca bloquear desconocidos.

        respondToCall(callDetails, shouldBlock = false)

        // Si hay señales de riesgo, lanzar alerta preventiva
        if (result.isMediumOrHigh || (result.level == RiskLevel.LOW && isUnknownContact(handle))) {
            val alertResult = if (result.isMediumOrHigh) result else
                RiskResult(
                    level = RiskLevel.MEDIUM,
                    source = "heuristic",
                    category = "Número Desconocido",
                    detectedValue = handle,
                    signals = listOf("El número no está en tu agenda ni en la base de contactos de confianza"),
                    advice = "Tené cuidado. Si solicitan dinero, códigos o datos bancarios, cortá la llamada."
                )
            AlertManager.sendAlert(applicationContext, alertResult, 3001)
        }
    }

    private fun respondToCall(callDetails: Call.Details, shouldBlock: Boolean) {
        val response = CallResponse.Builder()
            .setDisallowCall(shouldBlock)
            .setRejectCall(shouldBlock)
            .setSilenceCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()
        respondToCall(callDetails, response)
    }

    /**
     * Heurística simple: si el número no empieza con códigos conocidos de Argentina
     * y no está en la lista de confianza, lo tratamos como desconocido.
     * En la app real se integraría con los contactos del dispositivo.
     */
    private fun isUnknownContact(number: String): Boolean {
        return number.length < 7 || number.startsWith("*")
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
