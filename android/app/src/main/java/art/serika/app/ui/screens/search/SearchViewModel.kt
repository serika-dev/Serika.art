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

@OptIn(ExperimentalCoroutinesApi::class)
data class SearchUiState(
    val query: String = "",
    val isSearching: Boolean = false,
    val tagSuggestions: List<Tag> = emptyList(),
    val sort: String = "relevance",
    val selectedRatings: List<String> = listOf("safe"),
    val hideAI: Boolean = false,
    val aiOnly: Boolean = false,
    val selectedTags: List<Tag> = emptyList()
) {
    val activeFilterCount: Int
        get() {
            var count = selectedTags.size
            if (hideAI) count++
            if (aiOnly) count++
            // Count non-default ratings
            if (selectedRatings.contains("questionable")) count++
            if (selectedRatings.contains("explicit")) count++
            return count
        }
    
    // Build the search query including selected tags
    val effectiveSearchQuery: String
        get() {
            val tagNames = selectedTags.map { it.name }
            return if (query.isNotBlank() && tagNames.isNotEmpty()) {
                "${tagNames.joinToString(",")},$query"
            } else if (tagNames.isNotEmpty()) {
                tagNames.joinToString(",")
            } else {
                query
            }
        }
}

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val imageRepository: ImageRepository,
    private val tagRepository: TagRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()
    
    private val searchTrigger = MutableStateFlow(0)
    
    @OptIn(ExperimentalCoroutinesApi::class)
    val searchResults: Flow<PagingData<Image>> = combine(
        _uiState,
        searchTrigger
    ) { state, _ -> state }
        .filter { it.query.isNotBlank() || it.selectedTags.isNotEmpty() }
        .flatMapLatest { state ->
            imageRepository.getImagesPaged(
                tags = state.selectedTags.map { it.name }.takeIf { it.isNotEmpty() },
                search = state.query.takeIf { it.isNotBlank() },
                sort = state.sort,
                ratings = state.selectedRatings.takeIf { it.isNotEmpty() },
                hideAI = state.hideAI.takeIf { it },
                aiOnly = state.aiOnly.takeIf { it }
            )
        }
        .cachedIn(viewModelScope)
    
    @OptIn(FlowPreview::class)
    private val tagSuggestionsFlow = _uiState
        .map { it.query }
        .distinctUntilChanged()
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
    }
    
    fun search() {
        searchTrigger.value++
    }
    
    fun setSort(sort: String) {
        _uiState.update { it.copy(sort = sort) }
        searchTrigger.value++
    }
    
    fun toggleRating(rating: String, enabled: Boolean) {
        _uiState.update { state ->
            val newRatings = if (enabled) {
                state.selectedRatings + rating
            } else {
                state.selectedRatings - rating
            }
            state.copy(selectedRatings = newRatings.ifEmpty { listOf("safe") })
        }
        searchTrigger.value++
    }
    
    fun toggleHideAI() {
        _uiState.update { state ->
            state.copy(
                hideAI = !state.hideAI,
                aiOnly = if (!state.hideAI) false else state.aiOnly
            )
        }
        searchTrigger.value++
    }
    
    fun toggleAIOnly() {
        _uiState.update { state ->
            state.copy(
                aiOnly = !state.aiOnly,
                hideAI = if (!state.aiOnly) false else state.hideAI
            )
        }
        searchTrigger.value++
    }
    
    fun clearFilters() {
        _uiState.update { 
            it.copy(
                selectedRatings = listOf("safe"),
                hideAI = false,
                aiOnly = false,
                selectedTags = emptyList()
            )
        }
        searchTrigger.value++
    }
    
    fun clearSuggestions() {
        _uiState.update { it.copy(tagSuggestions = emptyList()) }
    }
    
    fun addTag(tag: Tag) {
        if (!_uiState.value.selectedTags.any { it.name == tag.name }) {
            _uiState.update { 
                it.copy(
                    selectedTags = it.selectedTags + tag,
                    tagSuggestions = emptyList()
                )
            }
            searchTrigger.value++
        }
    }
    
    fun removeTag(tagName: String) {
        _uiState.update { 
            it.copy(selectedTags = it.selectedTags.filter { t -> t.name != tagName })
        }
        searchTrigger.value++
    }
}
