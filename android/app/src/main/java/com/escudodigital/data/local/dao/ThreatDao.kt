package com.escudodigital.data.local.dao

import androidx.room.*
import com.escudodigital.data.local.entity.LocalThreat

@Dao
interface ThreatDao {

    @Query("SELECT * FROM threats WHERE isDeleted = 0")
    suspend fun getAllActiveThreats(): List<LocalThreat>

    /**
     * Búsqueda por número de teléfono con sufijo flexible para cubrir
     * variaciones del prefijo internacional (+54, 54, 011, etc.)
     */
    @Query("""
        SELECT * FROM threats
        WHERE type = 'phone'
          AND isDeleted = 0
          AND (:number LIKE '%' || SUBSTR(value, -8) OR value = :number)
        LIMIT 1
    """)
    suspend fun findPhoneThreat(number: String): LocalThreat?

    /**
     * Búsqueda de dominio exacto o como subdominio / URL.
     */
    @Query("""
        SELECT * FROM threats
        WHERE type IN ('domain', 'url')
          AND isDeleted = 0
          AND (
            value = :domain 
            OR :domain LIKE '%' || value 
            OR value LIKE '%' || :domain || '%'
            OR :domain LIKE '%.' || REPLACE(REPLACE(REPLACE(value, 'https://', ''), 'http://', ''), 'www.', '')
            OR REPLACE(REPLACE(REPLACE(value, 'https://', ''), 'http://', ''), 'www.', '') = :domain
          )
        LIMIT 1
    """)
    suspend fun findDomainThreat(domain: String): LocalThreat?

    @Query("SELECT * FROM threats WHERE version > :sinceVersion ORDER BY version ASC")
    suspend fun getThreatsAfterVersion(sinceVersion: Int): List<LocalThreat>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertThreat(threat: LocalThreat)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(threats: List<LocalThreat>)

    @Query("SELECT MAX(version) FROM threats")
    suspend fun getMaxVersion(): Int?
}
