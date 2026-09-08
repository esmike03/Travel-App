package com.travs.bohol.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Route
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.travs.bohol.BuildConfig
import com.travs.bohol.TravsApplication
import com.travs.bohol.data.remote.LatestVersionResponse
import com.travs.bohol.ui.auth.AuthViewModel
import com.travs.bohol.ui.auth.LoginScreen
import com.travs.bohol.ui.auth.RegisterScreen
import com.travs.bohol.ui.screens.DestinationDetailScreen
import com.travs.bohol.ui.screens.DiscoverScreen
import com.travs.bohol.ui.screens.FavoritesScreen
import com.travs.bohol.ui.screens.ItineraryScreen
import com.travs.bohol.ui.screens.MapScreen
import com.travs.bohol.ui.screens.ProfileScreen
import com.travs.bohol.update.UpdateDialog

@Composable
fun TravsApp() {
    val context = LocalContext.current
    val app = context.applicationContext as TravsApplication
    val authViewModel: AuthViewModel = viewModel(
        factory = AuthViewModel.Factory(app.authRepository, app.sessionManager)
    )

    val session by authViewModel.session.collectAsState()

    var updateInfo by remember { mutableStateOf<LatestVersionResponse?>(null) }
    var dismissedForSession by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        updateInfo = app.updateChecker.checkForUpdate(BuildConfig.VERSION_CODE)
    }

    if (session == null) {
        AuthNav(authViewModel)
    } else {
        MainNav(authViewModel)
    }

    updateInfo?.takeIf { !dismissedForSession }?.let { info ->
        UpdateDialog(
            info = info,
            currentVersionName = BuildConfig.VERSION_NAME,
            onDismiss = { dismissedForSession = true },
            onUpdate = {
                val url = info.downloadUrl.ifBlank { return@UpdateDialog }
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                dismissedForSession = true
            }
        )
    }
}

@Composable
private fun AuthNav(authViewModel: AuthViewModel) {
    val navController = rememberNavController()
    val formState by authViewModel.formState.collectAsState()

    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                formState = formState,
                onLogin = { email, password -> authViewModel.login(email, password) },
                onNavigateToRegister = { navController.navigate("register") },
                onFieldChanged = { authViewModel.clearError() }
            )
        }
        composable("register") {
            RegisterScreen(
                formState = formState,
                onRegister = { username, email, password, confirm ->
                    authViewModel.register(username, email, password, confirm)
                },
                onNavigateToLogin = { navController.popBackStack() },
                onFieldChanged = { authViewModel.clearError() }
            )
        }
    }
}

@Composable
private fun MainNav(authViewModel: AuthViewModel) {
    val context = LocalContext.current
    val app = context.applicationContext as TravsApplication
    val navController = rememberNavController()
    val session by authViewModel.session.collectAsState()
    val themeMode by app.themePreference.mode.collectAsState()

    val items = listOf(
        BottomRoute.Discover,
        BottomRoute.Map,
        BottomRoute.Itinerary,
        BottomRoute.Favorites,
        BottomRoute.Profile
    )

    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showBottomBar = items.any { it.route == currentRoute }

    Scaffold(
        bottomBar = { if (showBottomBar) BottomBar(navController, items) }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = BottomRoute.Discover.route,
            modifier = Modifier.padding(padding),
            enterTransition = { slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Left) },
            exitTransition = { slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Left) },
            popEnterTransition = { slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Right) },
            popExitTransition = { slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Right) }
        ) {
            composable(BottomRoute.Discover.route) {
                DiscoverScreen(onDestinationClick = { navController.navigate("destinations/$it") })
            }
            composable(BottomRoute.Map.route) {
                MapScreen(onDestinationClick = { navController.navigate("destinations/$it") })
            }
            composable(BottomRoute.Itinerary.route) { ItineraryScreen() }
            composable(BottomRoute.Favorites.route) {
                FavoritesScreen(onDestinationClick = { navController.navigate("destinations/$it") })
            }
            composable(BottomRoute.Profile.route) {
                ProfileScreen(
                    displayName = session?.name,
                    email = session?.email,
                    themeMode = themeMode,
                    onThemeModeChange = { app.themePreference.set(it) },
                    onSignOut = { authViewModel.logout() }
                )
            }
            composable(
                route = "destinations/{destinationId}",
                arguments = listOf(navArgument("destinationId") { type = NavType.LongType })
            ) { entry ->
                DestinationDetailScreen(
                    destinationId = entry.arguments?.getLong("destinationId") ?: 1L,
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}

@Composable
private fun BottomBar(navController: NavHostController, items: List<BottomRoute>) {
    val backStack by navController.currentBackStackEntryAsState()
    val currentDestination = backStack?.destination

    NavigationBar(tonalElevation = 2.dp) {
        items.forEach { route ->
            val selected = currentDestination?.hierarchy?.any { it.route == route.route } == true
            NavigationBarItem(
                selected = selected,
                onClick = {
                    navController.navigate(route.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = {
                    Icon(
                        route.icon,
                        contentDescription = route.label,
                        modifier = Modifier.size(22.dp)
                    )
                },
                label = {
                    Text(
                        route.label,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1
                    )
                },
                alwaysShowLabel = true
            )
        }
    }
}

private sealed class BottomRoute(
    val route: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    data object Discover : BottomRoute("discover", "Explore", Icons.Default.Explore)
    data object Map : BottomRoute("map", "Map", Icons.Default.Map)
    data object Itinerary : BottomRoute("itinerary", "Trips", Icons.Default.Route)
    data object Favorites : BottomRoute("favorites", "Saved", Icons.Default.Bookmark)
    data object Profile : BottomRoute("profile", "Me", Icons.Default.Person)
}
