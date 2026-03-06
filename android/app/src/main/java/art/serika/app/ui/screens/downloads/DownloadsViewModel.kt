package art.serika.app.ui.screens.downloads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.repository.LocalImage
import art.serika.app.data.repository.LocalImagesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DownloadsUiState(
    val isLoading: Boolean = true,
    val images: List<LocalImage> = emptyList(),
    val error: String? = null,
    val selectedImages: Set<Long> = emptySet(),
    val isSelectionMode: Boolean = false,
    val isDeleting: Boolean = false
)

@HiltViewModel
class DownloadsViewModel @Inject constructor(
    private val localImagesRepository: LocalImagesRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(DownloadsUiState())
    val uiState: StateFlow<DownloadsUiState> = _uiState.asStateFlow()
    
    init {
        loadImages()
    }
    
    fun loadImages() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            try {
                val images = localImagesRepository.getLocalImages()
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        images = images
                    ) 
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        error = e.localizedMessage ?: "Failed to load images"
                    ) 
                }
            }
        }
    }
    
    fun enterSelectionMode(image: LocalImage) {
        _uiState.update { 
            it.copy(
                isSelectionMode = true,
                selectedImages = setOf(image.id)
            ) 
        }
    }
    
    fun toggleImageSelection(image: LocalImage) {
        _uiState.update { state ->
            val newSelected = if (state.selectedImages.contains(image.id)) {
                state.selectedImages - image.id
            } else {
                state.selectedImages + image.id
            }
            
            if (newSelected.isEmpty()) {
                state.copy(
                    isSelectionMode = false,
                    selectedImages = emptySet()
                )
            } else {
                state.copy(selectedImages = newSelected)
            }
        }
    }
    
    fun isImageSelected(image: LocalImage): Boolean {
        return _uiState.value.selectedImages.contains(image.id)
    }
    
    fun exitSelectionMode() {
        _uiState.update { 
            it.copy(
                isSelectionMode = false,
                selectedImages = emptySet()
            ) 
        }
    }
    
    fun deleteSelected() {
        val selectedIds = _uiState.value.selectedImages
        val images = _uiState.value.images.filter { it.id in selectedIds }
        
        if (images.isEmpty()) return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isDeleting = true) }
            
            var deleted = 0
            images.forEach { image ->
                if (localImagesRepository.deleteImage(image)) {
                    deleted++
                }
            }
            
            // Reload images after deletion
            val updatedImages = localImagesRepository.getLocalImages()
            
            _uiState.update { 
                it.copy(
                    isDeleting = false,
                    images = updatedImages,
                    isSelectionMode = false,
                    selectedImages = emptySet()
                ) 
            }
        }
    }
    
    fun selectAll() {
        _uiState.update { state ->
            state.copy(
                selectedImages = state.images.map { it.id }.toSet()
            )
        }
    }
}
