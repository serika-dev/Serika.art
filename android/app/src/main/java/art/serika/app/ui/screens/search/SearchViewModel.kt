package art.serika.app.ui.screens.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import art.serika.app.data.model.Image
import art.serika.app.data.model.Tag
import art.serika.app.data.repository.ImageRepository
import art.serika.app.data.repository.TagRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SearchUiState(
    val query: String = "",
    val isSearching: Boolean = false,
    val tagSuggestions: List<Tag> = emptyList()
)

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val imageRepository: ImageRepository,
    private val tagRepository: TagRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()
    
    private val searchQuery = MutableStateFlow("")
    
    @OptIn(ExperimentalCoroutinesApi::class)
    val searchResults: Flow<PagingData<Image>> = searchQuery
        .filter { it.isNotBlank() }
        .flatMapLatest { query ->
            imageRepository.getImagesPaged(search = query)
        }
        .cachedIn(viewModelScope)
    
    @OptIn(FlowPreview::class)
    private val tagSuggestionsFlow = searchQuery
        .debounce(300)
        .filter { it.length >= 2 }
        .mapLatest { query ->
            tagRepository.searchTags(query, limit = 10)
                .getOrNull() ?: emptyList()
        }
    
    init {
        viewModelScope.launch {
            tagSuggestionsFlow.collect { tags ->
                _uiState.update { it.copy(tagSuggestions = tags) }
            }
        }
    }
    
    fun setQuery(query: String) {
        _uiState.update { it.copy(query = query) }
        searchQuery.value = query
    }
    
    fun search() {
        searchQuery.value = _uiState.value.query
    }
    
    fun clearSuggestions() {
        _uiState.update { it.copy(tagSuggestions = emptyList()) }
    }
}
