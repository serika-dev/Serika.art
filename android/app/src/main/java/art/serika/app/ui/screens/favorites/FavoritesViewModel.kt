package art.serika.app.ui.screens.favorites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.model.Image
import art.serika.app.data.model.ImagesResponse
import art.serika.app.data.remote.SerikaApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

data class FavoritesUiState(
    val isLoading: Boolean = true,
    val images: List<Image> = emptyList(),
    val error: String? = null,
    val page: Int = 1,
    val hasMore: Boolean = true,
    val isLoadingMore: Boolean = false,
    val requiresLogin: Boolean = false
)

@HiltViewModel
class FavoritesViewModel @Inject constructor(
    private val api: SerikaApi
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(FavoritesUiState())
    val uiState: StateFlow<FavoritesUiState> = _uiState.asStateFlow()
    
    init {
        loadFavorites()
    }
    
    fun loadFavorites() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, requiresLogin = false) }
            
            try {
                val response = api.getFavorites(page = 1, limit = 24)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        images = response.images,
                        page = 1,
                        hasMore = response.pagination.page < response.pagination.pages
                    )
                }
            } catch (e: HttpException) {
                if (e.code() == 401) {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            requiresLogin = true,
                            error = "Please sign in to view your favorites"
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Error: ${e.message()}"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.localizedMessage ?: "Failed to load favorites"
                    )
                }
            }
        }
    }
    
    fun loadMore() {
        val currentState = _uiState.value
        if (currentState.isLoadingMore || !currentState.hasMore || currentState.requiresLogin) return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            
            try {
                val nextPage = currentState.page + 1
                val response = api.getFavorites(page = nextPage, limit = 24)
                _uiState.update {
                    it.copy(
                        isLoadingMore = false,
                        images = it.images + response.images,
                        page = nextPage,
                        hasMore = response.pagination.page < response.pagination.pages
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoadingMore = false) }
            }
        }
    }
    
    fun refresh() {
        loadFavorites()
    }
}
