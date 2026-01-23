package art.serika.app.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import art.serika.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBackClick: () -> Unit,
    onLoginClick: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            // Account section
            if (uiState.isLoggedIn) {
                SettingsSection(title = "Account") {
                    ListItem(
                        headlineContent = { Text(uiState.username ?: "User") },
                        supportingContent = { Text("Logged in") },
                        leadingContent = {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                            ) {
                                if (uiState.avatarUrl != null) {
                                    AsyncImage(
                                        model = ImageRequest.Builder(LocalContext.current)
                                            .data(uiState.avatarUrl)
                                            .crossfade(true)
                                            .build(),
                                        contentDescription = "Avatar",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Person,
                                        contentDescription = null,
                                        modifier = Modifier
                                            .size(24.dp)
                                            .align(Alignment.Center)
                                    )
                                }
                            }
                        }
                    )
                    
                    ListItem(
                        headlineContent = { Text("Log out") },
                        leadingContent = {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Logout,
                                contentDescription = null
                            )
                        },
                        modifier = Modifier.clickable { viewModel.logout() }
                    )
                }
            } else {
                SettingsSection(title = "Account") {
                    ListItem(
                        headlineContent = { Text("Log in") },
                        supportingContent = { Text("Sign in to access all features") },
                        leadingContent = {
                            Icon(
                                imageVector = Icons.Default.Login,
                                contentDescription = null
                            )
                        },
                        modifier = Modifier.clickable { onLoginClick() }
                    )
                }
            }
            
            // Content preferences
            SettingsSection(title = "Content Preferences") {
                // Rating filters
                ListItem(
                    headlineContent = { Text("Safe content") },
                    supportingContent = { Text("Show safe-rated content") },
                    trailingContent = {
                        Switch(
                            checked = uiState.showSafe,
                            onCheckedChange = {
                                viewModel.setRatingPreferences(
                                    safe = it,
                                    questionable = uiState.showQuestionable,
                                    explicit = uiState.showExplicit
                                )
                            }
                        )
                    }
                )
                
                ListItem(
                    headlineContent = { Text("Questionable content") },
                    supportingContent = { Text("Show questionable-rated content") },
                    trailingContent = {
                        Switch(
                            checked = uiState.showQuestionable,
                            onCheckedChange = {
                                viewModel.setRatingPreferences(
                                    safe = uiState.showSafe,
                                    questionable = it,
                                    explicit = uiState.showExplicit
                                )
                            }
                        )
                    }
                )
                
                ListItem(
                    headlineContent = { Text("Explicit content") },
                    supportingContent = { Text("Show explicit-rated content (18+)") },
                    trailingContent = {
                        Switch(
                            checked = uiState.showExplicit,
                            onCheckedChange = {
                                viewModel.setRatingPreferences(
                                    safe = uiState.showSafe,
                                    questionable = uiState.showQuestionable,
                                    explicit = it
                                )
                            }
                        )
                    }
                )
                
                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                
                ListItem(
                    headlineContent = { Text("Hide AI-generated") },
                    supportingContent = { Text("Hide AI-generated images from feed") },
                    trailingContent = {
                        Switch(
                            checked = uiState.hideAI,
                            onCheckedChange = { viewModel.setHideAI(it) }
                        )
                    }
                )
            }
            
            // Display preferences
            SettingsSection(title = "Display") {
                var showThemeDialog by remember { mutableStateOf(false) }
                
                ListItem(
                    headlineContent = { Text("Theme") },
                    supportingContent = { 
                        Text(
                            when (uiState.themeMode) {
                                "light" -> "Light"
                                "dark" -> "Dark"
                                else -> "System default"
                            }
                        )
                    },
                    leadingContent = {
                        Icon(
                            imageVector = when (uiState.themeMode) {
                                "light" -> Icons.Default.LightMode
                                "dark" -> Icons.Default.DarkMode
                                else -> Icons.Default.Brightness6
                            },
                            contentDescription = null
                        )
                    },
                    modifier = Modifier.clickable { showThemeDialog = true }
                )
                
                if (showThemeDialog) {
                    AlertDialog(
                        onDismissRequest = { showThemeDialog = false },
                        title = { Text("Choose theme") },
                        text = {
                            Column {
                                listOf("system" to "System default", "light" to "Light", "dark" to "Dark").forEach { (value, label) ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                viewModel.setThemeMode(value)
                                                showThemeDialog = false
                                            }
                                            .padding(vertical = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        RadioButton(
                                            selected = uiState.themeMode == value,
                                            onClick = {
                                                viewModel.setThemeMode(value)
                                                showThemeDialog = false
                                            }
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(label)
                                    }
                                }
                            }
                        },
                        confirmButton = {}
                    )
                }
            }
            
            // About section
            SettingsSection(title = "About") {
                ListItem(
                    headlineContent = { Text("Version") },
                    supportingContent = { Text("0.0.1") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null
                        )
                    }
                )
                
                ListItem(
                    headlineContent = { Text("Website") },
                    supportingContent = { Text("serika.art") },
                    leadingContent = {
                        Icon(
                            imageVector = Icons.Default.Language,
                            contentDescription = null
                        )
                    },
                    modifier = Modifier.clickable { /* Open website */ }
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SettingsSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Column {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )
        content()
        Spacer(modifier = Modifier.height(8.dp))
    }
}
