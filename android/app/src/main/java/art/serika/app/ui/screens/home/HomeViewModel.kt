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
    val isRefreshing: Boolean = false
)

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
                hideAI = state.hideAI.takeIf { it }
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
    
    fun refresh() {
        refreshTrigger.value++
    }
}
