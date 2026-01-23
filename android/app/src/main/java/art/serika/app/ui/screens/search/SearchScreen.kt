package art.serika.app.ui.screens.search

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    initialQuery: String,
    onImageClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    onTagClick: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: SearchViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchResults = viewModel.searchResults.collectAsLazyPagingItems()
    val focusManager = LocalFocusManager.current
    
    LaunchedEffect(initialQuery) {
        if (initialQuery.isNotBlank()) {
            viewModel.setQuery(initialQuery)
        }
    }
    
    var showSuggestions by remember { mutableStateOf(false) }
    var showSortMenu by remember { mutableStateOf(false) }
    var showFilterSheet by remember { mutableStateOf(false) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    OutlinedTextField(
                        value = uiState.query,
                        onValueChange = { 
                            viewModel.setQuery(it)
                            showSuggestions = it.length >= 2
                        },
                        placeholder = { Text("Search images, tags...") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(
                            onSearch = {
                                viewModel.search()
                                showSuggestions = false
                                focusManager.clearFocus()
                            }
                        ),
                        trailingIcon = {
                            Row {
                                AnimatedVisibility(
                                    visible = uiState.query.isNotEmpty(),
                                    enter = fadeIn() + scaleIn(),
                                    exit = fadeOut() + scaleOut()
                                ) {
                                    IconButton(onClick = { viewModel.setQuery("") }) {
                                        Icon(Icons.Default.Clear, contentDescription = "Clear")
                                    }
                                }
                            }
                        },
                        shape = RoundedCornerShape(12.dp)
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
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
                            SearchSortOption.entries.forEach { option ->
                                DropdownMenuItem(
                                    text = { 
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Icon(
                                                imageVector = option.icon,
                                                contentDescription = null,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Text(option.label)
                                        }
                                    },
                                    onClick = {
                                        viewModel.setSort(option.value)
                                        showSortMenu = false
                                    },
                                    trailingIcon = {
                                        if (uiState.sort == option.value) {
                                            Icon(
                                                imageVector = Icons.Default.Check,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                )
                            }
                        }
                    }
                    
                    // Filter button
                    BadgedBox(
                        badge = {
                            if (uiState.activeFilterCount > 0) {
                                Badge { Text("${uiState.activeFilterCount}") }
                            }
                        }
                    ) {
                        IconButton(onClick = { showFilterSheet = true }) {
                            Icon(
                                imageVector = Icons.Default.FilterList,
                                contentDescription = "Filter"
                            )
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Tag suggestions dropdown
            if (showSuggestions && uiState.tagSuggestions.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 300.dp)
                    ) {
                        item {
                            Text(
                                text = "Tag Suggestions",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(16.dp, 12.dp, 16.dp, 8.dp)
                            )
                        }
                        items(uiState.tagSuggestions) { tag ->
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
                                modifier = Modifier.clickable {
                                    // Add tag to selected tags instead of navigating
                                    viewModel.addTag(tag)
                                    showSuggestions = false
                                }
                            )
                        }
                    }
                }
            } else if (uiState.query.isNotBlank() || uiState.selectedTags.isNotEmpty()) {
                Column {
                    // Sort & filter info bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Sorted by: ",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = SearchSortOption.entries.find { it.value == uiState.sort }?.label ?: "Relevance",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.weight(1f))
                        Text(
                            text = "${searchResults.itemCount} results",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    
                    // Active filters chips
                    if (uiState.activeFilterCount > 0 || uiState.selectedTags.isNotEmpty()) {
                        LazyRow(
                            modifier = Modifier.padding(horizontal = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            // Selected tags first
                            items(uiState.selectedTags) { tag ->
                                val tagColor = when (tag.type) {
                                    TagType.ARTIST -> ArtistTagColor
                                    TagType.CHARACTER -> CharacterTagColor
                                    TagType.COPYRIGHT -> CopyrightTagColor
                                    TagType.META -> MetaTagColor
                                    else -> GeneralTagColor
                                }
                                FilterChip(
                                    selected = true,
                                    onClick = { viewModel.removeTag(tag.name) },
                                    label = { 
                                        Text(
                                            text = tag.name.replace("_", " "),
                                            color = tagColor
                                        )
                                    },
                                    trailingIcon = {
                                        Icon(
                                            Icons.Default.Close,
                                            contentDescription = "Remove",
                                            modifier = Modifier.size(16.dp)
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = tagColor.copy(alpha = 0.15f)
                                    )
                                )
                            }
                            if (uiState.hideAI) {
                                item {
                                    FilterChip(
                                        selected = true,
                                        onClick = { viewModel.toggleHideAI() },
                                        label = { Text("No AI") },
                                        trailingIcon = {
                                            Icon(
                                                Icons.Default.Close,
                                                contentDescription = "Remove",
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    )
                                }
                            }
                            if (uiState.aiOnly) {
                                item {
                                    FilterChip(
                                        selected = true,
                                        onClick = { viewModel.toggleAIOnly() },
                                        label = { Text("AI Only") },
                                        trailingIcon = {
                                            Icon(
                                                Icons.Default.Close,
                                                contentDescription = "Remove",
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    )
                                }
                            }
                            uiState.selectedRatings.forEach { rating ->
                                item {
                                    FilterChip(
                                        selected = true,
                                        onClick = { viewModel.toggleRating(rating, false) },
                                        label = { Text(rating.replaceFirstChar { it.uppercase() }) },
                                        trailingIcon = {
                                            Icon(
                                                Icons.Default.Close,
                                                contentDescription = "Remove",
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    )
                                }
                            }
                            item {
                                TextButton(onClick = { viewModel.clearFilters() }) {
                                    Text("Clear all")
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                    
                    HorizontalDivider()
                    
                    // Search results
                    when {
                        searchResults.loadState.refresh is LoadState.Loading -> {
                            LoadingIndicator()
                        }
                        searchResults.loadState.refresh is LoadState.Error -> {
                            val error = (searchResults.loadState.refresh as LoadState.Error).error
                            ErrorMessage(
                                message = error.localizedMessage ?: "Search failed",
                                onRetry = { searchResults.retry() }
                            )
                        }
                        searchResults.itemCount == 0 && searchResults.loadState.refresh is LoadState.NotLoading -> {
                            EmptyState(
                                title = "No results found",
                                description = "Try different search terms or adjust filters",
                                icon = {
                                    Icon(
                                        imageVector = Icons.Default.SearchOff,
                                        contentDescription = null,
                                        modifier = Modifier.size(64.dp),
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
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
                                    count = searchResults.itemCount,
                                    key = { index -> searchResults[index]?.id ?: index }
                                ) { index ->
                                    val image = searchResults[index]
                                    if (image != null) {
                                        ImageCard(
                                            image = image,
                                            onClick = { onImageClick(image.sequentialId?.toString() ?: image.id) }
                                        )
                                    }
                                }
                                
                                if (searchResults.loadState.append is LoadState.Loading) {
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
            } else {
                // Empty state - no query
                EmptyState(
                    title = "Search for images",
                    description = "Enter tags, artist names, or keywords",
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                )
            }
        }
    }
    
    // Filter bottom sheet
    if (showFilterSheet) {
        ModalBottomSheet(
            onDismissRequest = { showFilterSheet = false }
        ) {
            SearchFilterSheetContent(
                selectedRatings = uiState.selectedRatings,
                hideAI = uiState.hideAI,
                aiOnly = uiState.aiOnly,
                onToggleRating = { rating, enabled -> viewModel.toggleRating(rating, enabled) },
                onToggleHideAI = { viewModel.toggleHideAI() },
                onToggleAIOnly = { viewModel.toggleAIOnly() },
                onClearFilters = { viewModel.clearFilters() },
                onDismiss = { showFilterSheet = false }
            )
        }
    }
}

private enum class SearchSortOption(
    val value: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    RELEVANCE("relevance", "Relevance", Icons.Default.AutoAwesome),
    NEWEST("newest", "Newest", Icons.Default.NewReleases),
    OLDEST("oldest", "Oldest", Icons.Default.History),
    SCORE("score", "Top Rated", Icons.Default.Star),
    FAVORITES("favorites", "Most Favorited", Icons.Default.Favorite),
    RANDOM("random", "Random", Icons.Default.Shuffle)
}

@Composable
private fun SearchFilterSheetContent(
    selectedRatings: List<String>,
    hideAI: Boolean,
    aiOnly: Boolean,
    onToggleRating: (String, Boolean) -> Unit,
    onToggleHideAI: () -> Unit,
    onToggleAIOnly: () -> Unit,
    onClearFilters: () -> Unit,
    onDismiss: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Filters",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            TextButton(onClick = onClearFilters) {
                Text("Clear all")
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Rating section
        Text(
            text = "Content Rating",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val ratings = listOf(
                "safe" to SafeColor,
                "questionable" to QuestionableColor,
                "explicit" to ExplicitColor
            )
            ratings.forEach { (rating, color) ->
                val isSelected = selectedRatings.contains(rating)
                FilterChip(
                    selected = isSelected,
                    onClick = { onToggleRating(rating, !isSelected) },
                    label = { Text(rating.replaceFirstChar { it.uppercase() }) },
                    leadingIcon = if (isSelected) {
                        {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = color.copy(alpha = 0.2f),
                        selectedLabelColor = color
                    )
                )
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // AI section
        Text(
            text = "AI Content",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = hideAI,
                onClick = onToggleHideAI,
                label = { Text("Hide AI") },
                leadingIcon = if (hideAI) {
                    {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                } else null
            )
            FilterChip(
                selected = aiOnly,
                onClick = onToggleAIOnly,
                label = { Text("AI Only") },
                leadingIcon = if (aiOnly) {
                    {
                        Icon(
                            Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                } else null
            )
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Button(
            onClick = onDismiss,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Apply Filters")
        }
        
        Spacer(modifier = Modifier.height(32.dp))
    }
}
