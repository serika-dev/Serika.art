package art.serika.app.data.repository

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import art.serika.app.data.model.*
import art.serika.app.data.remote.SerikaApi
import art.serika.app.data.remote.VoteRequest
import art.serika.app.data.remote.FavoriteRequest
import art.serika.app.data.remote.CommentRequest
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ImageRepository @Inject constructor(
    private val api: SerikaApi
) {
    fun getImagesPaged(
        tags: List<String>? = null,
        ratings: List<String>? = null,
        sort: String = "newest",
        aiOnly: Boolean? = null,
        hideAI: Boolean? = null,
        search: String? = null,
        username: String? = null
    ): Flow<PagingData<Image>> {
        return Pager(
            config = PagingConfig(
                pageSize = 24,
                enablePlaceholders = false,
                prefetchDistance = 3
            ),
            pagingSourceFactory = {
                ImagesPagingSource(
                    api = api,
                    tags = tags,
                    ratings = ratings,
                    sort = sort,
                    aiOnly = aiOnly,
                    hideAI = hideAI,
                    search = search,
                    username = username
                )
            }
        ).flow
    }
    
    suspend fun getImage(id: String): Result<ImageDetailResponse> {
        return try {
            Result.success(api.getImage(id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun vote(imageId: String, type: String): Result<VoteResponse> {
        return try {
            Result.success(api.vote(VoteRequest(imageId, type)))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getVote(imageId: String): Result<VoteResponse> {
        return try {
            Result.success(api.getVote(imageId))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun toggleFavorite(imageId: String): Result<FavoriteResponse> {
        return try {
            Result.success(api.toggleFavorite(FavoriteRequest(imageId)))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getFavoriteStatus(imageId: String): Result<FavoriteResponse> {
        return try {
            Result.success(api.getFavoriteStatus(imageId))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getComments(imageId: String): Result<CommentsResponse> {
        return try {
            Result.success(api.getComments(imageId))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun postComment(imageId: String, content: String, parentId: String? = null): Result<CommentsResponse> {
        return try {
            Result.success(api.postComment(imageId, CommentRequest(content, parentId)))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
