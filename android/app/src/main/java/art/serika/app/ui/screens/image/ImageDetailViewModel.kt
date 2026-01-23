package art.serika.app.ui.screens.image

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.model.Image
import art.serika.app.data.model.Tag
import art.serika.app.data.repository.ImageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ImageDetailUiState(
    val isLoading: Boolean = true,
    val image: Image? = null,
    val tags: List<Tag> = emptyList(),
    val error: String? = null,
    val userVote: String? = null,
    val isFavorited: Boolean = false
)

@HiltViewModel
class ImageDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val imageRepository: ImageRepository
) : ViewModel() {
    
    private val imageId: String = checkNotNull(savedStateHandle["imageId"])
    
    private val _uiState = MutableStateFlow(ImageDetailUiState())
    val uiState: StateFlow<ImageDetailUiState> = _uiState.asStateFlow()
    
    init {
        loadImage()
        loadVoteStatus()
        loadFavoriteStatus()
    }
    
    private fun loadImage() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            imageRepository.getImage(imageId)
                .onSuccess { response ->
                    if (response.success && response.image != null) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                image = response.image,
                                tags = response.tags ?: emptyList()
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                error = response.error ?: "Image not found"
                            )
                        }
                    }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = e.localizedMessage ?: "Failed to load image"
                        )
                    }
                }
        }
    }
    
    private fun loadVoteStatus() {
        viewModelScope.launch {
            imageRepository.getVote(imageId)
                .onSuccess { response ->
                    _uiState.update { it.copy(userVote = response.userVote) }
                }
        }
    }
    
    private fun loadFavoriteStatus() {
        viewModelScope.launch {
            imageRepository.getFavoriteStatus(imageId)
                .onSuccess { response ->
                    _uiState.update { it.copy(isFavorited = response.isFavorited) }
                }
        }
    }
    
    fun vote(type: String) {
        viewModelScope.launch {
            val currentVote = _uiState.value.userVote
            val newType = if (currentVote == type) "" else type
            
            imageRepository.vote(imageId, newType)
                .onSuccess { response ->
                    _uiState.update { state ->
                        state.copy(
                            userVote = response.userVote,
                            image = state.image?.copy(
                                upvotes = response.upvotes,
                                downvotes = response.downvotes
                            )
                        )
                    }
                }
        }
    }
    
    fun toggleFavorite() {
        viewModelScope.launch {
            imageRepository.toggleFavorite(imageId)
                .onSuccess { response ->
                    _uiState.update { state ->
                        state.copy(
                            isFavorited = response.isFavorited,
                            image = state.image?.copy(favorites = response.favorites)
                        )
                    }
                }
        }
    }
    
    fun refresh() {
        loadImage()
        loadVoteStatus()
        loadFavoriteStatus()
    }
}
