package com.travs.bohol.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "destinations")
data class DestinationEntity(
    @PrimaryKey val id: Long,
    val name: String,
    val slug: String,
    val description: String?,
    val categoryId: Long?,
    val municipalityId: Long?,
    val address: String?,
    val latitude: Double,
    val longitude: Double,
    val entranceFee: String?,
    val openingHours: String?,
    val contact: String?,
    val bestTimeToVisit: String?,
    val amenities: String,
    val averageRating: Double,
    val reviewCount: Int,
    val updatedAt: String,
    val isFavorite: Boolean = false
)

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: Long,
    val name: String,
    val iconName: String? = null
)

@Entity(tableName = "municipalities")
data class MunicipalityEntity(
    @PrimaryKey val id: Long,
    val name: String
)

@Entity(tableName = "destination_images")
data class DestinationImageEntity(
    @PrimaryKey val id: Long,
    val destinationId: Long,
    val url: String,
    val caption: String?,
    val position: Int
)

@Entity(tableName = "itinerary_items")
data class ItineraryItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val destinationId: Long,
    val plannedDate: String,
    val plannedTime: String,
    val notes: String?,
    val syncState: SyncState = SyncState.PENDING
)

@Entity(tableName = "pending_sync")
data class PendingSyncEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val payload: String,
    val createdAt: String,
    val retryCount: Int = 0
)

enum class SyncState {
    SYNCED,
    PENDING,
    FAILED
}
