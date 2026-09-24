package com.escudodigital.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Almacena el estado de sincronización incremental con el backend.
 * Se usa para solicitar únicamente los cambios desde la última versión conocida.
 * Sección 21 de AGENTS.md: sincronización incremental.
 */
@Entity(tableName = "sync_state")
data class SyncState(
    @PrimaryKey val id: Int = 1,
    val localVersion: Int = 0,
    val lastSyncTimestamp: Long = 0L
)
