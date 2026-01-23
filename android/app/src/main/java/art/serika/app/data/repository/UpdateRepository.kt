package art.serika.app.data.repository

import art.serika.app.BuildConfig
import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.remote.GitHubApi
import art.serika.app.data.remote.GitHubRelease
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UpdateRepository @Inject constructor(
    private val gitHubApi: GitHubApi,
    private val preferencesManager: PreferencesManager
) {
    companion object {
        const val GITHUB_OWNER = "serika-dev"
        const val GITHUB_REPO = "Serika.art"
    }
    
    suspend fun checkForUpdate(): UpdateInfo? {
        return try {
            val releaseChannel = preferencesManager.releaseChannel.first()
            val releases = gitHubApi.getAllReleases(GITHUB_OWNER, GITHUB_REPO)
            
            val targetRelease = when (releaseChannel) {
                "beta" -> releases.firstOrNull { !it.draft }
                else -> releases.firstOrNull { !it.draft && !it.prerelease }
            }
            
            if (targetRelease == null) return null
            
            val latestVersion = targetRelease.tagName.removePrefix("v")
            val currentVersion = BuildConfig.VERSION_NAME
            
            if (isNewerVersion(latestVersion, currentVersion)) {
                val apkAsset = targetRelease.assets.find { 
                    it.name.endsWith(".apk") 
                }
                
                UpdateInfo(
                    versionName = latestVersion,
                    tagName = targetRelease.tagName,
                    releaseNotes = targetRelease.body ?: "",
                    downloadUrl = apkAsset?.downloadUrl ?: targetRelease.htmlUrl,
                    htmlUrl = targetRelease.htmlUrl,
                    isPreRelease = targetRelease.prerelease
                )
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
    
    private fun isNewerVersion(latest: String, current: String): Boolean {
        val latestParts = latest.split(".").mapNotNull { it.toIntOrNull() }
        val currentParts = current.split(".").mapNotNull { it.toIntOrNull() }
        
        for (i in 0 until maxOf(latestParts.size, currentParts.size)) {
            val latestPart = latestParts.getOrElse(i) { 0 }
            val currentPart = currentParts.getOrElse(i) { 0 }
            
            if (latestPart > currentPart) return true
            if (latestPart < currentPart) return false
        }
        return false
    }
}

data class UpdateInfo(
    val versionName: String,
    val versionCode: Int = 0,
    val tagName: String,
    val releaseNotes: String,
    val downloadUrl: String,
    val htmlUrl: String,
    val isPreRelease: Boolean
)
