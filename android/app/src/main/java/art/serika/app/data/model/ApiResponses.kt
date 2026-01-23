package art.serika.app.data.model

import kotlinx.serialization.Serializable

@Serializable
data class ImagesResponse(
    val success: Boolean,
    val images: List<Image>,
    val pagination: Pagination
)

@Serializable
data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val pages: Int
)

@Serializable
data class ImageDetailResponse(
    val success: Boolean,
    val image: Image? = null,
    val tags: List<Tag>? = null,
    val error: String? = null
)

@Serializable
data class TagsResponse(
    val success: Boolean,
    val tags: List<Tag>,
    val pagination: Pagination? = null
)

@Serializable
data class UserResponse(
    val success: Boolean,
    val user: User? = null,
    val error: String? = null
)

@Serializable
data class AuthResponse(
    val success: Boolean,
    val user: User? = null,
    val token: String? = null,
    val error: String? = null
)

@Serializable
data class LoginResponse(
    val success: Boolean,
    val user: User? = null,
    val token: String? = null,
    val error: String? = null
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    val rememberMe: Boolean = true
)

@Serializable
data class VoteResponse(
    val success: Boolean,
    val upvotes: Int = 0,
    val downvotes: Int = 0,
    val userVote: String? = null,
    val error: String? = null
)

@Serializable
data class FavoriteResponse(
    val success: Boolean,
    val isFavorited: Boolean = false,
    val favorites: Int = 0,
    val error: String? = null
)

@Serializable
data class ArtistsResponse(
    val success: Boolean,
    val artists: List<Artist>,
    val pagination: Pagination? = null
)

@Serializable
data class ArtistDetailResponse(
    val success: Boolean,
    val artist: Artist? = null,
    val tag: Tag? = null,
    val images: List<Image>? = null,
    val error: String? = null
)

@Serializable
data class CommentsResponse(
    val success: Boolean,
    val comments: List<Comment>,
    val pagination: Pagination? = null
)

@Serializable
data class ApiError(
    val success: Boolean = false,
    val error: String
)
