package art.serika.app.ui.screens.tags

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import art.serika.app.data.model.Artist
import art.serika.app.data.model.Tag
import art.serika.app.data.repository.ArtistRepository
import art.serika.app.data.repository.TagRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import javax.inject.Inject

data class TagsUiState(
    val filterType: String? = null,
    val searchQuery: String = "",
    val sortBy: String = "count"
)

@HiltViewModel
class TagsViewModel @Inject constructor(
    private val tagRepository: TagRepository,
    private val artistRepository: ArtistRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(TagsUiState())
    val uiState: StateFlow<TagsUiState> = _uiState.asStateFlow()
    
    @OptIn(ExperimentalCoroutinesApi::class)
    val tags: Flow<PagingData<Tag>> = _uiState
        .flatMapLatest { state ->
            tagRepository.getTagsPaged(
                type = state.filterType,
                search = state.searchQuery.takeIf { it.isNotBlank() },
                sort = state.sortBy
            )
        }
        .cachedIn(viewModelScope)
    
    val artists: Flow<PagingData<Artist>> = artistRepository
        .getArtistsPaged()
        .cachedIn(viewModelScope)
    
    fun setFilterType(type: String?) {
        _uiState.update { it.copy(filterType = type) }
    }
    
    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }
    
    fun setSortBy(sort: String) {
        _uiState.update { it.copy(sortBy = sort) }
    }
}
