# Serika.art Authentication Setup

This document explains how Serika.art integrates with Serika Accounts for authentication.

## Architecture

Serika.art uses **Serika Accounts** (accounts.serika.dev) as its official authentication provider. As a trusted first-party Serika product, it uses internal service-to-service authentication rather than OAuth.

### Flow Overview

1. **User Login**: User visits `/login` on Serika.art
2. **Authentication**: User enters credentials → Serika Accounts verifies and creates session
3. **Token Exchange**: Serika.art receives session token and verifies it using internal API
4. **Session Storage**: Token is stored in HTTP-only cookie on Serika.art
5. **API Requests**: Protected API routes verify the token with Serika Accounts on each request

## Components

### Frontend

#### `/app/login/page.tsx`
Custom login page that:
- Displays login form
- Sends credentials to Serika Accounts `/api/auth/login`
- Receives session token
- Exchanges token via `/api/auth/exchange`
- Redirects to original destination

#### `/lib/AuthContext.tsx`
React context providing:
- `user`: Current user data
- `loading`: Authentication state
- `login(token)`: Store session token
- `logout()`: Clear session and redirect

#### `/components/Navbar.tsx`
Navigation component that:
- Shows login button when not authenticated
- Displays user profile when authenticated
- Provides logout functionality

### Backend

#### `/app/api/auth/exchange/route.ts`
Exchanges Serika Accounts token for local session:
```typescript
POST /api/auth/exchange
Body: { token: string }
```
1. Verifies token with `${ACCOUNTS_URL}/internal/verify`
2. Uses `X-Service-Key` header for authentication
3. Stores verified token in HTTP-only cookie
4. Returns user data

#### `/app/api/auth/me/route.ts`
Returns current user information:
```typescript
GET /api/auth/me
```
- Reads `session_token` from cookies
- Verifies with Serika Accounts
- Returns user data or 401

#### `/app/api/auth/logout/route.ts`
Logs out current user:
```typescript
POST /api/auth/logout
```
- Clears `session_token` and `user_info` cookies
- Returns success

#### `/lib/auth.ts`
Server-side authentication utilities:
- `getCurrentUser()`: Verify token and return user
- `requireAuth()`: Throw error if not authenticated

## Configuration

### Environment Variables

**Serika.art** (`.env.local`):
```env
ACCOUNTS_URL=https://accounts.serika.dev
ACCOUNTS_INTERNAL_KEY=0a9Gv3sKp8ZtQ2yLr6XfVw1Uo5NcJe4BhS9dRm7Yq6Cz2Pj8Ln3Wx0Tb5Ku1Hv
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.serika.dev
```

**Serika Accounts** (`.env`):
```env
AUTH_SERVICE_INTERNAL_KEY=0a9Gv3sKp8ZtQ2yLr6XfVw1Uo5NcJe4BhS9dRm7Yq6Cz2Pj8Ln3Wx0Tb5Ku1Hv
```

### Product Registration

Serika.art is registered in Serika Accounts config:
```typescript
// serika-accounts/src/config.ts
{
  id: 'serika-art',
  name: 'Serika.art',
  domain: 'serika.art',
  callbackUrl: 'https://serika.art/login',
  trusted: true, // Skip OAuth consent
}
```

## Internal API Endpoints

Serika Accounts provides internal endpoints for trusted services:

### POST `/internal/verify`
Verify a session token.

**Headers:**
- `X-Service-Key`: Internal service key

**Body:**
```json
{
  "token": "session_token_here",
  "checkBan": true
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "user@example.com",
    "avatar": "https://...",
    "isPremium": false,
    "isVerified": true,
    "isBanned": false
  },
  "session": {
    "expiresAt": "2025-01-07T...",
    "productId": "serika-art"
  }
}
```

## Security Features

### HTTP-Only Cookies
- Session tokens stored in HTTP-only cookies
- Not accessible via JavaScript
- Prevents XSS attacks

### Secure Token Verification
- All token verification done server-side
- Uses internal service key
- Direct communication between services

### CORS Protection
- Serika Accounts validates origin
- Only allowed domains can authenticate
- Credentials required for requests

### Session Management
- Tokens expire after 30 days (or per remember-me setting)
- Users can view/revoke active sessions
- Automatic cleanup of expired tokens

## User Experience

### Login Flow
1. User clicks "Login" in navbar
2. Redirected to `/login?returnUrl=/current/path`
3. Enters email and password
4. Submitted to Serika Accounts
5. On success, token exchanged
6. User redirected to original page

### Registration
- New users directed to `accounts.serika.dev/register`
- After registration, redirected back to Serika.art
- Email verification required

### Password Reset
- "Forgot Password" link opens `accounts.serika.dev/forgot-password`
- Email sent with reset link
- User completes reset on Accounts service

## Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Copy `.env.example` to `.env.local` and set:
   - `ACCOUNTS_URL`
   - `ACCOUNTS_INTERNAL_KEY`
   - `NEXT_PUBLIC_ACCOUNTS_URL`

3. **Start Serika Accounts** (separate terminal)
   ```bash
   cd serika-accounts
   bun install
   bun dev
   ```

4. **Start Serika.art**
   ```bash
   npm run dev
   ```

5. **Test Login**
   - Visit `http://localhost:3000`
   - Click "Login"
   - Enter credentials
   - Verify redirect and authentication

## Troubleshooting

### "Invalid token" error
- Check `ACCOUNTS_INTERNAL_KEY` matches in both services
- Verify token hasn't expired
- Check user isn't banned

### CORS errors
- Ensure origin is in `ALLOWED_DOMAINS` (config.ts)
- Verify `credentials: 'include'` in fetch requests
- Check CORS headers in Serika Accounts

### Session not persisting
- Verify cookies are being set (check DevTools → Application → Cookies)
- Check `httpOnly` and `secure` flags
- Ensure `sameSite: 'lax'` for cross-domain

## API Routes Reference

### Protected Routes
These routes require authentication:
- `POST /api/upload`
- `POST /api/vote`
- `POST /api/favorite`
- `DELETE /api/images/[id]`

### Public Routes
- `GET /api/images` (list images)
- `GET /api/images/[id]` (view image)
- `GET /api/tags` (search tags)
- `GET /api/users/[id]` (view user profile)

## Future Enhancements

- [ ] OAuth2 flow for third-party apps
- [ ] Social login (Discord, Google)
- [ ] Two-factor authentication
- [ ] Session device management
- [ ] Login activity log
