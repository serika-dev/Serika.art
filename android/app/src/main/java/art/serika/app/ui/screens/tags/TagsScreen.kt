package art.serika.app.ui.screens.tags

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import art.serika.app.data.model.Tag
import art.serika.app.data.model.TagType
import art.serika.app.ui.components.*
import art.serika.app.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagsScreen(
    filterType: String?,
    onBackClick: () -> Unit,
    onTagClick: (String) -> Unit,
    viewModel: TagsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val tags = viewModel.tags.collectAsLazyPagingItems()
    val focusManager = LocalFocusManager.current
    
    var showSortMenu by remember { mutableStateOf(false) }
    
    LaunchedEffect(filterType) {
        viewModel.setFilterType(filterType)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tags") },
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
                            SortOption.entries.forEach { option ->
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
                                        viewModel.setSortBy(option.value)
                                        showSortMenu = false
                                    },
                                    trailingIcon = {
                                        if (uiState.sortBy == option.value) {
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
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search field with better styling
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                placeholder = { Text("Search tags...") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                singleLine = true,
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null)
                },
                trailingIcon = {
                    AnimatedVisibility(
                        visible = uiState.searchQuery.isNotEmpty(),
                        enter = fadeIn() + scaleIn(),
                        exit = fadeOut() + scaleOut()
                    ) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
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
            
            // Filter chips with scroll
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 8.dp)
            ) {
                val filterOptions = listOf(
                    TagFilterOption(null, "All", Icons.Default.SelectAll, null),
                    TagFilterOption("general", "General", Icons.Default.Tag, GeneralTagColor),
                    TagFilterOption("artist", "Artist", Icons.Default.Brush, ArtistTagColor),
                    TagFilterOption("character", "Character", Icons.Default.Person, CharacterTagColor),
                    TagFilterOption("copyright", "Copyright", Icons.Default.Copyright, CopyrightTagColor),
                    TagFilterOption("meta", "Meta", Icons.Default.Info, MetaTagColor)
                )
                
                items(filterOptions) { option ->
                    val isSelected = uiState.filterType == option.type
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.setFilterType(option.type) },
                        label = { Text(option.label) },
                        leadingIcon = {
                            Icon(
                                imageVector = option.icon,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = if (isSelected) {
                                    MaterialTheme.colorScheme.onSecondaryContainer
                                } else {
                                    option.color ?: MaterialTheme.colorScheme.onSurfaceVariant
                                }
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = option.color?.copy(alpha = 0.2f)
                                ?: MaterialTheme.colorScheme.secondaryContainer
                        )
                    )
                }
            }
            
            // Current sort indicator
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Sorted by: ",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = SortOption.entries.find { it.value == uiState.sortBy }?.label ?: "Count",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "${tags.itemCount} tags",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            
            // Tags list
            when {
                tags.loadState.refresh is LoadState.Loading -> {
                    LoadingIndicator()
                }
                tags.loadState.refresh is LoadState.Error -> {
                    val error = (tags.loadState.refresh as LoadState.Error).error
                    ErrorMessage(
                        message = error.localizedMessage ?: "Failed to load tags",
                        onRetry = { tags.retry() }
                    )
                }
                tags.itemCount == 0 && tags.loadState.refresh is LoadState.NotLoading -> {
                    EmptyState(
                        title = "No tags found",
                        description = if (uiState.searchQuery.isNotEmpty()) {
                            "Try a different search term"
                        } else {
                            "No tags available for this category"
                        },
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
                    LazyColumn(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(
                            count = tags.itemCount,
                            key = { index -> tags[index]?.id ?: index }
                        ) { index ->
                            val tag = tags[index]
                            if (tag != null) {
                                EnhancedTagListItem(
                                    tag = tag,
                                    onClick = { onTagClick(tag.name) },
                                    searchQuery = uiState.searchQuery
                                )
                            }
                        }
                        
                        if (tags.loadState.append is LoadState.Loading) {
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

private data class TagFilterOption(
    val type: String?,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val color: Color?
)

private enum class SortOption(
    val value: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    COUNT("count", "Most Used", Icons.AutoMirrored.Filled.TrendingUp),
    NAME("name", "Alphabetical", Icons.Default.SortByAlpha),
    NEWEST("newest", "Newest", Icons.Default.NewReleases),
    UPDATED("updated", "Recently Updated", Icons.Default.Update)
}

@Composable
private fun EnhancedTagListItem(
    tag: Tag,
    onClick: () -> Unit,
    searchQuery: String = ""
) {
    val (icon, color) = when (tag.type) {
        TagType.ARTIST -> Icons.Default.Brush to ArtistTagColor
        TagType.CHARACTER -> Icons.Default.Person to CharacterTagColor
        TagType.COPYRIGHT -> Icons.Default.Copyright to CopyrightTagColor
        TagType.META -> Icons.Default.Info to MetaTagColor
        else -> Icons.Default.Tag to GeneralTagColor
    }
    
    val formattedCount = remember(tag.count) {
        NumberFormat.getNumberInstance(Locale.getDefault()).format(tag.count)
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = color.copy(alpha = 0.05f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icon with colored background
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(color.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(24.dp)
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                // Tag name
                val displayName = tag.name.replace("_", " ")
                Text(
                    text = displayName,
                    style = MaterialTheme.typography.titleMedium,
                    color = color,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Type badge
                    Surface(
                        color = color.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = tag.type.name.lowercase().replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelSmall,
                            color = color,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                    
                    // Post count
                    Text(
                        text = "$formattedCount posts",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
        }
    }
}
