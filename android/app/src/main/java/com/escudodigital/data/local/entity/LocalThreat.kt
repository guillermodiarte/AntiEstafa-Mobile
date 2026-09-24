package com.escudodigital.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "threats")
data class LocalThreat(
    @PrimaryKey val id: Long,
    val type: String, // "phone", "domain", "url"
    val value: String, // número o dominio normalizado
    val riskLevel: String, // "low", "medium", "high"
    val category: String?,
    val version: Int,
    val isDeleted: Boolean = false
)
