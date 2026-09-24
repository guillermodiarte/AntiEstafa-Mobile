package com.escudodigital.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "trusted_numbers")
data class TrustedNumber(
    @PrimaryKey val normalizedNumber: String,
    val addedAt: Long = System.currentTimeMillis()
)
