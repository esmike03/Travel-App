package com.travs.bohol

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.core.content.getSystemService
import com.travs.bohol.data.auth.AuthRepository
import com.travs.bohol.data.auth.SessionManager
import com.travs.bohol.data.local.TravsDatabase
import com.travs.bohol.data.preferences.ThemePreference
import com.travs.bohol.data.remote.AppApi
import com.travs.bohol.data.remote.AuthApi
import com.travs.bohol.data.remote.NetworkModule
import com.travs.bohol.update.UpdateChecker
import org.osmdroid.config.Configuration

class TravsApplication : Application() {
    val database: TravsDatabase by lazy { TravsDatabase.create(this) }
    val sessionManager: SessionManager by lazy { SessionManager(this) }
    val themePreference: ThemePreference by lazy { ThemePreference(this) }
    private val retrofit by lazy { NetworkModule.retrofit(sessionManager) }
    private val authApi: AuthApi by lazy { retrofit.create(AuthApi::class.java) }
    private val appApi: AppApi by lazy { retrofit.create(AppApi::class.java) }
    val authRepository: AuthRepository by lazy { AuthRepository(authApi, sessionManager) }
    val updateChecker: UpdateChecker by lazy { UpdateChecker(appApi) }

    override fun onCreate() {
        super.onCreate()
        Configuration.getInstance().userAgentValue = BuildConfig.APPLICATION_ID
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = getSystemService<NotificationManager>() ?: return
        val channel = NotificationChannel(
            CHANNEL_DESTINATION_ALERTS,
            "Destination alerts",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Notifications for travel reminders and nearby destination alerts."
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_DESTINATION_ALERTS = "destination_alerts"
    }
}
