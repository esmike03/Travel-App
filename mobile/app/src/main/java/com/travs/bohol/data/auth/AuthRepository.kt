package com.travs.bohol.data.auth

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.travs.bohol.data.remote.AuthApi
import com.travs.bohol.data.remote.LoginRequest
import com.travs.bohol.data.remote.RegisterRequest
import retrofit2.HttpException
import java.io.IOException

class AuthRepository(
    private val api: AuthApi,
    private val session: SessionManager,
    private val moshi: Moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
) {

    suspend fun register(
        username: String,
        email: String,
        password: String,
        confirmPassword: String
    ): AuthResult = runCatching {
        val response = api.register(
            RegisterRequest(
                name = username,
                email = email,
                password = password,
                password_confirmation = confirmPassword
            )
        )
        session.save(
            Session(
                token = response.token,
                userId = response.user.id,
                name = response.user.name,
                email = response.user.email
            )
        )
        AuthResult.Success
    }.getOrElse { it.toAuthResult() }

    suspend fun login(email: String, password: String): AuthResult = runCatching {
        val response = api.login(LoginRequest(email = email, password = password))
        session.save(
            Session(
                token = response.token,
                userId = response.user.id,
                name = response.user.name,
                email = response.user.email
            )
        )
        AuthResult.Success
    }.getOrElse { it.toAuthResult() }

    suspend fun logout() {
        runCatching { api.logout() }
        session.clear()
    }

    private fun Throwable.toAuthResult(): AuthResult = when (this) {
        is HttpException -> AuthResult.Failure(parseError(this))
        is IOException -> AuthResult.Failure("Cannot reach server. Check your connection.")
        else -> AuthResult.Failure(message ?: "Something went wrong.")
    }

    private fun parseError(exception: HttpException): String {
        val body = exception.response()?.errorBody()?.string().orEmpty()
        if (body.isBlank()) return "Request failed (${exception.code()})."
        return runCatching {
            val adapter: JsonAdapter<ErrorBody> = moshi.adapter(ErrorBody::class.java)
            val parsed = adapter.fromJson(body)
            val firstFieldError = parsed?.errors?.values?.firstOrNull()?.firstOrNull()
            firstFieldError ?: parsed?.message ?: "Request failed (${exception.code()})."
        }.getOrElse { "Request failed (${exception.code()})." }
    }
}

sealed interface AuthResult {
    data object Success : AuthResult
    data class Failure(val message: String) : AuthResult
}

private data class ErrorBody(
    val message: String?,
    val errors: Map<String, List<String>>?
)
