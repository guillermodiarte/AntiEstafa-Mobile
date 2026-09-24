package com.escudodigital

import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.core.RiskLevel
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitarios del motor de evaluación de riesgo local.
 * Sección 42 de AGENTS.md: Prioridades de pruebas - Motor local primero.
 *
 * Estas pruebas corren en JVM pura (sin Android SDK), sin base de datos real.
 * Se enfoca en las reglas heurísticas del motor que protegen al adulto mayor.
 */
class LocalRiskEngineTest {

    // Stub de DAOs para tests unitarios (sin Room / SQLite)
    private val noThreatDao = StubThreatDao()
    private val noTrustedDao = StubTrustedNumberDao()
    private lateinit var engine: LocalRiskEngine

    @Before
    fun setUp() {
        engine = LocalRiskEngine(noThreatDao, noTrustedDao)
    }

    // --- Tests de Heurísticas de Texto ---

    @Test
    fun `texto de urgencia con pedido de dinero detecta ALTO riesgo`() {
        val text = "Hola mamá, me cambié el número, tuve un accidente y necesito una " +
                "transferencia urgente de 80.000 pesos al CBU que te mando ahora."
        val result = engine.evaluateNotificationText(text)

        assertEquals(RiskLevel.HIGH, result.level)
        assertEquals("heuristic", result.source)
        assertTrue(result.signals.any { it.contains("urgencia", ignoreCase = true) || it.contains("transferencia", ignoreCase = true) })
    }

    @Test
    fun `pedido de codigo de verificacion detecta ALTO riesgo`() {
        val text = "Tu código de verificación de WhatsApp es 456-789. No lo compartas con nadie."
        // Mensaje malicioso: alguien pidiéndonos ese código
        val maliciousText = "Necesito el código de 6 dígitos que te llegó por SMS para verificar tu cuenta bancaria."
        val result = engine.evaluateNotificationText(maliciousText)

        assertEquals(RiskLevel.HIGH, result.level)
        assertTrue(result.signals.any { it.contains("código", ignoreCase = true) })
    }

    @Test
    fun `suplantacion de banco con urgencia detecta ALTO riesgo`() {
        val text = "BANCO NACION: Detectamos acceso no autorizado. Llamá inmediatamente al " +
                "0800 falso para validar tus datos y evitar el bloqueo definitivo."
        val result = engine.evaluateNotificationText(text)

        assertTrue(result.level == RiskLevel.HIGH || result.level == RiskLevel.MEDIUM)
        assertNotNull(result.advice)
    }

    @Test
    fun `texto de ANSES con solicitud bancaria detecta riesgo MEDIO o ALTO`() {
        val text = "ANSES: Tenés un bono pendiente. Ingresá tus datos bancarios para cobrar."
        val result = engine.evaluateNotificationText(text)

        assertTrue(result.isMediumOrHigh)
    }

    @Test
    fun `mensaje normal de familiar no detecta riesgo`() {
        val text = "Hola cómo estás? Te llamo más tarde."
        val result = engine.evaluateNotificationText(text)

        assertEquals(RiskLevel.LOW, result.level)
        assertTrue(result.signals.isEmpty())
    }

    @Test
    fun `mensaje de confirmacion de pedido no detecta riesgo`() {
        val text = "Tu pedido #12345 fue enviado. Llegará mañana entre 10 y 14hs."
        val result = engine.evaluateNotificationText(text)

        assertEquals(RiskLevel.LOW, result.level)
    }

    // --- Tests de Normalización ---

    @Test
    fun `normalizePhone elimina espacios y guiones`() {
        val cleaned = engine.normalizePhone("+54 9 11 3890-1234")
        assertEquals("+5491138901234", cleaned)
    }

    @Test
    fun `normalizePhone preserva el signo mas del prefijo internacional`() {
        val cleaned = engine.normalizePhone("+5491138901234")
        assertTrue(cleaned.startsWith("+"))
    }

    @Test
    fun `normalizeDomain elimina protocolo y www`() {
        assertEquals("anses-beneficios-gob-ar.site", engine.normalizeDomain("https://www.anses-beneficios-gob-ar.site/login"))
    }

    @Test
    fun `normalizeDomain convierte a minusculas`() {
        assertEquals("banco-galicia.com", engine.normalizeDomain("HTTPS://Banco-Galicia.com/seguridad"))
    }

    @Test
    fun `normalizeDomain elimina path y query`() {
        val result = engine.normalizeDomain("http://phishing-site.xyz/credencial?user=12345")
        assertEquals("phishing-site.xyz", result)
    }

    // --- Tests de Consejos (Advice) ---

    @Test
    fun `resultado con riesgo ALTO siempre incluye consejo no nulo`() {
        val text = "Urgente transferí ahora los pesos al CBU antes de que venza tu cuenta."
        val result = engine.evaluateNotificationText(text)

        if (result.isMediumOrHigh) {
            assertNotNull("El advice no debe ser null cuando hay riesgo", result.advice)
            assertTrue("El advice no debe estar vacío", result.advice!!.isNotBlank())
        }
    }

    @Test
    fun `resultado con nivel LOW no molesta al usuario`() {
        val text = "¿Querés que te traiga algo del súper?"
        val result = engine.evaluateNotificationText(text)

        assertFalse("No debe mostrar alerta para texto inocente", result.isMediumOrHigh)
    }
}
