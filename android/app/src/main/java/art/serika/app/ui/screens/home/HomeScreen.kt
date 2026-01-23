package art.serika.app.ui.screens.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import art.serika.app.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onImageClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onFavoritesClick: () -> Unit,
    onTagsClick: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val images = viewModel.images.collectAsLazyPagingItems()
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    
    var showSortMenu by remember { mutableStateOf(false) }
    var showFilterSheet by remember { mutableStateOf(false) }
    
    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            TopAppBar(
                title = {
                    Text("Serika.art")
                },
                actions = {
                    IconButton(onClick = onSearchClick) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Search"
                        )
                    }
                    
                    // Filter button
                    IconButton(onClick = { showFilterSheet = true }) {
                        Badge(
                            modifier = Modifier.offset(x = 8.dp, y = (-8).dp),
                            containerColor = if (uiState.hasActiveFilters) 
                                MaterialTheme.colorScheme.primary 
                            else 
                                MaterialTheme.colorScheme.surface
                        ) {
                            if (uiState.hasActiveFilters) {
                                Text("${uiState.activeFilterCount}")
                            }
                        }
                        Icon(
                            imageVector = Icons.Default.FilterList,
                            contentDescription = "Filter"
                        )
                    }
                    
                    // Sort button
                    Box {
                        IconButton(onClick = { showSortMenu = true }) {
                            Icon(
                                imageVector = Icons.Default.Sort,
                                contentDescription = "Sort"
                            )
                        }
                        DropdownMenu(
                            expanded = showSortMenu,
                            onDismissRequest = { showSortMenu = false }
                        ) {
                            listOf(
                                "newest" to "Newest" to Icons.Default.Schedule,
                                "oldest" to "Oldest" to Icons.Default.History,
                                "top" to "Top Rated" to Icons.Default.ThumbUp,
                                "favorites" to "Most Favorites" to Icons.Default.Favorite,
                                "views" to "Most Views" to Icons.Default.Visibility,
                                "random" to "Random" to Icons.Default.Shuffle
                            ).forEach { (pair, icon) ->
                                val (value, label) = pair
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        viewModel.setSort(value)
                                        showSortMenu = false
                                    },
                                    leadingIcon = {
                                        Icon(icon, contentDescription = null)
                                    },
                                    trailingIcon = {
                                        if (uiState.sort == value) {
                                            Icon(
                                                Icons.Default.Check,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                )
                            }
                        }
                    }
                },
                scrollBehavior = scrollBehavior
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Filled.Home, contentDescription = "Home") },
                    label = { Text("Home") },
                    selected = true,
                    onClick = { }
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Outlined.Tag, contentDescription = "Tags") },
                    label = { Text("Tags") },
                    selected = false,
                    onClick = onTagsClick
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Outlined.Favorite, contentDescription = "Favorites") },
                    label = { Text("Favorites") },
                    selected = false,
                    onClick = onFavoritesClick
                )
                NavigationBarItem(
                    icon = { Icon(Icons.Outlined.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") },
                    selected = false,
                    onClick = onSettingsClick
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                images.loadState.refresh is LoadState.Loading -> {
                    LoadingIndicator()
                }
                images.loadState.refresh is LoadState.Error -> {
                    val error = (images.loadState.refresh as LoadState.Error).error
                    ErrorMessage(
                        message = error.localizedMessage ?: "Failed to load images",
                        onRetry = { images.retry() }
                    )
                }
                images.itemCount == 0 && images.loadState.refresh is LoadState.NotLoading -> {
                    EmptyState(
                        title = "No images found",
                        description = "Try adjusting your filters"
                    )
                }
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(
                            count = images.itemCount,
                            key = { index -> images[index]?.id ?: index }
                        ) { index ->
                            val image = images[index]
                            if (image != null) {
                                ImageCard(
                                    image = image,
                                    onClick = { onImageClick(image.sequentialId?.toString() ?: image.id) }
                                )
                            }
                        }
                        
                        // Loading more indicator
                        if (images.loadState.append is LoadState.Loading) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Filter Bottom Sheet
    if (showFilterSheet) {
        ModalBottomSheet(
            onDismissRequest = { showFilterSheet = false }
        ) {
            FilterSheetContent(
                uiState = uiState,
                onRatingToggle = { rating, enabled ->
                    viewModel.toggleRating(rating, enabled)
                },
                onHideAIToggle = { viewModel.setHideAI(it) },
                onAIOnlyToggle = { viewModel.setAIOnly(it) },
                onClearFilters = { viewModel.clearFilters() },
                onDismiss = { showFilterSheet = false }
            )
        }
    }
}

@Composable
private fun FilterSheetContent(
    uiState: HomeUiState,
    onRatingToggle: (String, Boolean) -> Unit,
    onHideAIToggle: (Boolean) -> Unit,
    onAIOnlyToggle: (Boolean) -> Unit,
    onClearFilters: () -> Unit,
    onDismiss: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(bottom = 32.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Filters",
                style = MaterialTheme.typography.titleLarge
            )
            TextButton(onClick = onClearFilters) {
                Text("Clear all")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Rating filters
        Text(
            text = "Content Rating",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = uiState.selectedRatings.contains("safe"),
                onClick = { 
                    onRatingToggle("safe", !uiState.selectedRatings.contains("safe"))
                },
                label = { Text("Safe") },
                leadingIcon = if (uiState.selectedRatings.contains("safe")) {
                    { Icon(Icons.Default.Check, contentDescription = null, Modifier.size(18.dp)) }
                } else null
            )
            FilterChip(
                selected = uiState.selectedRatings.contains("questionable"),
                onClick = { 
                    onRatingToggle("questionable", !uiState.selectedRatings.contains("questionable"))
                },
                label = { Text("Questionable") },
                leadingIcon = if (uiState.selectedRatings.contains("questionable")) {
                    { Icon(Icons.Default.Check, contentDescription = null, Modifier.size(18.dp)) }
                } else null
            )
            FilterChip(
                selected = uiState.selectedRatings.contains("explicit"),
                onClick = { 
                    onRatingToggle("explicit", !uiState.selectedRatings.contains("explicit"))
                },
                label = { Text("Explicit") },
                leadingIcon = if (uiState.selectedRatings.contains("explicit")) {
                    { Icon(Icons.Default.Check, contentDescription = null, Modifier.size(18.dp)) }
                } else null
            )
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // AI filters
        Text(
            text = "AI Content",
            style = MaterialTheme.typography.titleMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = uiState.hideAI,
                onClick = { 
                    onHideAIToggle(!uiState.hideAI)
                    if (!uiState.hideAI) onAIOnlyToggle(false)
                },
                label = { Text("Hide AI") },
                leadingIcon = {
                    Icon(
                        if (uiState.hideAI) Icons.Default.VisibilityOff else Icons.Default.SmartToy,
                        contentDescription = null,
                        Modifier.size(18.dp)
                    )
                }
            )
            FilterChip(
                selected = uiState.aiOnly,
                onClick = { 
                    onAIOnlyToggle(!uiState.aiOnly)
                    if (!uiState.aiOnly) onHideAIToggle(false)
                },
                label = { Text("AI Only") },
                leadingIcon = {
                    Icon(
                        if (uiState.aiOnly) Icons.Default.AutoAwesome else Icons.Default.SmartToy,
                        contentDescription = null,
                        Modifier.size(18.dp)
                    )
                }
            )
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Button(
            onClick = onDismiss,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("Apply Filters")
        }
    }
}
