package com.travs.bohol.data.remote

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("api/v1/auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("api/v1/auth/logout")
    suspend fun logout(): LogoutResponse

    @GET("api/v1/auth/me")
    suspend fun me(): RemoteUser
}

data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val password_confirmation: String
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class AuthResponse(
    val token: String,
    val user: RemoteUser
)

data class RemoteUser(
    val id: Long,
    val name: String,
    val email: String
)

data class LogoutResponse(val message: String)
