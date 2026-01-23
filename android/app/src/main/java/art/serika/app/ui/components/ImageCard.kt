package art.serika.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import art.serika.app.data.model.Image
import art.serika.app.data.model.Rating
import art.serika.app.ui.theme.*

@Composable
fun ImageCard(
    image: Image,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(image.thumbnailUrl ?: image.url)
                    .crossfade(true)
                    .build(),
                contentDescription = image.description ?: "Image",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            
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
