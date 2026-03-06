package art.serika.app.data.repository

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

data class LocalImage(
    val id: Long,
    val uri: Uri,
    val name: String,
    val path: String,
    val dateAdded: Long,
    val size: Long,
    val width: Int,
    val height: Int
)

@Singleton
class LocalImagesRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    
    /**
     * Get all images from the Serika.art folder
     */
    suspend fun getLocalImages(): List<LocalImage> = withContext(Dispatchers.IO) {
        val images = mutableListOf<LocalImage>()
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Use MediaStore for Android 10+
            getImagesFromMediaStore(images)
        } else {
            // Direct file access for older versions
            getImagesFromFile(images)
        }
        
        images.sortedByDescending { it.dateAdded }
    }
    
    private fun getImagesFromMediaStore(images: MutableList<LocalImage>) {
        val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        
        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATA,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.SIZE,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT
        )
        
        // Filter for Serika.art folder
        val selection = "${MediaStore.Images.Media.RELATIVE_PATH} LIKE ?"
        val selectionArgs = arrayOf("%Serika.art%")
        
        val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"
        
        context.contentResolver.query(
            collection,
            projection,
            selection,
            selectionArgs,
            sortOrder
        )?.use { cursor ->
            val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
            val pathColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA)
            val dateColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)
            val sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)
            val widthColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)
            val heightColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)
            
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idColumn)
                val name = cursor.getString(nameColumn)
                val path = cursor.getString(pathColumn)
                val dateAdded = cursor.getLong(dateColumn)
                val size = cursor.getLong(sizeColumn)
                val width = cursor.getInt(widthColumn)
                val height = cursor.getInt(heightColumn)
                
                val contentUri = ContentUris.withAppendedId(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    id
                )
                
                images.add(
                    LocalImage(
                        id = id,
                        uri = contentUri,
                        name = name,
                        path = path,
                        dateAdded = dateAdded,
                        size = size,
                        width = width,
                        height = height
                    )
                )
            }
        }
    }
    
    private fun getImagesFromFile(images: MutableList<LocalImage>) {
        val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
        val serikaDir = File(picturesDir, "Serika.art")
        
        if (!serikaDir.exists() || !serikaDir.isDirectory) {
            return
        }
        
        serikaDir.listFiles()?.filter { file ->
            file.isFile && file.extension.lowercase() in listOf("jpg", "jpeg", "png", "gif", "webp")
        }?.forEach { file ->
            images.add(
                LocalImage(
                    id = file.absolutePath.hashCode().toLong(),
                    uri = Uri.fromFile(file),
                    name = file.name,
                    path = file.absolutePath,
                    dateAdded = file.lastModified() / 1000,
                    size = file.length(),
                    width = 0,
                    height = 0
                )
            )
        }
    }
    
    /**
     * Delete a local image
     */
    suspend fun deleteImage(image: LocalImage): Boolean = withContext(Dispatchers.IO) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                context.contentResolver.delete(image.uri, null, null) > 0
            } else {
                File(image.path).delete()
            }
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * Get count of local images
     */
    suspend fun getImageCount(): Int = withContext(Dispatchers.IO) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            val selection = "${MediaStore.Images.Media.RELATIVE_PATH} LIKE ?"
            val selectionArgs = arrayOf("%Serika.art%")
            
            context.contentResolver.query(
                collection,
                arrayOf(MediaStore.Images.Media._ID),
                selection,
                selectionArgs,
                null
            )?.use { cursor ->
                cursor.count
            } ?: 0
        } else {
            val picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
            val serikaDir = File(picturesDir, "Serika.art")
            serikaDir.listFiles()?.count { file ->
                file.isFile && file.extension.lowercase() in listOf("jpg", "jpeg", "png", "gif", "webp")
            } ?: 0
        }
    }
}
