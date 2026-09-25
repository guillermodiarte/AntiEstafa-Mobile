package com.escudodigital

import android.app.Application
import androidx.work.*
import com.escudodigital.core.AlertManager
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.data.local.SeedThreats
import com.escudodigital.sync.SyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * Application class para inicialización global.
 * 1. Crea canales de alerta
 * 2. Carga datos semilla en la base Room (protección inmediata offline)
 * 3. Lanza sync inmediato con el backend
 * 4. Programa sync periódico cada 6 horas
 */
class EscudoApp : Application() {

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        AlertManager.createNotificationChannel(this)

        // 1. Cargar datos semilla en la base Room si está vacía
        //    → protección offline inmediata aunque el sync aún no completó
        appScope.launch {
            val db = EscudoDatabase.getInstance(applicationContext)
            SeedThreats.loadIfEmpty(db)
        }

        // 2. Sync inmediato al arrancar la app (descarga novedades del backend)
        triggerImmediateSync()

        // 3. Sync periódico automático cada 6 horas en segundo plano
        schedulePeriodicalSync()
    }

    /**
     * Sync único inmediato al arrancar: descarga amenazas del backend.
     * Funciona con red disponible; si no hay internet se ignora y la base local
     * continúa funcionando offline (Sección 20 de AGENTS.md).
     */
    private fun triggerImmediateSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val oneTimeSync = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .addTag(SyncWorker.TAG_IMMEDIATE)
            .build()

        // REPLACE: si ya había uno pendiente se reemplaza para no acumular colas
        WorkManager.getInstance(this).enqueueUniqueWork(
            SyncWorker.WORK_NAME_IMMEDIATE,
            ExistingWorkPolicy.REPLACE,
            oneTimeSync
        )
    }

    /**
     * Programa sincronización periódica cada 6 horas con WorkManager.
     * Se ejecuta únicamente con conexión a Internet disponible.
     * Sección 21 de AGENTS.md: Sincronización al recuperar Internet.
     */
    private fun schedulePeriodicalSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .build()

        // UPDATE: actualiza la configuración si ya existe en lugar de ignorarla
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            SyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            syncRequest
        )
    }
}
