package art.serika.app.ui.screens.artist

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import art.serika.app.data.model.Artist
import art.serika.app.data.model.Image
import art.serika.app.data.repository.ArtistRepository
import art.serika.app.data.repository.ImageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ArtistUiState(
    val isLoading: Boolean = true,
    val artist: Artist? = null,
    val imageCount: Int = 0,
    val error: String? = null
)

@HiltViewModel
class ArtistViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val artistRepository: ArtistRepository,
    private val imageRepository: ImageRepository
) : ViewModel() {
    
    private val tagName: String = checkNotNull(savedStateHandle["tagName"])
    
    private val _uiState = MutableStateFlow(ArtistUiState())
    val uiState: StateFlow<ArtistUiState> = _uiState.asStateFlow()
    
    val artistImages: Flow<PagingData<Image>> = imageRepository.getImagesPaged(
        tags = listOf(tagName)
    ).cachedIn(viewModelScope)
    
    init {
        loadArtist()
    }
    
    private fun loadArtist() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            artistRepository.getArtist(tagName)
                .onSuccess { response ->
                    if (response.success) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                artist = response.artist,
                                imageCount = response.tag?.count ?: 0
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                error = response.error ?: "Artist not found"
                            )
                        }
                    }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = e.localizedMessage ?: "Failed to load artist"
                        )
                    }
                }
        }
    }
    
    fun refresh() {
        loadArtist()
    }
}
