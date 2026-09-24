package com.escudodigital

import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.core.RiskLevel
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests de evaluación de amenazas contra datos de la base local (seed data).
 * Reproduce el flujo de la demo del Hackathon: Sección 37 de AGENTS.md.
 */
class ThreatDatabaseLookupTest {

    private lateinit var engine: LocalRiskEngine

    @Before
    fun setUp() {
        engine = LocalRiskEngine(StubThreatDaoWithData(), StubTrustedNumberDao())
    }

    @Test
    fun `numero de falso familiar es detectado como HIGH risk`() = runBlocking {
        val result = engine.evaluatePhone("+5491138901234")

        assertEquals(RiskLevel.HIGH, result.level)
        assertEquals("local_db", result.source)
        assertTrue(result.category?.contains("Familiar", ignoreCase = true) == true)
        assertNotNull(result.advice)
    }

    @Test
    fun `numero desconocido devuelve LOW risk`() = runBlocking {
        val result = engine.evaluatePhone("+5491100000000")

        assertEquals(RiskLevel.LOW, result.level)
        assertTrue(result.signals.isEmpty())
    }

    @Test
    fun `dominio de phishing ANSES es detectado como HIGH risk`() = runBlocking {
        val result = engine.evaluateDomain("anses-beneficios-gob-ar.site")

        assertEquals(RiskLevel.HIGH, result.level)
        assertEquals("local_db", result.source)
        assertTrue(result.category?.contains("ANSES", ignoreCase = true) == true)
    }

    @Test
    fun `dominio de Mercado Pago falso es detectado como HIGH risk`() = runBlocking {
        val result = engine.evaluateDomain("seguridad-mercadopago-alerta.com")

        assertEquals(RiskLevel.HIGH, result.level)
        assertTrue(result.category?.contains("Banco", ignoreCase = true) == true ||
                   result.category?.contains("Fintech", ignoreCase = true) == true)
    }

    @Test
    fun `dominio legitimo no esta en base y devuelve LOW risk`() = runBlocking {
        val result = engine.evaluateDomain("anses.gob.ar")

        assertEquals(RiskLevel.LOW, result.level)
    }

    @Test
    fun `numero en lista de confianza siempre devuelve LOW risk aunque este en base`() = runBlocking {
        val trustedDao = StubTrustedNumberDao()
        val engineWithTrust = LocalRiskEngine(StubThreatDaoWithData(), trustedDao)

        // Agregar el número peligroso a la lista de confianza del usuario
        engineWithTrust.addToTrustedList("+5491138901234")

        val result = engineWithTrust.evaluatePhone("+5491138901234")

        assertEquals(RiskLevel.LOW, result.level)
        assertEquals("trusted_list", result.source)
    }

    @Test
    fun `url con dominio de phishing es detectada como peligrosa`() = runBlocking {
        // La URL completa debe resolverse al dominio peligroso conocido
        val result = engine.evaluateDomain("seguridad-mercadopago-alerta.com/login?user=12345")

        assertEquals(RiskLevel.HIGH, result.level)
    }
}
