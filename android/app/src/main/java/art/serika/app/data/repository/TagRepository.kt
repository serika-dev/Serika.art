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
class TagRepository @Inject constructor(
    private val api: SerikaApi
) {
    fun getTagsPaged(
        type: String? = null,
        search: String? = null,
        sort: String = "count"
    ): Flow<PagingData<Tag>> {
        return Pager(
            config = PagingConfig(
                pageSize = 50,
                enablePlaceholders = false
            ),
            pagingSourceFactory = {
                TagsPagingSource(api, type, search, sort)
            }
        ).flow
    }
    
    suspend fun getTag(name: String): Result<TagsResponse> {
        return try {
            Result.success(api.getTag(name))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun searchTags(query: String, limit: Int = 10): Result<List<Tag>> {
        return try {
            val response = api.getTags(page = 1, limit = limit, search = query)
            Result.success(response.tags)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

class TagsPagingSource(
    private val api: SerikaApi,
    private val type: String?,
    private val search: String?,
    private val sort: String
) : PagingSource<Int, Tag>() {
    
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Tag> {
        val page = params.key ?: 1
        
        return try {
            val response = api.getTags(
                page = page,
                limit = params.loadSize,
                type = type,
                search = search,
                sort = sort
            )
            
            val pagination = response.pagination
            LoadResult.Page(
                data = response.tags,
                prevKey = if (page == 1) null else page - 1,
                nextKey = if (response.tags.isEmpty() || (pagination != null && page >= pagination.pages)) null else page + 1
            )
        } catch (e: IOException) {
            LoadResult.Error(e)
        } catch (e: HttpException) {
            LoadResult.Error(e)
        }
    }
    
    override fun getRefreshKey(state: PagingState<Int, Tag>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}
