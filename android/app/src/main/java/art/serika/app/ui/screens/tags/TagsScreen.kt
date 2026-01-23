package art.serika.app.ui.screens.tags

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import art.serika.app.data.model.TagType
import art.serika.app.ui.components.*
import art.serika.app.ui.theme.*

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
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Filter chips
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val filterOptions = listOf(
                    null to "All",
                    "general" to "General",
                    "artist" to "Artist",
                    "character" to "Character",
                    "copyright" to "Copyright",
                    "meta" to "Meta"
                )
                
                items(filterOptions) { (type, label) ->
                    FilterChip(
                        selected = uiState.filterType == type,
                        onClick = { viewModel.setFilterType(type) },
                        label = { Text(label) }
                    )
                }
            }
            
            // Search field
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
                    if (uiState.searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                }
            )
            
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
                        description = "Try a different search"
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
                                TagListItem(
                                    tag = tag,
                                    onClick = { onTagClick(tag.name) }
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

@Composable
private fun TagListItem(
    tag: art.serika.app.data.model.Tag,
    onClick: () -> Unit
) {
    val (icon, color) = when (tag.type) {
        TagType.ARTIST -> Icons.Default.Brush to ArtistTagColor
        TagType.CHARACTER -> Icons.Default.Person to CharacterTagColor
        TagType.COPYRIGHT -> Icons.Default.Copyright to CopyrightTagColor
        TagType.META -> Icons.Default.Info to MetaTagColor
        else -> Icons.Default.Tag to GeneralTagColor
    }
    
    ListItem(
        headlineContent = {
            Text(
                text = tag.name.replace("_", " "),
                color = color
            )
        },
        supportingContent = {
            Text("${tag.count} posts")
        },
        leadingContent = {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color
            )
        },
        trailingContent = {
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        modifier = Modifier.clickable(onClick = onClick)
    )
}
