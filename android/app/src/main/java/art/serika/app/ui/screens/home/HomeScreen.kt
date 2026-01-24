package art.serika.app.ui.screens.home

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import art.serika.app.data.model.TagType
import art.serika.app.ui.components.*
import art.serika.app.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onImageClick: (String) -> Unit,
    onSearchClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onFavoritesClick: () -> Unit,
    onTagsClick: () -> Unit,
    onDownloadsClick: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val images = viewModel.images.collectAsLazyPagingItems()
    val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
    val focusManager = LocalFocusManager.current
    
    var showSortMenu by remember { mutableStateOf(false) }
    var showTagSuggestions by remember { mutableStateOf(false) }
    
    // Drawer state for filter sidebar
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    
    // Show snackbar for batch action messages
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(uiState.batchActionMessage) {
        uiState.batchActionMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearBatchMessage()
        }
    }
    
    // Handle back press in selection mode or when drawer is open
    BackHandler(enabled = uiState.isSelectionMode || drawerState.isOpen) {
        when {
            drawerState.isOpen -> scope.launch { drawerState.close() }
            uiState.isSelectionMode -> viewModel.exitSelectionMode()
        }
    }
    
    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.fillMaxWidth(0.85f)
            ) {
                FilterDrawerContent(
                    uiState = uiState,
                    onRatingToggle = { rating, enabled ->
                        viewModel.toggleRating(rating, enabled)
                    },
                    onHideAIToggle = { viewModel.setHideAI(it) },
                    onAIOnlyToggle = { viewModel.setAIOnly(it) },
                    onTagQueryChange = { 
                        viewModel.setTagQuery(it)
                        showTagSuggestions = it.length >= 2
                    },
                    onTagAdd = { tag ->
                        viewModel.addTag(tag)
                        showTagSuggestions = false
                    },
                    onTagRemove = { viewModel.removeTag(it) },
                    showTagSuggestions = showTagSuggestions,
                    onDismissTagSuggestions = { 
                        showTagSuggestions = false
                        viewModel.clearTagSuggestions()
                    },
                    onClearFilters = { viewModel.clearFilters() },
                    onClose = { scope.launch { drawerState.close() } }
                )
            }
        }
    ) {
        Scaffold(
            modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                if (uiState.isSelectionMode) {
                    // Selection mode top bar
                    TopAppBar(
                        title = {
                            Text("${uiState.selectedCount} selected")
                        },
                        navigationIcon = {
                            IconButton(onClick = { viewModel.exitSelectionMode() }) {
                                Icon(Icons.Default.Close, contentDescription = "Cancel")
                            }
                        },
                        actions = {
                            // Mass upvote
                            IconButton(
                                onClick = { viewModel.massUpvote() },
                                enabled = !uiState.isBatchActionInProgress
                            ) {
                                Icon(Icons.Default.ThumbUp, contentDescription = "Upvote all")
                            }
                            
                            // Mass favorite
                            IconButton(
                                onClick = { viewModel.massFavorite() },
                                enabled = !uiState.isBatchActionInProgress
                            ) {
                                Icon(Icons.Default.Favorite, contentDescription = "Favorite all")
                            }
                            
                            // Mass download
                            IconButton(
                                onClick = { viewModel.massDownload() },
                                enabled = !uiState.isBatchActionInProgress
                            ) {
                                Icon(Icons.Default.Download, contentDescription = "Download all")
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                        ),
                        scrollBehavior = scrollBehavior
                    )
                } else {
                    TopAppBar(
                        title = {
                            Text("Serika.art")
                        },
                        navigationIcon = {
                            // Menu/Filter drawer button
                            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                BadgedBox(
                                    badge = {
                                        if (uiState.hasActiveFilters) {
                                            Badge { Text("${uiState.activeFilterCount}") }
                                        }
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.FilterList,
                                        contentDescription = "Filters"
                                    )
                                }
                            }
                        },
                        actions = {
                            // Sort button
                            Box {
                                IconButton(onClick = { showSortMenu = true }) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Sort,
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
                }
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
                        icon = { Icon(Icons.Outlined.Download, contentDescription = "Downloads") },
                        label = { Text("Downloads") },
                        selected = false,
                        onClick = onDownloadsClick
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
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                // Selected tags row - shown as pills
                AnimatedVisibility(
                    visible = uiState.selectedTags.isNotEmpty(),
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    LazyRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.selectedTags) { tag ->
                            TagPill(
                                tag = tag,
                                onRemove = { viewModel.removeTag(tag.name) }
                            )
                        }
                        item {
                            TextButton(
                                onClick = { viewModel.clearFilters() }
                            ) {
                                Text("Clear all")
                            }
                        }
                    }
                }
                
                Box(modifier = Modifier.weight(1f)) {
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
                                description = if (uiState.selectedTags.isNotEmpty()) 
                                    "Try removing some tags or adjusting filters"
                                else
                                    "Try adjusting your filters"
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
                                            onClick = { onImageClick(image.sequentialId?.toString() ?: image.id) },
                                            isSelectionMode = uiState.isSelectionMode,
                                            isSelected = viewModel.isImageSelected(image),
                                            onLongClick = {
                                                if (!uiState.isSelectionMode) {
                                                    viewModel.enterSelectionMode(image)
                                                }
                                            },
                                            onSelectionClick = {
                                                viewModel.toggleImageSelection(image)
                                            }
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
        }
    }
}

/**
 * A pill-shaped chip for displaying selected tags with colored styling based on tag type
 */
@Composable
fun TagPill(
    tag: art.serika.app.data.model.Tag,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    val tagColor = when (tag.type) {
        TagType.ARTIST -> ArtistTagColor
        TagType.CHARACTER -> CharacterTagColor
        TagType.COPYRIGHT -> CopyrightTagColor
        TagType.META -> MetaTagColor
        else -> GeneralTagColor
    }
    
    val tagIcon = when (tag.type) {
        TagType.ARTIST -> Icons.Default.Brush
        TagType.CHARACTER -> Icons.Default.Person
        TagType.COPYRIGHT -> Icons.Default.Copyright
        TagType.META -> Icons.Default.Info
        else -> Icons.Default.Tag
    }
    
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = tagColor.copy(alpha = 0.15f),
        contentColor = tagColor
    ) {
        Row(
            modifier = Modifier.padding(start = 8.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = tagIcon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = tagColor
            )
            Text(
                text = tag.name.replace("_", " "),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Medium,
                color = tagColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(20.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Remove",
                    modifier = Modifier.size(14.dp),
                    tint = tagColor
                )
            }
        }
    }
}

/**
 * Filter drawer content with tag search and suggestions
 */
@Composable
private fun FilterDrawerContent(
    uiState: HomeUiState,
    onRatingToggle: (String, Boolean) -> Unit,
    onHideAIToggle: (Boolean) -> Unit,
    onAIOnlyToggle: (Boolean) -> Unit,
    onTagQueryChange: (String) -> Unit,
    onTagAdd: (art.serika.app.data.model.Tag) -> Unit,
    onTagRemove: (String) -> Unit,
    showTagSuggestions: Boolean,
    onDismissTagSuggestions: () -> Unit,
    onClearFilters: () -> Unit,
    onClose: () -> Unit
) {
    val focusManager = LocalFocusManager.current
    
    Column(
        modifier = Modifier
            .fillMaxHeight()
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Filters & Search",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, contentDescription = "Close")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Tag search section
        Text(
            text = "Search Tags",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.height(8.dp))
        
        Box {
            OutlinedTextField(
                value = uiState.tagQuery,
                onValueChange = onTagQueryChange,
                placeholder = { Text("Type to search tags...") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null)
                },
                trailingIcon = {
                    if (uiState.tagQuery.isNotEmpty()) {
                        IconButton(onClick = { onTagQueryChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(
                    onSearch = { focusManager.clearFocus() }
                ),
                shape = RoundedCornerShape(12.dp)
            )
            
            // Tag suggestions dropdown
            AnimatedVisibility(
                visible = showTagSuggestions && uiState.tagSuggestions.isNotEmpty(),
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 60.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 250.dp)
                    ) {
                        items(uiState.tagSuggestions) { tag ->
                            TagSuggestionItem(
                                tag = tag,
                                onClick = { onTagAdd(tag) }
                            )
                        }
                    }
                }
            }
        }
        
        // Selected tags
        if (uiState.selectedTags.isNotEmpty()) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Selected Tags",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            
            // Wrap tags in a flow layout style
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                uiState.selectedTags.chunked(2).forEach { tagRow ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        tagRow.forEach { tag ->
                            TagPill(
                                tag = tag,
                                onRemove = { onTagRemove(tag.name) }
                            )
                        }
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(16.dp))
        
        // Rating filters
        Text(
            text = "Content Rating",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.height(12.dp))
        
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
                } else null,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SafeColor.copy(alpha = 0.2f),
                    selectedLabelColor = SafeColor
                )
            )
            FilterChip(
                selected = uiState.selectedRatings.contains("questionable"),
                onClick = { 
                    onRatingToggle("questionable", !uiState.selectedRatings.contains("questionable"))
                },
                label = { Text("Q") },
                leadingIcon = if (uiState.selectedRatings.contains("questionable")) {
                    { Icon(Icons.Default.Check, contentDescription = null, Modifier.size(18.dp)) }
                } else null,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = QuestionableColor.copy(alpha = 0.2f),
                    selectedLabelColor = QuestionableColor
                )
            )
            FilterChip(
                selected = uiState.selectedRatings.contains("explicit"),
                onClick = { 
                    onRatingToggle("explicit", !uiState.selectedRatings.contains("explicit"))
                },
                label = { Text("E") },
                leadingIcon = if (uiState.selectedRatings.contains("explicit")) {
                    { Icon(Icons.Default.Check, contentDescription = null, Modifier.size(18.dp)) }
                } else null,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ExplicitColor.copy(alpha = 0.2f),
                    selectedLabelColor = ExplicitColor
                )
            )
        }
        
        Spacer(modifier = Modifier.height(20.dp))
        
        // AI filters
        Text(
            text = "AI Content",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.height(12.dp))
        
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
        
        Spacer(modifier = Modifier.weight(1f))
        
        // Bottom action buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = onClearFilters,
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Clear, contentDescription = null, Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Clear")
            }
            Button(
                onClick = onClose,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.Check, contentDescription = null, Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Apply")
            }
        }
    }
}

/**
 * A single tag suggestion item in the dropdown
 */
@Composable
private fun TagSuggestionItem(
    tag: art.serika.app.data.model.Tag,
    onClick: () -> Unit
) {
    val (tagIcon, tagColor) = when (tag.type) {
        TagType.ARTIST -> Icons.Default.Brush to ArtistTagColor
        TagType.CHARACTER -> Icons.Default.Person to CharacterTagColor
        TagType.COPYRIGHT -> Icons.Default.Copyright to CopyrightTagColor
        TagType.META -> Icons.Default.Info to MetaTagColor
        else -> Icons.Default.Tag to GeneralTagColor
    }
    
    val formattedCount = remember(tag.count) {
        NumberFormat.getNumberInstance(Locale.getDefault()).format(tag.count)
    }
    
    ListItem(
        headlineContent = { 
            Text(
                text = tag.name.replace("_", " "),
                color = tagColor,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        supportingContent = { 
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Type badge as a small pill
                Surface(
                    color = tagColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        text = tag.type.name.lowercase().replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall,
                        color = tagColor,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
                Text(
                    text = "$formattedCount posts",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        },
        leadingContent = {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(tagColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = tagIcon,
                    contentDescription = null,
                    tint = tagColor,
                    modifier = Modifier.size(20.dp)
                )
            }
        },
        trailingContent = {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "Add tag",
                tint = tagColor
            )
        },
        modifier = Modifier.clickable(onClick = onClick)
    )
}
