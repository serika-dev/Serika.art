package art.serika.app.data.remote

import kotlinx.serialization.Serializable
import retrofit2.http.*

/**
 * API interface for Serika Accounts authentication service
 */
interface SerikaAccountsApi {
    
    @POST("api/auth/login")
    suspend fun login(
        @Body request: AccountsLoginRequest
    ): AccountsLoginResponse
    
    @POST("api/auth/register")
    suspend fun register(
        @Body request: AccountsRegisterRequest
    ): AccountsLoginResponse
}

@Serializable
data class AccountsLoginRequest(
    val email: String,
    val password: String,
    val rememberMe: Boolean = true,
    val productId: String = "serika-art"
)

@Serializable
data class AccountsRegisterRequest(
    val username: String,
    val email: String,
    val password: String,
    val productId: String = "serika-art"
)

@Serializable
data class AccountsLoginResponse(
    val success: Boolean,
    val token: String? = null,
    val user: AccountsUser? = null,
    val error: String? = null,
    val message: String? = null
)

@Serializable
data class AccountsUser(
    val id: String,
    val username: String,
    val email: String,
    val avatar: String? = null
)
