package com.escudodigital.core

/**
 * Resultado estándar del motor de evaluación de riesgo local.
 * Sección 22 y 25 de AGENTS.md: Motor de riesgo y resultados.
 */
enum class RiskLevel {
    LOW,     // 🟢 Sin antecedentes
    MEDIUM,  // 🟡 Señales moderadas
    HIGH,    // 🔴 Amenaza confirmada en base
    UNKNOWN  // ⚪ Información insuficiente para determinar
}

data class RiskResult(
    val level: RiskLevel,
    val source: String,        // "local_db" | "heuristic" | "trusted_list"
    val category: String?,     // Modalidad: "Falso Familiar", "Suplantación Bancaria", etc.
    val detectedValue: String, // El número/dominio analizado
    val signals: List<String>, // Señales específicas detectadas para mostrar al usuario
    val advice: String?        // Qué hacer ahora (de la base de datos o heurística)
) {
    val isHighRisk: Boolean get() = level == RiskLevel.HIGH
    val isMediumOrHigh: Boolean get() = level == RiskLevel.MEDIUM || level == RiskLevel.HIGH
}
