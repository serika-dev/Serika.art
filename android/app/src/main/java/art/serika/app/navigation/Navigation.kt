package art.serika.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import art.serika.app.ui.screens.home.HomeScreen
import art.serika.app.ui.screens.image.ImageDetailScreen
import art.serika.app.ui.screens.search.SearchScreen
import art.serika.app.ui.screens.artist.ArtistScreen
import art.serika.app.ui.screens.profile.ProfileScreen
import art.serika.app.ui.screens.settings.SettingsScreen
import art.serika.app.ui.screens.favorites.FavoritesScreen
import art.serika.app.ui.screens.tags.TagsScreen
import art.serika.app.ui.screens.login.LoginScreen
import art.serika.app.ui.screens.downloads.DownloadsScreen

sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object Login : Screen("login")
    data object Search : Screen("search?query={query}") {
        fun createRoute(query: String = "") = "search?query=$query"
    }
    data object ImageDetail : Screen("image/{imageId}") {
        fun createRoute(imageId: String) = "image/$imageId"
    }
    data object Artist : Screen("artist/{tagName}") {
        fun createRoute(tagName: String) = "artist/$tagName"
    }
    data object Profile : Screen("profile/{username}") {
        fun createRoute(username: String) = "profile/$username"
    }
    data object Settings : Screen("settings")
    data object Favorites : Screen("favorites")
    data object Downloads : Screen("downloads")
    data object Tags : Screen("tags?type={type}") {
        fun createRoute(type: String? = null) = "tags?type=${type ?: ""}"
    }
}

@Composable
fun SerikaNavHost(
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                onImageClick = { imageId ->
                    navController.navigate(Screen.ImageDetail.createRoute(imageId))
                },
                onSearchClick = {
                    navController.navigate(Screen.Search.createRoute())
                },
                onSettingsClick = {
                    navController.navigate(Screen.Settings.route)
                },
                onFavoritesClick = {
                    navController.navigate(Screen.Favorites.route)
                },
                onTagsClick = {
                    navController.navigate(Screen.Tags.createRoute())
                },
                onDownloadsClick = {
                    navController.navigate(Screen.Downloads.route)
                }
            )
        }
        
        composable(
            route = Screen.Search.route,
            arguments = listOf(
                navArgument("query") { 
                    type = NavType.StringType
                    defaultValue = ""
                }
            )
        ) { backStackEntry ->
            val query = backStackEntry.arguments?.getString("query") ?: ""
            SearchScreen(
                initialQuery = query,
                onImageClick = { imageId ->
                    navController.navigate(Screen.ImageDetail.createRoute(imageId))
                },
                onArtistClick = { tagName ->
                    navController.navigate(Screen.Artist.createRoute(tagName))
                },
                onTagClick = { tagName ->
                    navController.navigate(Screen.Search.createRoute(tagName))
                },
                onBackClick = { navController.popBackStack() }
            )
        }
        
        composable(
            route = Screen.ImageDetail.route,
            arguments = listOf(
                navArgument("imageId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val imageId = backStackEntry.arguments?.getString("imageId") ?: return@composable
            // Use imageId as key to force ViewModel recreation for different images
            androidx.compose.runtime.key(imageId) {
                ImageDetailScreen(
                    imageId = imageId,
                    onBackClick = { navController.popBackStack() },
                    onTagClick = { tagName ->
                        navController.navigate(Screen.Search.createRoute(tagName))
                    },
                    onArtistClick = { tagName ->
                        navController.navigate(Screen.Artist.createRoute(tagName))
                    },
                    onUserClick = { username ->
                        navController.navigate(Screen.Profile.createRoute(username))
                    }
                )
            }
        }
        
        composable(
            route = Screen.Artist.route,
            arguments = listOf(
                navArgument("tagName") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val tagName = backStackEntry.arguments?.getString("tagName") ?: return@composable
            ArtistScreen(
                tagName = tagName,
                onBackClick = { navController.popBackStack() },
                onImageClick = { imageId ->
                    navController.navigate(Screen.ImageDetail.createRoute(imageId))
                }
            )
        }
        
        composable(
            route = Screen.Profile.route,
            arguments = listOf(
                navArgument("username") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val username = backStackEntry.arguments?.getString("username") ?: return@composable
            ProfileScreen(
                username = username,
                onBackClick = { navController.popBackStack() },
                onImageClick = { imageId ->
                    navController.navigate(Screen.ImageDetail.createRoute(imageId))
                }
            )
        }
        
        composable(Screen.Settings.route) {
            SettingsScreen(
                onBackClick = { navController.popBackStack() },
                onLoginClick = {
                    navController.navigate(Screen.Login.route)
                }
            )
        }
        
        composable(Screen.Login.route) {
            LoginScreen(
                onBackClick = { navController.popBackStack() },
                onLoginSuccess = { navController.popBackStack() }
            )
        }
        
        composable(Screen.Favorites.route) {
            FavoritesScreen(
                onBackClick = { navController.popBackStack() },
                onImageClick = { imageId ->
                    navController.navigate(Screen.ImageDetail.createRoute(imageId))
                },
                onLoginClick = {
                    navController.navigate(Screen.Login.route)
                }
            )
        }
        
        composable(Screen.Downloads.route) {
            DownloadsScreen(
                onBackClick = { navController.popBackStack() }
            )
        }
        
        composable(
            route = Screen.Tags.route,
            arguments = listOf(
                navArgument("type") {
                    type = NavType.StringType
                    defaultValue = ""
                    nullable = true
                }
            )
        ) { backStackEntry ->
            val type = backStackEntry.arguments?.getString("type")?.takeIf { it.isNotEmpty() }
            TagsScreen(
                filterType = type,
                onBackClick = { navController.popBackStack() },
                onTagClick = { tagName ->
                    navController.navigate(Screen.Search.createRoute(tagName))
                }
            )
        }
    }
}
