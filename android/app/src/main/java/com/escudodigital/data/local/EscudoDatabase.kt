package com.escudodigital.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.escudodigital.data.local.dao.SyncStateDao
import com.escudodigital.data.local.dao.ThreatDao
import com.escudodigital.data.local.dao.TrustedNumberDao
import com.escudodigital.data.local.entity.LocalThreat
import com.escudodigital.data.local.entity.SyncState
import com.escudodigital.data.local.entity.TrustedNumber

/**
 * Base de datos local Room para funcionamiento offline.
 * Sección 20 de AGENTS.md: Base local y funcionamiento offline.
 *
 * Contiene:
 * - threats: copia local de amenazas validadas del backend
 * - trusted_numbers: lista blanca de confianza del usuario
 * - sync_state: seguimiento de versión incremental
 */
@Database(
    entities = [LocalThreat::class, TrustedNumber::class, SyncState::class],
    version = 1,
    exportSchema = false
)
abstract class EscudoDatabase : RoomDatabase() {

    abstract fun threatDao(): ThreatDao
    abstract fun trustedNumberDao(): TrustedNumberDao
    abstract fun syncStateDao(): SyncStateDao

    companion object {
        @Volatile
        private var INSTANCE: EscudoDatabase? = null

        fun getInstance(context: Context): EscudoDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    EscudoDatabase::class.java,
                    "escudo_digital.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
