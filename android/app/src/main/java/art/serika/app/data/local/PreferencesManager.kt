package art.serika.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "serika_preferences")

@Singleton
class PreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.dataStore
    
    companion object {
        private val AUTH_TOKEN = stringPreferencesKey("auth_token")
        private val USER_ID = stringPreferencesKey("user_id")
        private val USERNAME = stringPreferencesKey("username")
        private val AVATAR_URL = stringPreferencesKey("avatar_url")
        private val SHOW_SAFE = booleanPreferencesKey("show_safe")
        private val SHOW_QUESTIONABLE = booleanPreferencesKey("show_questionable")
        private val SHOW_EXPLICIT = booleanPreferencesKey("show_explicit")
        private val HIDE_AI = booleanPreferencesKey("hide_ai")
        private val THEME_MODE = stringPreferencesKey("theme_mode")
        private val GRID_COLUMNS = intPreferencesKey("grid_columns")
    }
    
    // Auth token
    val authToken: Flow<String?> = dataStore.data
        .catch { if (it is IOException) emit(emptyPreferences()) else throw it }
        .map { it[AUTH_TOKEN] }
    
    suspend fun setAuthToken(token: String?) {
        dataStore.edit { 
            if (token != null) it[AUTH_TOKEN] = token 
            else it.remove(AUTH_TOKEN)
        }
    }
    
    // User info
    data class UserInfo(
        val userId: String?,
        val username: String?,
        val avatarUrl: String?
    )
    
    val userInfo: Flow<UserInfo> = dataStore.data
        .catch { if (it is IOException) emit(emptyPreferences()) else throw it }
        .map { prefs ->
            UserInfo(
                userId = prefs[USER_ID],
                username = prefs[USERNAME],
                avatarUrl = prefs[AVATAR_URL]
            )
        }
    
    suspend fun setUserInfo(userId: String?, username: String?, avatarUrl: String?) {
        dataStore.edit { prefs ->
            if (userId != null) prefs[USER_ID] = userId else prefs.remove(USER_ID)
            if (username != null) prefs[USERNAME] = username else prefs.remove(USERNAME)
            if (avatarUrl != null) prefs[AVATAR_URL] = avatarUrl else prefs.remove(AVATAR_URL)
        }
    }
    
    suspend fun clearUserData() {
        dataStore.edit { prefs ->
            prefs.remove(AUTH_TOKEN)
            prefs.remove(USER_ID)
            prefs.remove(USERNAME)
            prefs.remove(AVATAR_URL)
        }
    }
    
    // Rating preferences
    data class RatingPreferences(
        val showSafe: Boolean = true,
        val showQuestionable: Boolean = false,
        val showExplicit: Boolean = false
    )
    
    val ratingPreferences: Flow<RatingPreferences> = dataStore.data
        .catch { if (it is IOException) emit(emptyPreferences()) else throw it }
        .map { prefs ->
            RatingPreferences(
                showSafe = prefs[SHOW_SAFE] ?: true,
                showQuestionable = prefs[SHOW_QUESTIONABLE] ?: false,
                showExplicit = prefs[SHOW_EXPLICIT] ?: false
            )
        }
    
    suspend fun setRatingPreferences(safe: Boolean, questionable: Boolean, explicit: Boolean) {
        dataStore.edit { prefs ->
            prefs[SHOW_SAFE] = safe
            prefs[SHOW_QUESTIONABLE] = questionable
            prefs[SHOW_EXPLICIT] = explicit
        }
    }
    
    // Hide AI preference
    val hideAI: Flow<Boolean> = dataStore.data
        .catch { if (it is IOException) emit(emptyPreferences()) else throw it }
        .map { it[HIDE_AI] ?: false }
    
    suspend fun setHideAI(hide: Boolean) {
        dataStore.edit { it[HIDE_AI] = hide }
    }
    
    // Theme mode
    val themeMode: Flow<String> = dataStore.data
        .catch { if (it is IOException) emit(emptyPreferences()) else throw it }
        .map { it[THEME_MODE] ?: "system" }
    
    suspend fun setThemeMode(mode: String) {
        dataStore.edit { it[THEME_MODE] = mode }
    }
    
    // Grid columns
    val gridColumns: Flow<Int> = dataStore.data
        .catch { if (it is IOException) emit(emptyPreferences()) else throw it }
        .map { it[GRID_COLUMNS] ?: 2 }
    
    suspend fun setGridColumns(columns: Int) {
        dataStore.edit { it[GRID_COLUMNS] = columns }
    }
}
