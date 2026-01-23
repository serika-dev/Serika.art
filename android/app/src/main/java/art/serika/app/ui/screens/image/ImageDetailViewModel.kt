package art.serika.app.ui.screens.image

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.model.Comment
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
    val isFavorited: Boolean = false,
    val comments: List<Comment> = emptyList(),
    val isLoadingComments: Boolean = false,
    val commentText: String = "",
    val isPostingComment: Boolean = false,
    val replyingTo: Comment? = null,
    val currentImageId: String = ""
)

@HiltViewModel
class ImageDetailViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val imageRepository: ImageRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(ImageDetailUiState())
    val uiState: StateFlow<ImageDetailUiState> = _uiState.asStateFlow()
    
    /**
     * Called from LaunchedEffect when imageId changes
     */
    fun loadForImageId(imageId: String) {
        val currentId = _uiState.value.currentImageId
        if (imageId != currentId && imageId.isNotEmpty()) {
            _uiState.update { 
                ImageDetailUiState(isLoading = true, currentImageId = imageId) 
            }
            loadImageData(imageId)
        }
    }
    
    private fun loadImageData(imageId: String) {
        loadImage(imageId)
        loadVoteStatus(imageId)
        loadFavoriteStatus(imageId)
        loadComments(imageId)
    }
    
    private fun loadImage(imageId: String) {
        viewModelScope.launch {
            imageRepository.getImage(imageId)
                .onSuccess { response ->
                    if (response.success && response.image != null) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                image = response.image,
                                tags = response.tags ?: emptyList(),
                                error = null
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
    
    private fun loadVoteStatus(imageId: String) {
        viewModelScope.launch {
            imageRepository.getVote(imageId)
                .onSuccess { response ->
                    _uiState.update { it.copy(userVote = response.userVote) }
                }
        }
    }
    
    private fun loadFavoriteStatus(imageId: String) {
        viewModelScope.launch {
            imageRepository.getFavoriteStatus(imageId)
                .onSuccess { response ->
                    _uiState.update { it.copy(isFavorited = response.isFavorited) }
                }
        }
    }
    
    private fun loadComments(imageId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingComments = true) }
            
            imageRepository.getComments(imageId)
                .onSuccess { response ->
                    _uiState.update { 
                        it.copy(
                            comments = response.comments,
                            isLoadingComments = false
                        ) 
                    }
                }
                .onFailure {
                    _uiState.update { it.copy(isLoadingComments = false) }
                }
        }
    }
    
    fun vote(type: String) {
        val imageId = _uiState.value.currentImageId
        if (imageId.isEmpty()) return
        
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
        val imageId = _uiState.value.currentImageId
        if (imageId.isEmpty()) return
        
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
    
    fun setCommentText(text: String) {
        _uiState.update { it.copy(commentText = text) }
    }
    
    fun setReplyingTo(comment: Comment?) {
        _uiState.update { it.copy(replyingTo = comment) }
    }
    
    fun postComment() {
        val imageId = _uiState.value.currentImageId
        val text = _uiState.value.commentText.trim()
        if (text.isBlank() || imageId.isEmpty()) return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isPostingComment = true) }
            
            val parentId = _uiState.value.replyingTo?.id
            
            imageRepository.postComment(imageId, text, parentId)
                .onSuccess { response ->
                    _uiState.update { 
                        it.copy(
                            commentText = "",
                            replyingTo = null,
                            comments = response.comments,
                            isPostingComment = false
                        ) 
                    }
                }
                .onFailure {
                    _uiState.update { it.copy(isPostingComment = false) }
                }
        }
    }
    
    fun cancelReply() {
        _uiState.update { it.copy(replyingTo = null) }
    }
    
    fun refresh() {
        val imageId = _uiState.value.currentImageId
        if (imageId.isNotEmpty()) {
            _uiState.update { it.copy(isLoading = true, error = null) }
            loadImageData(imageId)
        }
    }
}
