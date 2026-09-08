package com.travs.bohol.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.travs.bohol.data.auth.AuthRepository
import com.travs.bohol.data.auth.AuthResult
import com.travs.bohol.data.auth.Session
import com.travs.bohol.data.auth.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val repository: AuthRepository,
    private val sessionManager: SessionManager
) : ViewModel() {

    val session: StateFlow<Session?> = sessionManager.session

    private val _formState = MutableStateFlow(AuthFormState())
    val formState: StateFlow<AuthFormState> = _formState.asStateFlow()

    fun clearError() {
        if (_formState.value.error != null) {
            _formState.value = _formState.value.copy(error = null)
        }
    }

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _formState.value = _formState.value.copy(error = "Enter your email and password.")
            return
        }
        _formState.value = _formState.value.copy(loading = true, error = null)
        viewModelScope.launch {
            when (val result = repository.login(email.trim(), password)) {
                AuthResult.Success -> _formState.value = AuthFormState()
                is AuthResult.Failure -> _formState.value =
                    AuthFormState(loading = false, error = result.message)
            }
        }
    }

    fun register(username: String, email: String, password: String, confirmPassword: String) {
        val validation = validateRegister(username, email, password, confirmPassword)
        if (validation != null) {
            _formState.value = _formState.value.copy(error = validation)
            return
        }
        _formState.value = _formState.value.copy(loading = true, error = null)
        viewModelScope.launch {
            when (val result = repository.register(username.trim(), email.trim(), password, confirmPassword)) {
                AuthResult.Success -> _formState.value = AuthFormState()
                is AuthResult.Failure -> _formState.value =
                    AuthFormState(loading = false, error = result.message)
            }
        }
    }

    fun logout() {
        viewModelScope.launch { repository.logout() }
    }

    private fun validateRegister(
        username: String,
        email: String,
        password: String,
        confirmPassword: String
    ): String? = when {
        username.isBlank() -> "Enter a username."
        email.isBlank() -> "Enter an email address."
        password.length < 8 -> "Password must be at least 8 characters."
        password != confirmPassword -> "Passwords do not match."
        else -> null
    }

    class Factory(
        private val repository: AuthRepository,
        private val sessionManager: SessionManager
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(AuthViewModel::class.java))
            return AuthViewModel(repository, sessionManager) as T
        }
    }
}

data class AuthFormState(
    val loading: Boolean = false,
    val error: String? = null
)
