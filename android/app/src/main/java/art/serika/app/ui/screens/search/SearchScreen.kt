package art.serika.app.ui.screens.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import art.serika.app.ui.components.*

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
                            if (uiState.query.isNotEmpty()) {
                                IconButton(onClick = { viewModel.setQuery("") }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        }
                    )
                },
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Tag suggestions dropdown
            if (showSuggestions && uiState.tagSuggestions.isNotEmpty()) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    shadowElevation = 4.dp,
                    shape = MaterialTheme.shapes.medium
                ) {
                    LazyColumn {
                        items(uiState.tagSuggestions) { tag ->
                            ListItem(
                                headlineContent = { Text(tag.name.replace("_", " ")) },
                                supportingContent = { 
                                    Text("${tag.type.name.lowercase()} • ${tag.count} posts") 
                                },
                                leadingContent = {
                                    Icon(
                                        imageVector = when (tag.type.name.lowercase()) {
                                            "artist" -> Icons.Default.Brush
                                            "character" -> Icons.Default.Person
                                            "copyright" -> Icons.Default.Copyright
                                            else -> Icons.Default.Tag
                                        },
                                        contentDescription = null
                                    )
                                },
                                modifier = Modifier.clickable {
                                    if (tag.type.name.equals("artist", ignoreCase = true)) {
                                        onArtistClick(tag.name)
                                    } else {
                                        onTagClick(tag.name)
                                    }
                                    showSuggestions = false
                                }
                            )
                        }
                    }
                }
            } else if (uiState.query.isNotBlank()) {
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
                            description = "Try different search terms"
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
                                        onClick = { onImageClick(image.id) }
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
}
