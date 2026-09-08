package com.travs.bohol.data.repository

import com.travs.bohol.data.local.DestinationDao
import com.travs.bohol.data.local.DestinationEntity
import kotlinx.coroutines.flow.Flow

class DestinationRepository(
    private val destinationDao: DestinationDao
) {
    fun observeDestinations(query: String): Flow<List<DestinationEntity>> =
        if (query.isBlank()) {
            destinationDao.observeDestinations()
        } else {
            destinationDao.searchDestinations(query.trim())
        }

    fun observeDestination(id: Long): Flow<DestinationEntity?> =
        destinationDao.observeDestination(id)

    fun observeFavorites(): Flow<List<DestinationEntity>> =
        destinationDao.observeFavorites()

    suspend fun toggleFavorite(destination: DestinationEntity) {
        destinationDao.update(destination.copy(isFavorite = !destination.isFavorite))
    }
}
