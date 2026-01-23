package art.serika.app

import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.repository.UpdateInfo
import art.serika.app.data.repository.UpdateRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MainUiState(
    val showFirstLaunchDialog: Boolean = false,
    val showUpdateDialog: Boolean = false,
    val updateInfo: UpdateInfo? = null,
    val isCheckingUpdate: Boolean = false,
    val currentChannel: String = "stable"
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val preferencesManager: PreferencesManager,
    private val updateRepository: UpdateRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()
    
    init {
        checkFirstLaunch()
    }
    
    private fun checkFirstLaunch() {
        viewModelScope.launch {
            val isFirstLaunch = preferencesManager.isFirstLaunch.first()
            val currentChannel = preferencesManager.releaseChannel.first()
            
            _uiState.update { it.copy(currentChannel = currentChannel) }
            
            if (isFirstLaunch) {
                _uiState.update { it.copy(showFirstLaunchDialog = true) }
            } else {
                // Not first launch, check for updates
                checkForUpdates()
            }
        }
    }
    
    fun setReleaseChannel(channel: String) {
        viewModelScope.launch {
            preferencesManager.setReleaseChannel(channel)
            preferencesManager.setFirstLaunch(false)
            _uiState.update { 
                it.copy(
                    showFirstLaunchDialog = false,
                    currentChannel = channel
                ) 
            }
            // Now check for updates with the selected channel
            checkForUpdates()
        }
    }
    
    fun dismissFirstLaunchDialog() {
        viewModelScope.launch {
            preferencesManager.setFirstLaunch(false)
            _uiState.update { it.copy(showFirstLaunchDialog = false) }
            checkForUpdates()
        }
    }
    
    private fun checkForUpdates() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCheckingUpdate = true) }
            
            val updateInfo = updateRepository.checkForUpdate()
            
            if (updateInfo != null) {
                // Check if this version was skipped
                val skippedVersion = preferencesManager.skippedVersion.first()
                if (skippedVersion != updateInfo.versionName) {
                    _uiState.update { 
                        it.copy(
                            showUpdateDialog = true,
                            updateInfo = updateInfo,
                            isCheckingUpdate = false
                        ) 
                    }
                } else {
                    _uiState.update { it.copy(isCheckingUpdate = false) }
                }
            } else {
                _uiState.update { it.copy(isCheckingUpdate = false) }
            }
        }
    }
    
    fun dismissUpdateDialog() {
        _uiState.update { it.copy(showUpdateDialog = false) }
    }
    
    fun skipThisVersion() {
        viewModelScope.launch {
            _uiState.value.updateInfo?.let { info ->
                preferencesManager.setSkippedVersion(info.versionName)
            }
            _uiState.update { it.copy(showUpdateDialog = false) }
        }
    }
    
    fun getDownloadIntent(): Intent? {
        return _uiState.value.updateInfo?.downloadUrl?.let { url ->
            Intent(Intent.ACTION_VIEW, Uri.parse(url))
        }
    }
}
