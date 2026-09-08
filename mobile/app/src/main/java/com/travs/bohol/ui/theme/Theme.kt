package com.travs.bohol.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColors = lightColorScheme(
    primary = TravsGreen,
    onPrimary = Color.White,
    primaryContainer = TravsGreenSoft,
    onPrimaryContainer = Color(0xFF08331D),
    secondary = TravsSky,
    onSecondary = Color.White,
    secondaryContainer = TravsSkySoft,
    onSecondaryContainer = Color(0xFF06344A),
    background = TravsMist,
    onBackground = TravsInk,
    surface = TravsSurface,
    onSurface = TravsInk,
    surfaceVariant = TravsSurfaceVariant,
    onSurfaceVariant = TravsInkSoft,
    outline = TravsOutline,
    outlineVariant = Color(0xFFD9E2DD),
    error = TravsError,
    onError = Color.White,
    errorContainer = TravsErrorContainer,
    onErrorContainer = Color(0xFF410E0B)
)

private val DarkColors = darkColorScheme(
    primary = TravsGreenBright,
    onPrimary = Color(0xFF00381F),
    primaryContainer = TravsGreenContainerDark,
    onPrimaryContainer = TravsGreenSoft,
    secondary = TravsSkyBright,
    onSecondary = Color(0xFF002738),
    secondaryContainer = TravsSkyContainerDark,
    onSecondaryContainer = TravsSkySoft,
    background = TravsInkDeep,
    onBackground = TravsInkOnSurface,
    surface = TravsInkSurface,
    onSurface = TravsInkOnSurface,
    surfaceVariant = TravsInkSurfaceVariant,
    onSurfaceVariant = TravsInkOnSurfaceVariant,
    outline = TravsInkOutline,
    outlineVariant = Color(0xFF2E3A36),
    error = TravsErrorDark,
    onError = Color(0xFF601410),
    errorContainer = TravsErrorContainerDark,
    onErrorContainer = Color(0xFFF9DEDC)
)

@Composable
fun TravsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            @Suppress("DEPRECATION")
            window.statusBarColor = Color.Transparent.toArgb()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                @Suppress("DEPRECATION")
                window.navigationBarColor = Color.Transparent.toArgb()
            }
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colors,
        typography = TravsTypography,
        content = content
    )
}
