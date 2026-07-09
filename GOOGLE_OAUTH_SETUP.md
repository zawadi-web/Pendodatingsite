# Google OAuth Setup Guide

## What's New?
Your forgot password page now supports **Google Sign-In**. Users can reset their password using their Google account instead of email.

## How to Run

```bash
npm run dev
```

Open: http://localhost:3000

## Setting Up Google OAuth

### 1. Create a Google Cloud Project
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Select the client’s existing Google Cloud project
- If no project exists, click **New Project** and name it `Pendo Dating`

### 2. Configure OAuth consent screen
- In the left menu, go to **APIs & Services** > **OAuth consent screen**
- Choose **External** and continue
- Fill in:
  - **App name:** `Pendo Dating`
  - **User support email:** `client-email@example.com`
  - **Developer contact email:** `client-email@example.com`
- Under Scopes, add:
  - `email`
  - `profile`
  - `openid`
- Save and continue
- If the app is in testing mode, add the client’s Google account email as a **test user**

### 3. Create OAuth 2.0 credentials
- Go to **APIs & Services** > **Credentials**
- Click **Create Credentials** > **OAuth client ID**
- Set **Application type** to **Web application**
- Fill in:
  - **Name:** `Pendo Dating Web`
- Add these Authorized JavaScript origins:
  - `http://localhost:3000`
  - `http://localhost:3001`
- Add these Authorized redirect URIs:
  - `http://localhost:3000`
  - `http://localhost:3001`
- Click **Create**

### 4. Copy the Client ID
- After creation, copy the **Client ID** value
- It looks like:
  - `1234567890-abcdefg.apps.googleusercontent.com`

### 5. Add it to `.env`
Open `c:\Users\hp\OneDrive\Desktop\Dating web\.env` and set:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID="1234567890-abcdefg.apps.googleusercontent.com"
```

### 6. Restart the dev server
Stop the server if it is running, then run:

```bash
cd "c:\Users\hp\OneDrive\Desktop\Dating web"
npm run dev
```

## What this does
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` lets the app initialize Google Sign-In
- `Authorized JavaScript origins` allow the browser to use Google login from localhost
- `Authorized redirect URIs` let Google send the authentication response back to your app

## Features

### Forgot Password Page
Users can now:
1. Reset via email
2. Reset via Google

### Login Page
Users can now:
1. Login with email/password
2. Login with Google

## API Endpoint

### POST `/api/auth/google-callback`
Handles Google OAuth login and account linking.

## Database Changes
Added to `User` model:
- `googleId`
- `googleEmail`
- `passwordHash` now optional for OAuth users

## Important note
After you add the Client ID to `.env`, restart the dev server so the app loads the new value.

### Forgot Password Page
Users can now:
1. **Reset via Email** - Traditional password reset link
2. **Reset via Google** - If they have a Google account linked to their Pendo account

### Features Added
- ✅ Google OAuth authentication
- ✅ Auto-create account if user doesn't exist
- ✅ Link Google account to existing accounts
- ✅ JWT token generation for authenticated sessions
- ✅ User profile creation with Google data

## API Endpoints

### POST `/api/auth/google-callback`
Handles Google OAuth callback and user creation/linking

**Request:**
```json
{
  "googleId": "1234567890",
  "email": "user@gmail.com",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "clx...",
    "email": "user@gmail.com",
    "name": "John Doe"
  }
}
```

## Database Changes

Added to User model:
- `googleId` - Unique Google ID
- `googleEmail` - Email from Google
- `passwordHash` - Now optional (for OAuth users)

## Security Notes
- ✅ Passwords are optional for OAuth users
- ✅ Google tokens are verified with Google's servers
- ✅ JWTs are signed securely
- ✅ No passwords stored for social auth users

---

**Questions?** Check the implementation in:
- [Forgot Password Page](src/app/forgot-password/page.tsx)
- [Google Callback Route](src/app/api/auth/google-callback/route.ts)
- [Database Schema](prisma/schema.prisma)
