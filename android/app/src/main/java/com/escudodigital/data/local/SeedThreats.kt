package com.escudodigital.data.local

import com.escudodigital.data.local.entity.LocalThreat
import com.escudodigital.data.local.entity.SyncState

/**
 * Base de amenazas semilla embebida en la app.
 *
 * Razón de ser (Sección 20 de AGENTS.md — funcionamiento offline):
 * Garantiza que la protección funcione desde el primer arranque, incluso
 * si el sync con el backend aún no completó o no hay Internet disponible.
 *
 * Estas amenazas son un subconjunto de las del backend (mismos IDs y versiones).
 * Cuando el SyncWorker sincroniza, upsertAll() reemplaza estos registros con
 * los del servidor sin duplicar ni perder datos.
 *
 * No reemplaza al sync — complementa la protección offline inicial.
 */
object SeedThreats {

    // Versión de este seed. El SyncWorker solo descargará cambios a partir de aquí.
    const val SEED_VERSION = 12

    val threats = listOf(
        // ── Teléfonos de alto riesgo ───────────────────────────────────────────
        LocalThreat(
            id = 1, type = "phone", value = "+5491138901234",
            riskLevel = "high", category = "Falso Familiar / Urgencia",
            version = 2, isDeleted = false
        ),
        LocalThreat(
            id = 2, type = "phone", value = "+5493517894561",
            riskLevel = "high", category = "Suplantación Bancaria / Fintech",
            version = 3, isDeleted = false
        ),
        LocalThreat(
            id = 3, type = "phone", value = "+5491140028899",
            riskLevel = "high", category = "Falso Organismo Público (ANSES / PAMI)",
            version = 4, isDeleted = false
        ),
        LocalThreat(
            id = 4, type = "phone", value = "+5492615551234",
            riskLevel = "medium", category = "Tienda Online / Préstamo Falso",
            version = 5, isDeleted = false
        ),
        // ── Dominios de phishing ───────────────────────────────────────────────
        LocalThreat(
            id = 5, type = "domain", value = "anses-beneficios-gob-ar.site",
            riskLevel = "high", category = "Falso Organismo Público (ANSES / PAMI)",
            version = 6, isDeleted = false
        ),
        LocalThreat(
            id = 6, type = "domain", value = "bcra-validacion-cuenta.com",
            riskLevel = "high", category = "Suplantación Bancaria / Fintech",
            version = 7, isDeleted = false
        ),
        LocalThreat(
            id = 7, type = "domain", value = "mercadopago-bonificacion.net",
            riskLevel = "high", category = "Suplantación Bancaria / Fintech",
            version = 8, isDeleted = false
        ),
        LocalThreat(
            id = 8, type = "domain", value = "banco-seguro-arg.site",
            riskLevel = "high", category = "Suplantación Bancaria / Fintech",
            version = 9, isDeleted = false
        ),
        LocalThreat(
            id = 9, type = "domain", value = "premio-mercadolibre-2026.com",
            riskLevel = "high", category = "Premio Falso / Phishing",
            version = 10, isDeleted = false
        ),
        // ── Teléfonos de riesgo medio ──────────────────────────────────────────
        LocalThreat(
            id = 10, type = "phone", value = "+5491165432100",
            riskLevel = "medium", category = "Falso Soporte Técnico",
            version = 11, isDeleted = false
        ),
        LocalThreat(
            id = 11, type = "domain", value = "soporte-mercadopago-arg.online",
            riskLevel = "high", category = "Suplantación Bancaria / Fintech",
            version = 12, isDeleted = false
        ),
        LocalThreat(
            id = 12, type = "phone", value = "+5491100000000",
            riskLevel = "high", category = "Número Oculto Reportado / Spoofing",
            version = 12, isDeleted = false
        )
    )

    /**
     * Carga el seed en la base Room solo si la base está vacía.
     * Se llama desde EscudoApp.onCreate() antes de lanzar el sync.
     */
    suspend fun loadIfEmpty(db: EscudoDatabase) {
        val syncStateDao = db.syncStateDao()
        val threatDao = db.threatDao()

        val existingState = syncStateDao.getSyncState()
        if (existingState != null && existingState.localVersion > 0) {
            // Ya tiene datos — no pisar con el seed
            return
        }

        // Base vacía: cargar seed para protección inmediata offline
        threatDao.upsertAll(threats)
        syncStateDao.upsertSyncState(
            SyncState(
                id = 1,
                localVersion = SEED_VERSION,
                lastSyncTimestamp = System.currentTimeMillis()
            )
        )
    }
}
