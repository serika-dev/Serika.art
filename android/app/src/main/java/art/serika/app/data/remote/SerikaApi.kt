package art.serika.app.data.remote

import art.serika.app.data.model.*
import retrofit2.http.*

interface SerikaApi {
    
    // Images
    @GET("images")
    suspend fun getImages(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 24,
        @Query("tags") tags: String? = null,
        @Query("ratings") ratings: String? = null,
        @Query("sort") sort: String = "newest",
        @Query("ai") aiOnly: Boolean? = null,
        @Query("hideAI") hideAI: Boolean? = null,
        @Query("q") search: String? = null,
        @Query("username") username: String? = null
    ): ImagesResponse
    
    @GET("images/{id}")
    suspend fun getImage(@Path("id") id: String): ImageDetailResponse
    
    // Tags
    @GET("tags")
    suspend fun getTags(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
        @Query("type") type: String? = null,
        @Query("q") search: String? = null,
        @Query("sort") sort: String = "count"
    ): TagsResponse
    
    @GET("tags/{name}")
    suspend fun getTag(@Path("name") name: String): TagsResponse
    
    // Artists
    @GET("artists")
    suspend fun getArtists(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 24,
        @Query("q") search: String? = null,
        @Query("verified") verified: Boolean? = null
    ): ArtistsResponse
    
    @GET("artists/{tagName}")
    suspend fun getArtist(@Path("tagName") tagName: String): ArtistDetailResponse
    
    // Auth
    @GET("auth/me")
    suspend fun getCurrentUser(): UserResponse
    
    @POST("auth/logout")
    suspend fun logout(): ApiError
    
    // Users
    @GET("users/{username}")
    suspend fun getUser(@Path("username") username: String): UserResponse
    
    // Votes
    @POST("vote")
    suspend fun vote(
        @Body body: VoteRequest
    ): VoteResponse
    
    @GET("vote/{imageId}")
    suspend fun getVote(@Path("imageId") imageId: String): VoteResponse
    
    // Favorites
    @POST("favorite")
    suspend fun toggleFavorite(
        @Body body: FavoriteRequest
    ): FavoriteResponse
    
    @GET("favorite/{imageId}")
    suspend fun getFavoriteStatus(@Path("imageId") imageId: String): FavoriteResponse
    
    @GET("favorite")
    suspend fun getFavorites(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 24
    ): ImagesResponse
    
    // Comments
    @GET("images/{imageId}/comments")
    suspend fun getComments(
        @Path("imageId") imageId: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): CommentsResponse
    
    @POST("images/{imageId}/comments")
    suspend fun postComment(
        @Path("imageId") imageId: String,
        @Body body: CommentRequest
    ): CommentsResponse
}

@kotlinx.serialization.Serializable
data class VoteRequest(
    val imageId: String,
    val type: String // "upvote" or "downvote"
)

@kotlinx.serialization.Serializable
data class FavoriteRequest(
    val imageId: String
)

@kotlinx.serialization.Serializable
data class CommentRequest(
    val content: String,
    val parentId: String? = null
)
