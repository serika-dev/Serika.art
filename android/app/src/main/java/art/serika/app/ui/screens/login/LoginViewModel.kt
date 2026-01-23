package art.serika.app.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val token: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()
    
    fun setToken(token: String) {
        _uiState.update { it.copy(token = token, error = null) }
    }
    
    fun login() {
        val token = _uiState.value.token.trim()
        if (token.isBlank()) {
            _uiState.update { it.copy(error = "Please enter a token") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            try {
                // Save the token
                authRepository.setAuthToken(token)
                
                // Try to get current user to verify token
                val result = authRepository.getCurrentUser()
                
                result.fold(
                    onSuccess = { user ->
                        if (user != null) {
                            _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                        } else {
                            authRepository.logout()
                            _uiState.update { 
                                it.copy(
                                    isLoading = false, 
                                    error = "Invalid token. Please try again."
                                ) 
                            }
                        }
                    },
                    onFailure = { e ->
                        authRepository.logout()
                        _uiState.update { 
                            it.copy(
                                isLoading = false, 
                                error = "Failed to verify token: ${e.message}"
                            ) 
                        }
                    }
                )
            } catch (e: Exception) {
                authRepository.logout()
                _uiState.update { 
                    it.copy(
                        isLoading = false, 
                        error = "An error occurred: ${e.message}"
                    ) 
                }
            }
        }
    }
}
