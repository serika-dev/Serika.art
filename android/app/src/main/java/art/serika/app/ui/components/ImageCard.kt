package art.serika.app.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import art.serika.app.data.model.Image
import art.serika.app.data.model.Rating
import art.serika.app.ui.theme.*

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ImageCard(
    image: Image,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isSelectionMode: Boolean = false,
    isSelected: Boolean = false,
    onLongClick: (() -> Unit)? = null,
    onSelectionClick: (() -> Unit)? = null,
    animationDelay: Int = 0
) {
    // Appear animation
    var isVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(animationDelay.toLong())
        isVisible = true
    }
    
    val animatedScale by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0.8f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "scale"
    )
    
    val animatedAlpha by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = tween(300),
        label = "alpha"
    )
    
    // Selection scale animation
    val selectionScale by animateFloatAsState(
        targetValue = if (isSelected) 0.95f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "selection_scale"
    )
    
    Card(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .graphicsLayer {
                scaleX = animatedScale * selectionScale
                scaleY = animatedScale * selectionScale
                alpha = animatedAlpha
            }
            .then(
                if (isSelected) {
                    Modifier
                        .border(3.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp))
                        .shadow(8.dp, RoundedCornerShape(12.dp), ambientColor = MaterialTheme.colorScheme.primary)
                } else {
                    Modifier
                }
            )
            .combinedClickable(
                onClick = {
                    if (isSelectionMode && onSelectionClick != null) {
                        onSelectionClick()
                    } else {
                        onClick()
                    }
                },
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            val imageUrl = image.thumbnailUrl ?: image.url
            if (imageUrl.isNotBlank()) {
                SubcomposeAsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(imageUrl)
                        .crossfade(400)
                        .memoryCacheKey("${image.id}_thumb")
                        .diskCacheKey("${image.id}_thumb")
                        .diskCachePolicy(CachePolicy.ENABLED)
                        .memoryCachePolicy(CachePolicy.ENABLED)
                        .build(),
                    contentDescription = image.description ?: "Image #${image.sequentialId ?: image.id.takeLast(6)}",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    loading = {
                        // Shimmer loading effect
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(shimmerBrush()),
                            contentAlignment = Alignment.Center
                        ) {}
                    },
                    error = {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(MaterialTheme.colorScheme.errorContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    imageVector = Icons.Default.BrokenImage,
                                    contentDescription = "Failed to load",
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(32.dp)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Error",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No image",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            // Gradient overlay at bottom
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .align(Alignment.BottomCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.7f)
                            )
                        )
                    )
            )
            
            // Badges row at top
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
                    .align(Alignment.TopStart),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Rating badge
                RatingBadge(rating = image.rating)
                
                // AI badge
                if (image.isAIGenerated) {
                    AIBadge()
                }
            }
            
            // Selection indicator at top right
            if (isSelectionMode) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(
                            if (isSelected) MaterialTheme.colorScheme.primary
                            else Color.Black.copy(alpha = 0.5f)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Selected",
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
            
            // Stats at bottom
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
                    .align(Alignment.BottomStart),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${image.upvotes - image.downvotes}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White
                )
                
                Text(
                    text = "❤ ${image.favorites}",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White
                )
            }
        }
    }
}

@Composable
fun RatingBadge(
    rating: Rating,
    modifier: Modifier = Modifier
) {
    val (color, text) = when (rating) {
        Rating.SAFE -> SafeColor to "S"
        Rating.QUESTIONABLE -> QuestionableColor to "Q"
        Rating.EXPLICIT -> ExplicitColor to "E"
    }
    
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color)
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = Color.White
        )
    }
}

@Composable
fun AIBadge(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(AIBadgeColor)
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = "AI",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White
        )
    }
}

@Composable
fun TagChip(
    tag: String,
    type: String? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when (type?.lowercase()) {
        "artist" -> ArtistTagColor.copy(alpha = 0.15f)
        "character" -> CharacterTagColor.copy(alpha = 0.15f)
        "copyright" -> CopyrightTagColor.copy(alpha = 0.15f)
        "meta" -> MetaTagColor.copy(alpha = 0.15f)
        else -> GeneralTagColor.copy(alpha = 0.15f)
    }
    
    val textColor = when (type?.lowercase()) {
        "artist" -> ArtistTagColor
        "character" -> CharacterTagColor
        "copyright" -> CopyrightTagColor
        "meta" -> MetaTagColor
        else -> GeneralTagColor
    }
    
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = backgroundColor
    ) {
        Text(
            text = tag.replace("_", " "),
            style = MaterialTheme.typography.labelMedium,
            color = textColor,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}
