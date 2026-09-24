package com.escudodigital

import com.escudodigital.data.local.dao.ThreatDao
import com.escudodigital.data.local.dao.TrustedNumberDao
import com.escudodigital.data.local.entity.LocalThreat
import com.escudodigital.data.local.entity.TrustedNumber

/**
 * Stub de ThreatDao para tests unitarios del motor de riesgo.
 * Simula una base de datos vacía (sin amenazas conocidas).
 * Para probar coincidencias en DB, se usa StubThreatDaoWithData.
 */
class StubThreatDao(
    private val threats: List<LocalThreat> = emptyList()
) : ThreatDao {
    override suspend fun getAllActiveThreats() = threats.filter { !it.isDeleted }
    override suspend fun findPhoneThreat(number: String) =
        threats.firstOrNull { it.type == "phone" && !it.isDeleted &&
            (it.value == number || number.endsWith(it.value.takeLast(8))) }
    override suspend fun findDomainThreat(domain: String) =
        threats.firstOrNull { it.type in listOf("domain","url") && !it.isDeleted &&
            (it.value == domain || domain.contains(it.value)) }
    override suspend fun getThreatsAfterVersion(sinceVersion: Int) =
        threats.filter { it.version > sinceVersion }
    override suspend fun upsertThreat(threat: LocalThreat) {}
    override suspend fun upsertAll(threats: List<LocalThreat>) {}
    override suspend fun getMaxVersion() = threats.maxOfOrNull { it.version }
}

/**
 * Stub de TrustedNumberDao para tests unitarios.
 * Simula una lista de confianza vacía.
 */
class StubTrustedNumberDao(
    private val trusted: MutableList<TrustedNumber> = mutableListOf()
) : TrustedNumberDao {
    override suspend fun findTrustedNumber(number: String) =
        trusted.firstOrNull { it.normalizedNumber == number }
    override suspend fun addTrustedNumber(number: TrustedNumber) { trusted.add(number) }
    override suspend fun removeTrustedNumber(number: String) {
        trusted.removeAll { it.normalizedNumber == number }
    }
    override suspend fun getAllTrustedNumbers() = trusted.toList()
}

/**
 * Stub de ThreatDao con datos pre-cargados para pruebas de coincidencia en DB.
 */
class StubThreatDaoWithData : ThreatDao by StubThreatDao(
    listOf(
        LocalThreat(
            id = 1L,
            type = "phone",
            value = "+5491138901234",
            riskLevel = "high",
            category = "Falso Familiar / Urgencia",
            version = 2,
            isDeleted = false
        ),
        LocalThreat(
            id = 5L,
            type = "domain",
            value = "anses-beneficios-gob-ar.site",
            riskLevel = "high",
            category = "Falso Organismo Público (ANSES / PAMI)",
            version = 6,
            isDeleted = false
        ),
        LocalThreat(
            id = 6L,
            type = "domain",
            value = "seguridad-mercadopago-alerta.com",
            riskLevel = "high",
            category = "Suplantación Bancaria / Fintech",
            version = 7,
            isDeleted = false
        )
    )
)
