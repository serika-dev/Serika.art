package art.serika.app.data.repository

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.PagingSource
import androidx.paging.PagingState
import art.serika.app.data.model.*
import art.serika.app.data.remote.SerikaApi
import kotlinx.coroutines.flow.Flow
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ArtistRepository @Inject constructor(
    private val api: SerikaApi
) {
    fun getArtistsPaged(
        search: String? = null,
        verified: Boolean? = null
    ): Flow<PagingData<Artist>> {
        return Pager(
            config = PagingConfig(
                pageSize = 24,
                enablePlaceholders = false
            ),
            pagingSourceFactory = {
                ArtistsPagingSource(api, search, verified)
            }
        ).flow
    }
    
    suspend fun getArtist(tagName: String): Result<ArtistDetailResponse> {
        return try {
            Result.success(api.getArtist(tagName))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

class ArtistsPagingSource(
    private val api: SerikaApi,
    private val search: String?,
    private val verified: Boolean?
) : PagingSource<Int, Artist>() {
    
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Artist> {
        val page = params.key ?: 1
        
        return try {
            val response = api.getArtists(
                page = page,
                limit = params.loadSize,
                search = search,
                verified = verified
            )
            
            val pagination = response.pagination
            LoadResult.Page(
                data = response.artists,
                prevKey = if (page == 1) null else page - 1,
                nextKey = if (response.artists.isEmpty() || (pagination != null && page >= pagination.pages)) null else page + 1
            )
        } catch (e: IOException) {
            LoadResult.Error(e)
        } catch (e: HttpException) {
            LoadResult.Error(e)
        }
    }
    
    override fun getRefreshKey(state: PagingState<Int, Artist>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}
