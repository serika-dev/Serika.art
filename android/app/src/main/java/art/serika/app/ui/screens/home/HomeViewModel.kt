package art.serika.app.ui.screens.home

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import art.serika.app.data.local.PreferencesManager
import art.serika.app.data.model.Image
import art.serika.app.data.model.Tag
import art.serika.app.data.repository.DownloadRepository
import art.serika.app.data.repository.ImageRepository
import art.serika.app.data.repository.TagRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

// Query-related state that triggers data refetch
data class HomeQueryState(
    val sort: String = "newest",
    val selectedRatings: List<String> = listOf("safe"),
    val hideAI: Boolean = false,
    val aiOnly: Boolean = false,
    val selectedTags: List<Tag> = emptyList()
)

@OptIn(ExperimentalCoroutinesApi::class)
data class HomeUiState(
    val sort: String = "newest",
    val selectedRatings: List<String> = listOf("safe"),
    val hideAI: Boolean = false,
    val aiOnly: Boolean = false,
    val isRefreshing: Boolean = false,
    val selectedTags: List<Tag> = emptyList(),
    val tagQuery: String = "",
    val tagSuggestions: List<Tag> = emptyList(),
    // Mass selection
    val isSelectionMode: Boolean = false,
    val selectedImages: Set<String> = emptySet(), // Image IDs
    val selectedImageData: Map<String, Image> = emptyMap(), // Full image data for actions
    val isBatchActionInProgress: Boolean = false,
    val batchActionMessage: String? = null
) {
    val hasActiveFilters: Boolean
        get() = hideAI || aiOnly || selectedRatings != listOf("safe") || selectedTags.isNotEmpty()
    
    val activeFilterCount: Int
        get() {
            var count = selectedTags.size
            if (hideAI) count++
            if (aiOnly) count++
            if (selectedRatings.contains("questionable")) count++
            if (selectedRatings.contains("explicit")) count++
            if (!selectedRatings.contains("safe")) count++
            return count
        }
    
    val selectedCount: Int
        get() = selectedImages.size
    
    // Extract query-relevant state for comparison
    val queryState: HomeQueryState
        get() = HomeQueryState(
            sort = sort,
            selectedRatings = selectedRatings,
            hideAI = hideAI,
            aiOnly = aiOnly,
            selectedTags = selectedTags
        )
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val imageRepository: ImageRepository,
    private val tagRepository: TagRepository,
    private val downloadRepository: DownloadRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()
    
    private val refreshTrigger = MutableStateFlow(0)
    
    // Only listen to query-relevant state changes to avoid unnecessary refreshes
    // when selection state changes
    @OptIn(ExperimentalCoroutinesApi::class)
    val images: Flow<PagingData<Image>> = combine(
        _uiState.map { it.queryState }.distinctUntilChanged(),
        refreshTrigger
    ) { queryState, _ -> queryState }
        .flatMapLatest { queryState ->
            imageRepository.getImagesPaged(
                tags = queryState.selectedTags.map { it.name }.takeIf { it.isNotEmpty() },
                ratings = queryState.selectedRatings.takeIf { it.isNotEmpty() },
                sort = queryState.sort,
                hideAI = queryState.hideAI.takeIf { it },
                aiOnly = queryState.aiOnly.takeIf { it }
            )
        }
        .cachedIn(viewModelScope)
    
    @OptIn(FlowPreview::class)
    private val tagSuggestionsFlow = _uiState
        .map { it.tagQuery }
        .distinctUntilChanged()
        .debounce(300)
        .filter { it.length >= 2 }
        .mapLatest { query ->
            tagRepository.searchTags(query, limit = 10)
                .getOrNull() ?: emptyList()
        }
    
    init {
        // Load preferences
        viewModelScope.launch {
            preferencesManager.ratingPreferences.collect { prefs ->
                val ratings = buildList {
                    if (prefs.showSafe) add("safe")
                    if (prefs.showQuestionable) add("questionable")
                    if (prefs.showExplicit) add("explicit")
                }
                _uiState.update { it.copy(selectedRatings = ratings.ifEmpty { listOf("safe") }) }
            }
        }
        viewModelScope.launch {
            preferencesManager.hideAI.collect { hide ->
                _uiState.update { it.copy(hideAI = hide) }
            }
        }
        viewModelScope.launch {
            tagSuggestionsFlow.collect { tags ->
                _uiState.update { it.copy(tagSuggestions = tags) }
            }
        }
    }
    
    fun setSort(sort: String) {
        _uiState.update { it.copy(sort = sort) }
    }
    
    fun setTagQuery(query: String) {
        _uiState.update { it.copy(tagQuery = query) }
    }
    
    fun addTag(tag: Tag) {
        if (!_uiState.value.selectedTags.any { it.name == tag.name }) {
            _uiState.update { 
                it.copy(
                    selectedTags = it.selectedTags + tag,
                    tagQuery = "",
                    tagSuggestions = emptyList()
                )
            }
        }
    }
    
    fun removeTag(tagName: String) {
        _uiState.update { 
            it.copy(selectedTags = it.selectedTags.filter { t -> t.name != tagName })
        }
    }
    
    fun clearTagSuggestions() {
        _uiState.update { it.copy(tagSuggestions = emptyList()) }
    }
    
    fun toggleRating(rating: String, enabled: Boolean) {
        _uiState.update { state ->
            val newRatings = if (enabled) {
                state.selectedRatings + rating
            } else {
                state.selectedRatings - rating
            }
            // Ensure at least one rating is selected
            state.copy(selectedRatings = newRatings.ifEmpty { listOf("safe") })
        }
        // Save to preferences
        viewModelScope.launch {
            val state = _uiState.value
            preferencesManager.setRatingPreferences(
                safe = state.selectedRatings.contains("safe"),
                questionable = state.selectedRatings.contains("questionable"),
                explicit = state.selectedRatings.contains("explicit")
            )
        }
    }
    
    fun setHideAI(hide: Boolean) {
        _uiState.update { it.copy(hideAI = hide, aiOnly = if (hide) false else it.aiOnly) }
        viewModelScope.launch {
            preferencesManager.setHideAI(hide)
        }
    }
    
    fun setAIOnly(aiOnly: Boolean) {
        _uiState.update { it.copy(aiOnly = aiOnly, hideAI = if (aiOnly) false else it.hideAI) }
    }
    
    fun clearFilters() {
        _uiState.update { 
            it.copy(
                selectedRatings = listOf("safe"),
                hideAI = false,
                aiOnly = false,
                selectedTags = emptyList(),
                tagQuery = "",
                tagSuggestions = emptyList()
            ) 
        }
        viewModelScope.launch {
            preferencesManager.setRatingPreferences(safe = true, questionable = false, explicit = false)
            preferencesManager.setHideAI(false)
        }
    }
    
    fun refresh() {
        refreshTrigger.value++
    }
    
    // ===== Mass Selection =====
    
    fun enterSelectionMode(image: Image) {
        val imageId = image.sequentialId?.toString() ?: image.id
        _uiState.update { 
            it.copy(
                isSelectionMode = true,
                selectedImages = setOf(imageId),
                selectedImageData = mapOf(imageId to image)
            ) 
        }
    }
    
    fun toggleImageSelection(image: Image) {
        val imageId = image.sequentialId?.toString() ?: image.id
        _uiState.update { state ->
            val newSelected = if (state.selectedImages.contains(imageId)) {
                state.selectedImages - imageId
            } else {
                state.selectedImages + imageId
            }
            val newImageData = if (newSelected.contains(imageId)) {
                state.selectedImageData + (imageId to image)
            } else {
                state.selectedImageData - imageId
            }
            
            // Exit selection mode if no images selected
            if (newSelected.isEmpty()) {
                state.copy(
                    isSelectionMode = false,
                    selectedImages = emptySet(),
                    selectedImageData = emptyMap()
                )
            } else {
                state.copy(
                    selectedImages = newSelected,
                    selectedImageData = newImageData
                )
            }
        }
    }
    
    fun isImageSelected(image: Image): Boolean {
        val imageId = image.sequentialId?.toString() ?: image.id
        return _uiState.value.selectedImages.contains(imageId)
    }
    
    fun exitSelectionMode() {
        _uiState.update { 
            it.copy(
                isSelectionMode = false,
                selectedImages = emptySet(),
                selectedImageData = emptyMap(),
                batchActionMessage = null
            ) 
        }
    }
    
    fun selectAll(images: List<Image>) {
        _uiState.update { state ->
            val newSelected = state.selectedImages + images.map { it.sequentialId?.toString() ?: it.id }
            val newImageData = state.selectedImageData + images.associateBy { it.sequentialId?.toString() ?: it.id }
            state.copy(
                selectedImages = newSelected,
                selectedImageData = newImageData
            )
        }
    }
    
    fun massUpvote() {
        val selectedImages = _uiState.value.selectedImages.toList()
        if (selectedImages.isEmpty()) return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isBatchActionInProgress = true, batchActionMessage = "Upvoting...") }
            
            var success = 0
            var failed = 0
            
            selectedImages.forEach { imageId ->
                imageRepository.vote(imageId, "upvote")
                    .onSuccess { success++ }
                    .onFailure { failed++ }
            }
            
            _uiState.update { 
                it.copy(
                    isBatchActionInProgress = false,
                    batchActionMessage = "Upvoted $success images" + if (failed > 0) " ($failed failed)" else ""
                ) 
            }
        }
    }
    
    fun massFavorite() {
        val selectedImages = _uiState.value.selectedImages.toList()
        if (selectedImages.isEmpty()) return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isBatchActionInProgress = true, batchActionMessage = "Favoriting...") }
            
            var success = 0
            var failed = 0
            
            selectedImages.forEach { imageId ->
                imageRepository.toggleFavorite(imageId)
                    .onSuccess { success++ }
                    .onFailure { failed++ }
            }
            
            _uiState.update { 
                it.copy(
                    isBatchActionInProgress = false,
                    batchActionMessage = "Favorited $success images" + if (failed > 0) " ($failed failed)" else ""
                ) 
            }
        }
    }
    
    fun massDownload() {
        val selectedImageData = _uiState.value.selectedImageData.values.toList()
        if (selectedImageData.isEmpty()) return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isBatchActionInProgress = true, batchActionMessage = "Downloading...") }
            
            var success = 0
            var failed = 0
            
            selectedImageData.forEach { image ->
                val filename = "serika_${image.sequentialId ?: image.id.takeLast(8)}.${getExtension(image.url)}"
                downloadRepository.downloadImage(image.url, filename)
                    .onSuccess { success++ }
                    .onFailure { failed++ }
            }
            
            _uiState.update { 
                it.copy(
                    isBatchActionInProgress = false,
                    batchActionMessage = "Downloaded $success images to Pictures/Serika.art" + if (failed > 0) " ($failed failed)" else ""
                ) 
            }
        }
    }
    
    private fun getExtension(url: String): String {
        return when {
            url.contains(".png", ignoreCase = true) -> "png"
            url.contains(".gif", ignoreCase = true) -> "gif"
            url.contains(".webp", ignoreCase = true) -> "webp"
            else -> "jpg"
        }
    }
    
    fun clearBatchMessage() {
        _uiState.update { it.copy(batchActionMessage = null) }
    }
}
