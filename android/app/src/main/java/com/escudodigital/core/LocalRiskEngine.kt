package com.escudodigital.core

import com.escudodigital.data.local.dao.ThreatDao
import com.escudodigital.data.local.dao.TrustedNumberDao
import com.escudodigital.data.local.entity.TrustedNumber

/**
 * Motor de evaluación de riesgo local.
 * Secciones 22 y 23 de AGENTS.md: Motor de riesgo y Privacy-First.
 *
 * Primera línea de defensa: siempre local, sin enviar datos a servidores.
 * No depende de internet. Trabaja solo con la base Room y reglas heurísticas.
 *
 * Flujo:
 *  Contenido → Lista de Confianza → Base Local Room → Heurísticas → Resultado
 */
class LocalRiskEngine(
    private val threatDao: ThreatDao,
    private val trustedNumberDao: TrustedNumberDao
) {

    // Palabras clave heurísticas de urgencia y solicitud de datos sensibles
    // que el motor analiza en el texto de las notificaciones
    private val URGENCY_KEYWORDS = listOf(
        "urgente", "inmediato", "hoy", "vence", "bloqueada", "suspendida",
        "problema", "emergencia", "accidente", "error", "verificar ahora"
    )

    private val MONEY_KEYWORDS = listOf(
        "transferencia", "transferí", "depositá", "pesos", "plata", "cbu",
        "alias", "mercado pago", "billetera", "cajero", "efectivo"
    )

    private val CODE_KEYWORDS = listOf(
        "código", "clave", "contraseña", "pin", "token", "otp", "verificación",
        "6 dígitos", "doble factor", "autenticación"
    )

    private val IDENTITY_KEYWORDS = listOf(
        "banco", "anses", "pami", "afip", "renaper", "soporte", "técnico",
        "sistema", "seguridad", "alertamos", "detectamos"
    )

    // --- Evaluación de Número Telefónico ---

    suspend fun evaluatePhone(rawNumber: String, isCall: Boolean = true): RiskResult {
        val normalized = normalizePhone(rawNumber)

        // 1. Lista de confianza local del usuario (tiene prioridad máxima)
        val trusted = trustedNumberDao.findTrustedNumber(normalized)
        if (trusted != null) {
            return RiskResult(
                level = RiskLevel.LOW,
                source = "trusted_list",
                category = null,
                detectedValue = rawNumber,
                signals = listOf("Número en tu lista de contactos de confianza"),
                advice = null
            )
        }

        // 2. Base Room local (amenazas validadas)
        val threat = threatDao.findPhoneThreat(normalized)
        if (threat != null && !threat.isDeleted) {
            return RiskResult(
                level = mapRiskLevel(threat.riskLevel),
                source = "local_db",
                category = threat.category,
                detectedValue = rawNumber,
                signals = listOf(
                    "Número registrado en la base de seguridad comunitaria",
                    "Modalidad: ${threat.category ?: "Fraude no clasificado"}"
                ),
                advice = getAdviceForCategory(threat.category, isCall)
            )
        }

        // 3. Sin antecedentes - informar preventivamente si el número es desconocido
        return RiskResult(
            level = RiskLevel.LOW,
            source = "local_db",
            category = null,
            detectedValue = rawNumber,
            signals = emptyList(),
            advice = null
        )
    }

    // --- Evaluación de Dominio Web ---

    suspend fun evaluateDomain(rawDomain: String): RiskResult {
        val normalized = normalizeDomain(rawDomain)

        val threat = threatDao.findDomainThreat(normalized)
        if (threat != null && !threat.isDeleted) {
            return RiskResult(
                level = mapRiskLevel(threat.riskLevel),
                source = "local_db",
                category = threat.category,
                detectedValue = rawDomain,
                signals = listOf(
                    "Dominio reportado como phishing o sitio falso",
                    "Categoría: ${threat.category ?: "Sitio fraudulento"}"
                ),
                advice = "No ingreses tus datos personales ni claves en este sitio. Cerrá la página."
            )
        }

        return RiskResult(
            level = RiskLevel.LOW,
            source = "local_db",
            category = null,
            detectedValue = rawDomain,
            signals = emptyList(),
            advice = null
        )
    }

    // --- Evaluación Heurística de Texto de Notificación ---

    /**
     * Analiza el texto disponible en la notificación de WhatsApp o SMS.
     * No accede al chat completo - solo el snippet visible en la notificación.
     * Sección 7 de AGENTS.md: límites del análisis de WhatsApp.
     */
    fun evaluateNotificationText(text: String): RiskResult {
        val lowerText = text.lowercase()
        val detectedSignals = mutableListOf<String>()
        var score = 0

        val hasUrgency = URGENCY_KEYWORDS.any { lowerText.contains(it) }
        val hasMoney = MONEY_KEYWORDS.any { lowerText.contains(it) }
        val hasCode = CODE_KEYWORDS.any { lowerText.contains(it) }
        val hasFakeIdentity = IDENTITY_KEYWORDS.any { lowerText.contains(it) }

        if (hasUrgency) {
            score += 2
            detectedSignals.add("Lenguaje de urgencia artificial detectado")
        }
        if (hasMoney) {
            score += 3
            detectedSignals.add("Solicitud de transferencia o dinero")
        }
        if (hasCode) {
            score += 3
            detectedSignals.add("Solicitud de código de seguridad o clave")
        }
        if (hasFakeIdentity) {
            score += 1
            detectedSignals.add("Menciona banco u organismo público")
        }

        // Combinaciones de alto riesgo (Sección 22 de AGENTS.md)
        val level = when {
            score >= 5 -> RiskLevel.HIGH
            score >= 2 -> RiskLevel.MEDIUM
            else -> RiskLevel.LOW
        }

        if (level == RiskLevel.LOW) {
            return RiskResult(
                level = RiskLevel.LOW,
                source = "heuristic",
                category = null,
                detectedValue = text.take(50),
                signals = emptyList(),
                advice = null
            )
        }

        return RiskResult(
            level = level,
            source = "heuristic",
            category = inferCategory(hasMoney, hasCode, hasFakeIdentity),
            detectedValue = text.take(50),
            signals = detectedSignals,
            advice = buildHeuristicAdvice(hasMoney, hasCode)
        )
    }

    /**
     * Evalúa tanto URLs y dominios presentes en el texto como heurísticas del contenido.
     * Si contiene una URL reportada en la base comunitaria, la marca como prioridad alta.
     */
    suspend fun evaluateNotificationContent(text: String): RiskResult {
        val urlRegex = Regex("""(https?://[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|site|net|org|ar|gob\.ar|com\.ar|xyz|info)[^\s]*)""", RegexOption.IGNORE_CASE)
        val matches = urlRegex.findAll(text)

        for (match in matches) {
            val rawUrl = match.value.trimEnd('.', ',', ';', '!', '?')
            val domainResult = evaluateDomain(rawUrl)
            if (domainResult.isMediumOrHigh) {
                return domainResult.copy(detectedValue = rawUrl)
            }
        }

        // Si no hay dominios reportados en la base, analizar con heurística de texto
        return evaluateNotificationText(text)
    }

    // --- Gestión de Lista de Confianza ---

    suspend fun addToTrustedList(number: String) {
        val normalized = normalizePhone(number)
        trustedNumberDao.addTrustedNumber(TrustedNumber(normalizedNumber = normalized))
    }

    suspend fun removeFromTrustedList(number: String) {
        val normalized = normalizePhone(number)
        trustedNumberDao.removeTrustedNumber(normalized)
    }

    // --- Utilidades Privadas ---

    fun normalizePhone(phone: String): String {
        val clean = phone.replace(Regex("[^\\d+]"), "").trim()
        return clean
    }

    fun normalizeDomain(domain: String): String {
        return domain.trim()
            .lowercase()
            .removePrefix("https://")
            .removePrefix("http://")
            .split("/")[0]
            .split("?")[0]
            .removePrefix("www.")
            .trimEnd('.')
    }

    private fun mapRiskLevel(riskStr: String): RiskLevel = when (riskStr.lowercase()) {
        "high" -> RiskLevel.HIGH
        "medium" -> RiskLevel.MEDIUM
        "low" -> RiskLevel.LOW
        else -> RiskLevel.UNKNOWN
    }

    private fun inferCategory(hasMoney: Boolean, hasCode: Boolean, hasFakeIdentity: Boolean): String {
        return when {
            hasMoney && hasFakeIdentity -> "Suplantación Bancaria / Fintech"
            hasCode && hasFakeIdentity -> "Suplantación Bancaria / Robo de Cuenta"
            hasMoney -> "Falso Familiar / Solicitud Urgente de Dinero"
            hasCode -> "Robo de Código de Verificación"
            else -> "Mensaje Sospechoso"
        }
    }

    private fun buildHeuristicAdvice(hasMoney: Boolean, hasCode: Boolean): String {
        return when {
            hasMoney -> "No realices ninguna transferencia. Llamá directamente a tu familiar o banco para verificar."
            hasCode -> "Nunca compartas el código de 6 dígitos. Ningún banco ni WhatsApp te lo pide por mensaje."
            else -> "No respondas ni hagas clic en enlaces. Si tenés dudas, consultá a un familiar de confianza."
        }
    }

    fun getAdviceForCategory(category: String?, isCall: Boolean = true): String {
        val cat = category?.lowercase() ?: ""
        return if (isCall) {
            when {
                cat.contains("familiar") -> "Cortá la llamada y llamá a tu familiar a su número habitual para confirmarlo."
                cat.contains("banco") || cat.contains("fintech") -> "Los bancos nunca piden claves ni tokens por llamada. Cortá la llamada."
                cat.contains("anses") || cat.contains("pami") -> "ANSES y PAMI no cobran bonos por teléfono ni te piden claves. Cortá la llamada."
                else -> "No brindes datos personales ni hagas transferencias. Cortá la llamada."
            }
        } else {
            when {
                cat.contains("familiar") -> "Eliminá el mensaje y no envíes dinero ni respondas. Comunicate con tu familiar llamándolo directamente al número habitual que tengas en tu agenda."
                cat.contains("banco") || cat.contains("fintech") -> "Eliminá el mensaje de inmediato. Ningún banco te pedirá validar cuentas o enviar claves por mensaje."
                cat.contains("anses") || cat.contains("pami") -> "Eliminá el mensaje. Ningún organismo oficial solicita datos bancarios ni claves por WhatsApp o SMS."
                else -> "Eliminá el mensaje y no ingreses a ningún enlace. No compartas códigos ni datos personales."
            }
        }
    }
}
