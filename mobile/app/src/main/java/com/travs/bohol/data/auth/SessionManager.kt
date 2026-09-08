package com.travs.bohol.data.auth

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class SessionManager(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _session = MutableStateFlow(readFromPrefs())
    val session: StateFlow<Session?> = _session

    fun token(): String? = _session.value?.token

    fun save(session: Session) {
        prefs.edit()
            .putString(KEY_TOKEN, session.token)
            .putLong(KEY_USER_ID, session.userId)
            .putString(KEY_NAME, session.name)
            .putString(KEY_EMAIL, session.email)
            .apply()
        _session.value = session
    }

    fun clear() {
        prefs.edit().clear().apply()
        _session.value = null
    }

    private fun readFromPrefs(): Session? {
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val userId = prefs.getLong(KEY_USER_ID, -1L)
        val name = prefs.getString(KEY_NAME, null) ?: return null
        val email = prefs.getString(KEY_EMAIL, null) ?: return null
        if (userId < 0) return null
        return Session(token, userId, name, email)
    }

    companion object {
        private const val PREFS_NAME = "travs_session"
        private const val KEY_TOKEN = "token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_NAME = "name"
        private const val KEY_EMAIL = "email"
    }
}

data class Session(
    val token: String,
    val userId: Long,
    val name: String,
    val email: String
)
