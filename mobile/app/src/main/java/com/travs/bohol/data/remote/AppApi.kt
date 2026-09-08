package com.travs.bohol.data.remote

import retrofit2.http.GET

interface AppApi {
    @GET("api/v1/app/latest-version")
    suspend fun latestVersion(): LatestVersionResponse
}

data class LatestVersionResponse(
    val versionCode: Int,
    val versionName: String,
    val downloadUrl: String,
    val releaseNotes: List<String>,
    val mandatory: Boolean
)
