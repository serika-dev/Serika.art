package art.serika.app.data.repository

import androidx.paging.PagingSource
import androidx.paging.PagingState
import art.serika.app.data.model.Image
import art.serika.app.data.remote.SerikaApi
import retrofit2.HttpException
import java.io.IOException

class ImagesPagingSource(
    private val api: SerikaApi,
    private val tags: List<String>?,
    private val ratings: List<String>?,
    private val sort: String,
    private val aiOnly: Boolean?,
    private val hideAI: Boolean?,
    private val search: String?,
    private val username: String?
) : PagingSource<Int, Image>() {
    
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Image> {
        val page = params.key ?: 1
        
        return try {
            val response = api.getImages(
                page = page,
                limit = params.loadSize,
                tags = tags?.joinToString(","),
                ratings = ratings?.joinToString(","),
                sort = sort,
                aiOnly = aiOnly,
                hideAI = hideAI,
                search = search,
                username = username
            )
            
            LoadResult.Page(
                data = response.images,
                prevKey = if (page == 1) null else page - 1,
                nextKey = if (response.images.isEmpty() || page >= response.pagination.pages) null else page + 1
            )
        } catch (e: IOException) {
            LoadResult.Error(e)
        } catch (e: HttpException) {
            LoadResult.Error(e)
        }
    }
    
    override fun getRefreshKey(state: PagingState<Int, Image>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
}
