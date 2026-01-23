package art.serika.app.data.repository

import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DownloadRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    
    /**
     * Download an image to the Serika.art folder in Pictures
     */
    suspend fun downloadImage(imageUrl: String, filename: String): Result<Uri> = withContext(Dispatchers.IO) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Use MediaStore for Android 10+
                downloadWithMediaStore(imageUrl, filename)
            } else {
                // Use DownloadManager for older versions
                downloadWithDownloadManager(imageUrl, filename)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private suspend fun downloadWithMediaStore(imageUrl: String, filename: String): Result<Uri> = withContext(Dispatchers.IO) {
        try {
            val url = URL(imageUrl)
            val connection = url.openConnection()
            connection.connect()
            val inputStream = connection.getInputStream()
            
            val contentValues = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, filename)
                put(MediaStore.Images.Media.MIME_TYPE, getMimeType(filename))
                put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/Serika.art")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
            
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
                ?: return@withContext Result.failure(Exception("Failed to create MediaStore entry"))
            
            resolver.openOutputStream(uri)?.use { outputStream ->
                inputStream.copyTo(outputStream)
            }
            
            contentValues.clear()
            contentValues.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(uri, contentValues, null, null)
            
            inputStream.close()
            
            Result.success(uri)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun downloadWithDownloadManager(imageUrl: String, filename: String): Result<Uri> {
        return try {
            // Create Serika.art directory
            val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
            val serikaDir = File(picturesDir, "Serika.art")
            if (!serikaDir.exists()) {
                serikaDir.mkdirs()
            }
            
            val request = DownloadManager.Request(Uri.parse(imageUrl))
                .setTitle(filename)
                .setDescription("Downloading from Serika.art")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir("${Environment.DIRECTORY_PICTURES}/Serika.art", filename)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
            
            val downloadId = downloadManager.enqueue(request)
            
            // Return a content URI pointing to the file
            Result.success(Uri.fromFile(File(serikaDir, filename)))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun getMimeType(filename: String): String {
        return when {
            filename.endsWith(".png", ignoreCase = true) -> "image/png"
            filename.endsWith(".gif", ignoreCase = true) -> "image/gif"
            filename.endsWith(".webp", ignoreCase = true) -> "image/webp"
            else -> "image/jpeg"
        }
    }
}
