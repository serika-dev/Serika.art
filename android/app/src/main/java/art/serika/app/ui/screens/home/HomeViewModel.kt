package art.serika.app.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.model.Image
import art.serika.app.data.repository.ImageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val sort: String = "newest",
    val selectedRatings: List<String> = listOf("safe"),
    val hideAI: Boolean = false,
    val aiOnly: Boolean = false,
    val isRefreshing: Boolean = false
) {
    val hasActiveFilters: Boolean
        get() = hideAI || aiOnly || selectedRatings != listOf("safe")
    
    val activeFilterCount: Int
        get() {
            var count = 0
            if (hideAI) count++
            if (aiOnly) count++
            if (selectedRatings.contains("questionable")) count++
            if (selectedRatings.contains("explicit")) count++
            if (!selectedRatings.contains("safe")) count++
            return count
        }
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val imageRepository: ImageRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()
    
    private val refreshTrigger = MutableStateFlow(0)
    
    @OptIn(ExperimentalCoroutinesApi::class)
    val images: Flow<PagingData<Image>> = combine(
        _uiState,
        refreshTrigger
    ) { state, _ -> state }
        .flatMapLatest { state ->
            imageRepository.getImagesPaged(
                ratings = state.selectedRatings.takeIf { it.isNotEmpty() },
                sort = state.sort,
                hideAI = state.hideAI.takeIf { it },
                aiOnly = state.aiOnly.takeIf { it }
            )
        }
        .cachedIn(viewModelScope)
    
    init {
        // Load preferences
        viewModelScope.launch {
            preferencesManager.ratingPreferences.collect { prefs ->
                val ratings = buildList {
                    if (prefs.showSafe) add("safe")
                    if (prefs.showQuestionable) add("questionable")
                    if (prefs.showExplicit) add("explicit")
                }
                _uiState.update { it.copy(selectedRatings = ratings.ifEmpty { listOf("safe") }) }
            }
        }
        viewModelScope.launch {
            preferencesManager.hideAI.collect { hide ->
                _uiState.update { it.copy(hideAI = hide) }
            }
        }
    }
    
    fun setSort(sort: String) {
        _uiState.update { it.copy(sort = sort) }
    }
    
    fun toggleRating(rating: String, enabled: Boolean) {
        _uiState.update { state ->
            val newRatings = if (enabled) {
                state.selectedRatings + rating
            } else {
                state.selectedRatings - rating
            }
            // Ensure at least one rating is selected
            state.copy(selectedRatings = newRatings.ifEmpty { listOf("safe") })
        }
        // Save to preferences
        viewModelScope.launch {
            val state = _uiState.value
            preferencesManager.setRatingPreferences(
                safe = state.selectedRatings.contains("safe"),
                questionable = state.selectedRatings.contains("questionable"),
                explicit = state.selectedRatings.contains("explicit")
            )
        }
    }
    
    fun setHideAI(hide: Boolean) {
        _uiState.update { it.copy(hideAI = hide, aiOnly = if (hide) false else it.aiOnly) }
        viewModelScope.launch {
            preferencesManager.setHideAI(hide)
        }
    }
    
    fun setAIOnly(aiOnly: Boolean) {
        _uiState.update { it.copy(aiOnly = aiOnly, hideAI = if (aiOnly) false else it.hideAI) }
    }
    
    fun clearFilters() {
        _uiState.update { 
            it.copy(
                selectedRatings = listOf("safe"),
                hideAI = false,
                aiOnly = false
            ) 
        }
        viewModelScope.launch {
            preferencesManager.setRatingPreferences(safe = true, questionable = false, explicit = false)
            preferencesManager.setHideAI(false)
        }
    }
    
    fun refresh() {
        refreshTrigger.value++
    }
}
