package art.serika.app.data.repository

import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.model.User
import art.serika.app.data.model.UserResponse
import art.serika.app.data.remote.SerikaApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: SerikaApi,
    private val preferencesManager: PreferencesManager
) {
    val authToken: Flow<String?> = preferencesManager.authToken
    val userInfo: Flow<PreferencesManager.UserInfo> = preferencesManager.userInfo
    
    suspend fun isLoggedIn(): Boolean {
        return preferencesManager.authToken.first() != null
    }
    
    suspend fun getCurrentUser(): Result<User?> {
        return try {
            val response = api.getCurrentUser()
            if (response.success && response.user != null) {
                // Update local user info
                preferencesManager.setUserInfo(
                    userId = response.user.id,
                    username = response.user.username,
                    avatarUrl = response.user.avatarUrl
                )
                Result.success(response.user)
            } else {
                Result.success(null)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getUser(username: String): Result<UserResponse> {
        return try {
            Result.success(api.getUser(username))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun setAuthToken(token: String) {
        preferencesManager.setAuthToken(token)
    }
    
    suspend fun logout() {
        try {
            api.logout()
        } catch (_: Exception) {
            // Ignore logout API errors
        }
        preferencesManager.clearUserData()
    }
}
