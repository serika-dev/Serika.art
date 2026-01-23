package art.serika.app.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val isLoggedIn: Boolean = false,
    val username: String? = null,
    val avatarUrl: String? = null,
    val showSafe: Boolean = true,
    val showQuestionable: Boolean = false,
    val showExplicit: Boolean = false,
    val hideAI: Boolean = false,
    val themeMode: String = "system",
    val gridColumns: Int = 2
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val preferencesManager: PreferencesManager,
    private val authRepository: AuthRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()
    
    init {
        // Collect user info
        viewModelScope.launch {
            authRepository.userInfo.collect { userInfo ->
                _uiState.update {
                    it.copy(
                        isLoggedIn = userInfo.userId != null,
                        username = userInfo.username,
                        avatarUrl = userInfo.avatarUrl
                    )
                }
            }
        }
        
        // Collect rating preferences
        viewModelScope.launch {
            preferencesManager.ratingPreferences.collect { prefs ->
                _uiState.update {
                    it.copy(
                        showSafe = prefs.showSafe,
                        showQuestionable = prefs.showQuestionable,
                        showExplicit = prefs.showExplicit
                    )
                }
            }
        }
        
        // Collect other preferences
        viewModelScope.launch {
            preferencesManager.hideAI.collect { hide ->
                _uiState.update { it.copy(hideAI = hide) }
            }
        }
        
        viewModelScope.launch {
            preferencesManager.themeMode.collect { mode ->
                _uiState.update { it.copy(themeMode = mode) }
            }
        }
        
        viewModelScope.launch {
            preferencesManager.gridColumns.collect { columns ->
                _uiState.update { it.copy(gridColumns = columns) }
            }
        }
    }
    
    fun setRatingPreferences(safe: Boolean, questionable: Boolean, explicit: Boolean) {
        viewModelScope.launch {
            preferencesManager.setRatingPreferences(safe, questionable, explicit)
        }
    }
    
    fun setHideAI(hide: Boolean) {
        viewModelScope.launch {
            preferencesManager.setHideAI(hide)
        }
    }
    
    fun setThemeMode(mode: String) {
        viewModelScope.launch {
            preferencesManager.setThemeMode(mode)
        }
    }
    
    fun setGridColumns(columns: Int) {
        viewModelScope.launch {
            preferencesManager.setGridColumns(columns)
        }
    }
    
    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }
}
