package art.serika.app.ui.screens.image

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import art.serika.app.ui.components.*
import art.serika.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImageDetailScreen(
    imageId: String,
    onBackClick: () -> Unit,
    onTagClick: (String) -> Unit,
    onArtistClick: (String) -> Unit,
    onUserClick: (String) -> Unit,
    viewModel: ImageDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = uiState.image?.let { "#${it.sequentialId ?: it.id.takeLast(6)}" } ?: "Image",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
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
                    IconButton(onClick = { /* Share */ }) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Share"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                LoadingIndicator(modifier = Modifier.padding(paddingValues))
            }
            uiState.error != null -> {
                ErrorMessage(
                    message = uiState.error!!,
                    onRetry = { viewModel.refresh() },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            uiState.image != null -> {
                val image = uiState.image!!
                
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                ) {
                    // Image
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(image.url)
                            .crossfade(true)
                            .build(),
                        contentDescription = image.description ?: "Image",
                        contentScale = ContentScale.FillWidth,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 200.dp, max = 500.dp)
                    )
                    
                    // Actions bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Upvote
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            IconButton(onClick = { viewModel.vote("upvote") }) {
                                Icon(
                                    imageVector = if (uiState.userVote == "upvote") 
                                        Icons.Filled.ThumbUp else Icons.Outlined.ThumbUp,
                                    contentDescription = "Upvote",
                                    tint = if (uiState.userVote == "upvote") 
                                        UpvoteColor else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = "${image.upvotes}",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                        
                        // Downvote
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            IconButton(onClick = { viewModel.vote("downvote") }) {
                                Icon(
                                    imageVector = if (uiState.userVote == "downvote") 
                                        Icons.Filled.ThumbDown else Icons.Outlined.ThumbDown,
                                    contentDescription = "Downvote",
                                    tint = if (uiState.userVote == "downvote") 
                                        DownvoteColor else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = "${image.downvotes}",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                        
                        // Favorite
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            IconButton(onClick = { viewModel.toggleFavorite() }) {
                                Icon(
                                    imageVector = if (uiState.isFavorited) 
                                        Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                    contentDescription = "Favorite",
                                    tint = if (uiState.isFavorited) 
                                        SerikaSecondary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = "${image.favorites}",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                        
                        // Views
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Outlined.Visibility,
                                contentDescription = "Views",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(12.dp)
                            )
                            Text(
                                text = "${image.views}",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                    
                    HorizontalDivider()
                    
                    // Info section
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Rating and AI badge
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RatingBadge(rating = image.rating)
                            if (image.isAIGenerated) {
                                AIBadge()
                            }
                            
                            Spacer(modifier = Modifier.weight(1f))
                            
                            Text(
                                text = "${image.width} × ${image.height}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        
                        // Uploader
                        if (image.username != null) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(vertical = 4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                TextButton(onClick = { onUserClick(image.username!!) }) {
                                    Text(image.username!!)
                                }
                            }
                        }
                        
                        // Description
                        if (!image.description.isNullOrBlank()) {
                            Text(
                                text = image.description!!,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        
                        // Source
                        if (!image.source.isNullOrBlank()) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Link,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = image.source!!,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.primary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                    
                    HorizontalDivider()
                    
                    // Tags section
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Tags",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        if (uiState.tags.isNotEmpty()) {
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(uiState.tags) { tag ->
                                    TagChip(
                                        tag = tag.name,
                                        type = tag.type.name,
                                        onClick = {
                                            if (tag.type.name.equals("artist", ignoreCase = true)) {
                                                onArtistClick(tag.name)
                                            } else {
                                                onTagClick(tag.name)
                                            }
                                        }
                                    )
                                }
                            }
                        } else {
                            Text(
                                text = "No tags",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}
