package com.travs.bohol.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.googlefonts.Font
import androidx.compose.ui.text.googlefonts.GoogleFont
import com.travs.bohol.R

private val fontProvider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs
)

private val Manrope = FontFamily(
    Font(
        googleFont = GoogleFont("Manrope"),
        fontProvider = fontProvider
    )
)

private val BaseTypography = Typography()

private fun TextStyle.withManrope(): TextStyle = copy(fontFamily = Manrope)

val TravsTypography = Typography(
    displayLarge = BaseTypography.displayLarge.withManrope(),
    displayMedium = BaseTypography.displayMedium.withManrope(),
    displaySmall = BaseTypography.displaySmall.withManrope(),
    headlineLarge = BaseTypography.headlineLarge.withManrope(),
    headlineMedium = BaseTypography.headlineMedium.withManrope(),
    headlineSmall = BaseTypography.headlineSmall.withManrope(),
    titleLarge = BaseTypography.titleLarge.withManrope(),
    titleMedium = BaseTypography.titleMedium.withManrope(),
    titleSmall = BaseTypography.titleSmall.withManrope(),
    bodyLarge = BaseTypography.bodyLarge.withManrope(),
    bodyMedium = BaseTypography.bodyMedium.withManrope(),
    bodySmall = BaseTypography.bodySmall.withManrope(),
    labelLarge = BaseTypography.labelLarge.withManrope(),
    labelMedium = BaseTypography.labelMedium.withManrope(),
    labelSmall = BaseTypography.labelSmall.withManrope()
)
