package art.serika.app.ui.screens.profile

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import art.serika.app.data.model.Image
import art.serika.app.data.model.User
import art.serika.app.data.repository.AuthRepository
import art.serika.app.data.repository.ImageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val isLoading: Boolean = true,
    val user: User? = null,
    val error: String? = null
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val authRepository: AuthRepository,
    private val imageRepository: ImageRepository
) : ViewModel() {
    
    private val username: String = checkNotNull(savedStateHandle["username"])
    
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()
    
    val userImages: Flow<PagingData<Image>> = imageRepository.getImagesPaged(
        username = username
    ).cachedIn(viewModelScope)
    
    init {
        loadUser()
    }
    
    private fun loadUser() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            authRepository.getUser(username)
                .onSuccess { response ->
                    if (response.success && response.user != null) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                user = response.user
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                error = response.error ?: "User not found"
                            )
                        }
                    }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = e.localizedMessage ?: "Failed to load user"
                        )
                    }
                }
        }
    }
    
    fun refresh() {
        loadUser()
    }
}
