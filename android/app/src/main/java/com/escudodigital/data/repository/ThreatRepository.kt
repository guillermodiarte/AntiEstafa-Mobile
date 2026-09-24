package com.escudodigital.data.repository

import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.core.RiskResult
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.data.local.entity.LocalThreat
import com.escudodigital.data.local.entity.SyncState

/**
 * Repositorio central que expone el motor de riesgo y la base de datos local
 * a las ViewModels y servicios.
 */
class ThreatRepository(private val db: EscudoDatabase) {

    private val riskEngine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())

    // --- Evaluación de Riesgo (Privacy-First, Offline) ---

    suspend fun evaluatePhone(number: String): RiskResult =
        riskEngine.evaluatePhone(number)

    suspend fun evaluateDomain(domain: String): RiskResult =
        riskEngine.evaluateDomain(domain)

    fun evaluateText(text: String): RiskResult =
        riskEngine.evaluateNotificationText(text)

    // --- Lista de Confianza ---

    suspend fun addToTrustedList(number: String) =
        riskEngine.addToTrustedList(number)

    suspend fun removeFromTrustedList(number: String) =
        riskEngine.removeFromTrustedList(number)

    // --- Estado de Sincronización ---

    suspend fun getSyncState(): SyncState? =
        db.syncStateDao().getSyncState()

    // --- Estadísticas de la base local (para pantalla principal) ---

    suspend fun getLocalThreatCount(): Int =
        db.threatDao().getAllActiveThreats().size

    companion object {
        @Volatile private var instance: ThreatRepository? = null

        fun getInstance(db: EscudoDatabase): ThreatRepository =
            instance ?: synchronized(this) {
                instance ?: ThreatRepository(db).also { instance = it }
            }
    }
}
