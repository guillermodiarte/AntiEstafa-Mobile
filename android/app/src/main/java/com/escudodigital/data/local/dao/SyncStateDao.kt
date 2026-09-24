package com.escudodigital.data.local.dao

import androidx.room.*
import com.escudodigital.data.local.entity.SyncState

@Dao
interface SyncStateDao {

    @Query("SELECT * FROM sync_state WHERE id = 1 LIMIT 1")
    suspend fun getSyncState(): SyncState?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSyncState(state: SyncState)
}
