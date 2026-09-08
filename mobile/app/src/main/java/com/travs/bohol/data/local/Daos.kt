package com.travs.bohol.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface DestinationDao {
    @Query("SELECT * FROM destinations ORDER BY name")
    fun observeDestinations(): Flow<List<DestinationEntity>>

    @Query(
        """
        SELECT * FROM destinations
        WHERE name LIKE '%' || :query || '%'
           OR description LIKE '%' || :query || '%'
           OR address LIKE '%' || :query || '%'
        ORDER BY name
        """
    )
    fun searchDestinations(query: String): Flow<List<DestinationEntity>>

    @Query("SELECT * FROM destinations WHERE id = :id")
    fun observeDestination(id: Long): Flow<DestinationEntity?>

    @Query("SELECT * FROM destinations WHERE isFavorite = 1 ORDER BY name")
    fun observeFavorites(): Flow<List<DestinationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(destinations: List<DestinationEntity>)

    @Update
    suspend fun update(destination: DestinationEntity)
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY name")
    fun observeCategories(): Flow<List<CategoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(categories: List<CategoryEntity>)
}

@Dao
interface DestinationImageDao {
    @Query("SELECT * FROM destination_images WHERE destinationId = :destinationId ORDER BY position")
    fun observeImages(destinationId: Long): Flow<List<DestinationImageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(images: List<DestinationImageEntity>)
}

@Dao
interface ItineraryDao {
    @Query("SELECT * FROM itinerary_items ORDER BY plannedDate, plannedTime")
    fun observeItems(): Flow<List<ItineraryItemEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: ItineraryItemEntity)
}

@Dao
interface PendingSyncDao {
    @Query("SELECT * FROM pending_sync ORDER BY createdAt LIMIT :limit")
    suspend fun next(limit: Int = 50): List<PendingSyncEntity>

    @Insert
    suspend fun enqueue(entity: PendingSyncEntity)

    @Query("DELETE FROM pending_sync WHERE id IN (:ids)")
    suspend fun delete(ids: List<Long>)
}
