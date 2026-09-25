package com.escudodigital.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.data.local.entity.LocalThreat
import com.escudodigital.data.local.entity.SyncState
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Worker de sincronización incremental con el backend.
 * Secciones 21 y 28 de AGENTS.md: Sincronización incremental.
 *
 * Flujo:
 *  1. Obtener la versión actual de la base local
 *  2. Consultar al backend SOLO los cambios desde esa versión
 *  3. Aplicar inserciones, actualizaciones y eliminaciones
 *  4. Actualizar la versión local
 *
 * No descarga toda la base en cada sync: solo los deltas.
 */
class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "SyncWorker"
        // URL configurable - en producción vendría de BuildConfig
        private const val BACKEND_BASE_URL = "http://10.0.2.2:8000/api/v1"
        /** Nombre del trabajo periódico (cada 6 horas) */
        const val WORK_NAME = "escudo_digital_sync"
        /** Nombre del trabajo único lanzado al arrancar la app */
        const val WORK_NAME_IMMEDIATE = "escudo_digital_sync_immediate"
        /** Tag para identificar syncs inmediatos en el WorkManager */
        const val TAG_IMMEDIATE = "sync_immediate"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val db = EscudoDatabase.getInstance(applicationContext)
        val threatDao = db.threatDao()
        val syncStateDao = db.syncStateDao()

        return try {
            val syncState = syncStateDao.getSyncState() ?: SyncState(id = 1, localVersion = 0)
            val sinceVersion = syncState.localVersion

            Log.d(TAG, "Iniciando sync incremental desde versión $sinceVersion")

            val url = "$BACKEND_BASE_URL/mobile/sync?since_version=$sinceVersion&limit=500"
            val request = Request.Builder().url(url).get().build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.w(TAG, "Sync fallida: HTTP ${response.code}")
                return Result.retry()
            }

            val body = response.body?.string() ?: return Result.success()
            val json = JSONObject(body)
            val items = json.getJSONArray("items")
            val newVersion = json.getInt("current_version")

            val threats = mutableListOf<LocalThreat>()
            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                threats.add(
                    LocalThreat(
                        id = item.getLong("id"),
                        type = item.getString("type"),
                        value = item.getString("value"),
                        riskLevel = item.getString("risk_level"),
                        category = item.optString("category").ifBlank { null },
                        version = item.getInt("version"),
                        isDeleted = item.getBoolean("is_deleted")
                    )
                )
            }

            if (threats.isNotEmpty()) {
                threatDao.upsertAll(threats)
                Log.d(TAG, "Sync completada: ${threats.size} registros actualizados. Nueva versión: $newVersion")
            } else {
                Log.d(TAG, "Sync completada: ya estamos al día en v$sinceVersion")
            }

            // Actualizar versión local
            syncStateDao.upsertSyncState(
                SyncState(id = 1, localVersion = newVersion, lastSyncTimestamp = System.currentTimeMillis())
            )

            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Sync falló (sin internet o backend inaccesible). La protección offline continúa.", e)
            // No es un error fatal - la protección local continúa funcionando
            Result.retry()
        }
    }
}
