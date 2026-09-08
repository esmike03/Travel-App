package com.travs.bohol.data.remote

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface TravsApi {
    @GET("api/v1/sync/pull")
    suspend fun pull(@Query("cursor") cursor: String?): SyncPullResponse

    @POST("api/v1/sync/push")
    suspend fun push(@Body request: SyncPushRequest): SyncPushResponse
}

data class SyncPullResponse(
    val cursor: String,
    val destinations: List<RemoteDestination>,
    val categories: List<RemoteCategory>
)

data class SyncPushRequest(
    val clientMutationId: String,
    val mutations: List<PendingMutation>
)

data class SyncPushResponse(
    val acceptedIds: List<Long>,
    val rejectedIds: List<Long>
)

data class PendingMutation(
    val id: Long,
    val type: String,
    val payload: String
)

data class RemoteDestination(
    val id: Long,
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
    val amenities: List<String>,
    val averageRating: Double,
    val reviewCount: Int,
    val updatedAt: String
)

data class RemoteCategory(
    val id: Long,
    val name: String,
    val iconName: String?
)
