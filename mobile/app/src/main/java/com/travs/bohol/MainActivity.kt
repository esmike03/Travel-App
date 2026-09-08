package com.travs.bohol

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.travs.bohol.data.preferences.ThemeMode
import com.travs.bohol.ui.navigation.TravsApp
import com.travs.bohol.ui.theme.TravsTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val themePreference = (application as TravsApplication).themePreference
        setContent {
            val mode by themePreference.mode.collectAsState()
            val darkTheme = when (mode) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
            }
            TravsTheme(darkTheme = darkTheme) {
                TravsApp()
            }
        }
    }
}
