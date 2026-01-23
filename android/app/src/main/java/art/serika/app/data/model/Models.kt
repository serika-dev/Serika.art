package art.serika.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    @SerialName("_id") val id: String,
    val username: String,
    val email: String? = null,
    val avatarUrl: String? = null,
    val rank: UserRank = UserRank.USER,
    val createdAt: String,
    val updatedAt: String? = null
)

@Serializable
enum class UserRank {
    @SerialName("user") USER,
    @SerialName("moderator") MODERATOR,
    @SerialName("admin") ADMIN,
    @SerialName("owner") OWNER
}

@Serializable
data class Tag(
    @SerialName("_id") val id: String,
    val name: String,
    val type: TagType,
    val count: Int = 0,
    val createdAt: String? = null
)

@Serializable
enum class TagType {
    @SerialName("general") GENERAL,
    @SerialName("artist") ARTIST,
    @SerialName("character") CHARACTER,
    @SerialName("copyright") COPYRIGHT,
    @SerialName("meta") META
}

@Serializable
data class Image(
    @SerialName("_id") val id: String,
    val sequentialId: Int? = null,
    val userId: String? = null,
    val username: String? = null,
    val url: String,
    val thumbnailUrl: String? = null,
    val originalFilename: String? = null,
    val fileSize: Long = 0,
    val width: Int = 0,
    val height: Int = 0,
    val contentType: String? = null,
    val tags: List<String> = emptyList(),
    val rating: Rating = Rating.SAFE,
    val isAIGenerated: Boolean = false,
    val source: String? = null,
    val description: String? = null,
    val upvotes: Int = 0,
    val downvotes: Int = 0,
    val favorites: Int = 0,
    val views: Int = 0,
    val createdAt: String,
    val updatedAt: String? = null,
    // Populated tag info for display
    val tagInfo: List<Tag>? = null
)

@Serializable
enum class Rating {
    @SerialName("safe") SAFE,
    @SerialName("questionable") QUESTIONABLE,
    @SerialName("explicit") EXPLICIT
}

@Serializable
data class Artist(
    @SerialName("_id") val id: String,
    val tagId: String,
    val tagName: String,
    val claimedByUserId: String? = null,
    val claimedByUsername: String? = null,
    val verified: Boolean = false,
    val avatarUrl: String? = null,
    val bannerUrl: String? = null,
    val bio: String? = null,
    val socials: ArtistSocials? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class ArtistSocials(
    val twitter: String? = null,
    val bluesky: String? = null,
    val youtube: String? = null,
    val pixiv: String? = null,
    val deviantart: String? = null,
    val artstation: String? = null,
    val patreon: String? = null,
    val linktree: String? = null,
    val carrd: String? = null,
    val website: String? = null
)

@Serializable
data class Vote(
    @SerialName("_id") val id: String,
    val userId: String,
    val imageId: String,
    val type: VoteType,
    val createdAt: String
)

@Serializable
enum class VoteType {
    @SerialName("upvote") UPVOTE,
    @SerialName("downvote") DOWNVOTE
}

@Serializable
data class Favorite(
    @SerialName("_id") val id: String,
    val userId: String,
    val imageId: String,
    val createdAt: String
)

@Serializable
data class Comment(
    @SerialName("_id") val id: String,
    val imageId: String,
    val userId: String,
    val username: String,
    val avatarUrl: String? = null,
    val rank: UserRank? = null,
    val content: String,
    val parentId: String? = null,
    val asArtist: Boolean = false,
    val artistTagId: String? = null,
    val createdAt: String,
    val updatedAt: String? = null
)
