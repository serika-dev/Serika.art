package art.serika.app.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.model.LoginRequest
import art.serika.app.data.remote.SerikaApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val token: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false,
    val useApiKey: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val api: SerikaApi,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()
    
    fun setEmail(email: String) {
        _uiState.update { it.copy(email = email, error = null) }
    }
    
    fun setPassword(password: String) {
        _uiState.update { it.copy(password = password, error = null) }
    }
    
    fun setToken(token: String) {
        _uiState.update { it.copy(token = token, error = null) }
    }
    
    fun toggleAuthMethod() {
        _uiState.update { it.copy(useApiKey = !it.useApiKey, error = null) }
    }
    
    fun loginWithCredentials() {
        val email = _uiState.value.email.trim()
        val password = _uiState.value.password
        
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(error = "Email and password are required") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            try {
                // Use the proxy login endpoint on serika.art
                val response = api.login(
                    LoginRequest(
                        email = email,
                        password = password,
                        rememberMe = true
                    )
                )
                
                if (response.success && response.token != null) {
                    // Save the token
                    preferencesManager.setAuthToken(response.token)
                    
                    // Save user info if available
                    response.user?.let { user ->
                        preferencesManager.setUserInfo(
                            userId = user.id,
                            username = user.username,
                            avatarUrl = user.avatarUrl
                        )
                    }
                    
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
                    400 -> "Invalid email or password format"
                    401 -> "Invalid email or password"
                    403 -> "Account is disabled or banned"
                    404 -> "Account not found"
                    429 -> "Too many attempts. Please try again later"
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
                    401 -> "Invalid or expired API key"
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
    
    fun login() {
        if (_uiState.value.useApiKey) {
            loginWithApiKey()
        } else {
            loginWithCredentials()
        }
    }
}
