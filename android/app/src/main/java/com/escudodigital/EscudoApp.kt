package com.escudodigital

import android.app.Application
import androidx.work.*
import com.escudodigital.core.AlertManager
import com.escudodigital.sync.SyncWorker
import java.util.concurrent.TimeUnit

/**
 * Application class para inicialización global.
 * Registra el canal de alertas y programa la sincronización periódica.
 */
class EscudoApp : Application() {

    override fun onCreate() {
        super.onCreate()
        AlertManager.createNotificationChannel(this)
        schedulePeriodicalSync()
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

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            SyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}
