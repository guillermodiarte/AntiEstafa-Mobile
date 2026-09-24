package com.escudodigital.data.local.dao

import androidx.room.*
import com.escudodigital.data.local.entity.TrustedNumber

@Dao
interface TrustedNumberDao {

    @Query("SELECT * FROM trusted_numbers WHERE normalizedNumber = :number LIMIT 1")
    suspend fun findTrustedNumber(number: String): TrustedNumber?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addTrustedNumber(number: TrustedNumber)

    @Query("DELETE FROM trusted_numbers WHERE normalizedNumber = :number")
    suspend fun removeTrustedNumber(number: String)

    @Query("SELECT * FROM trusted_numbers")
    suspend fun getAllTrustedNumbers(): List<TrustedNumber>
}
