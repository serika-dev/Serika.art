package art.serika.app.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.remote.SerikaApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val username: String = "",
    val password: String = "",
    val token: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val api: SerikaApi,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()
    
    fun setUsername(username: String) {
        _uiState.update { it.copy(username = username, error = null) }
    }
    
    fun setPassword(password: String) {
        _uiState.update { it.copy(password = password, error = null) }
    }
    
    fun setToken(token: String) {
        _uiState.update { it.copy(token = token, error = null) }
    }
    
    fun loginWithCredentials() {
        val username = _uiState.value.username.trim()
        val password = _uiState.value.password
        
        if (username.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(error = "Username and password are required") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            try {
                val response = api.login(
                    mapOf(
                        "username" to username,
                        "password" to password
                    )
                )
                
                if (response.token != null) {
                    preferencesManager.setAuthToken(response.token)
                    _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                } else {
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = response.error ?: "Login failed"
                        ) 
                    }
                }
            } catch (e: retrofit2.HttpException) {
                val errorMessage = when (e.code()) {
                    401 -> "Invalid username or password"
                    403 -> "Account is disabled"
                    404 -> "User not found"
                    429 -> "Too many login attempts. Please try again later"
                    else -> "Login failed: ${e.message()}"
                }
                _uiState.update { it.copy(isLoading = false, error = errorMessage) }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false, 
                        error = "Network error. Please check your connection."
                    ) 
                }
            }
        }
    }
    
    fun loginWithApiKey() {
        val token = _uiState.value.token.trim()
        
        if (token.isBlank()) {
            _uiState.update { it.copy(error = "API key is required") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            try {
                // Verify the token by making a request to /auth/me
                val response = api.getCurrentUser("Bearer $token")
                
                if (response.user != null) {
                    // Token is valid, save it
                    preferencesManager.setAuthToken(token)
                    _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                } else {
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = response.error ?: "Invalid API key"
                        ) 
                    }
                }
            } catch (e: retrofit2.HttpException) {
                val errorMessage = when (e.code()) {
                    401 -> "Invalid API key"
                    403 -> "API key has been revoked"
                    else -> "Verification failed: ${e.message()}"
                }
                _uiState.update { it.copy(isLoading = false, error = errorMessage) }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(
                        isLoading = false, 
                        error = "Network error. Please check your connection."
                    ) 
                }
            }
        }
    }
}
