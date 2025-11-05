# Google OAuth Setup Guide for Actalyze

This guide will walk you through setting up Google OAuth authentication for Actalyze.

## Step 1: Generate NEXTAUTH_SECRET

Run this command to generate a secure random secret:

```bash
openssl rand -base64 32
```

Copy the output and save it for later.

## Step 2: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "Actalyze" (or any name you prefer)
4. Click "Create"

## Step 3: Configure OAuth Consent Screen

1. In your project, go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Actalyze
   - **User support email**: Your email (e.g., dan@datasyinc.com)
   - **Developer contact email**: Your email
5. Click "Save and Continue"
6. Skip "Scopes" (click "Save and Continue")
7. Add test users (optional during development):
   - johnmahan7@gmail.com
   - dan@datasyinc.com
   - johnmaheswaran@datasyinc.com
8. Click "Save and Continue"

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click "**+ CREATE CREDENTIALS**" → "OAuth client ID"
3. Select **Application type**: "Web application"
4. Name it "Actalyze Web Client"
5. Add **Authorized JavaScript origins**:
   - `http://localhost:3000` (for local development)
   - `https://your-production-domain.com` (your production URL)
6. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (for local)
   - `https://your-production-domain.com/api/auth/callback/google` (for production)
7. Click "Create"
8. **Copy the Client ID and Client Secret** - you'll need these!

## Step 5: Update Environment Variables

Add these to your `.env.local` file:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=paste-your-generated-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

**For production**, update `NEXTAUTH_URL` to your production domain:
```bash
NEXTAUTH_URL=https://your-production-domain.com
```

## Step 6: Test the Setup

1. Restart your development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000`

3. Click "Sign In with Google"

4. Try logging in with:
   - ✅ Authorized email (johnmahan7@gmail.com, dan@datasyinc.com, or johnmaheswaran@datasyinc.com)
   - ❌ Unauthorized email (should redirect to waitlist)

## Authorized Users

Only these emails can access the application:
- johnmahan7@gmail.com
- dan@datasyinc.com
- johnmaheswaran@datasyinc.com

All other users will be redirected to the waitlist page.

## Production Deployment

When deploying to Vercel/production:

1. Add the production domain to Google OAuth:
   - Authorized JavaScript origins: `https://actalyze-nine.vercel.app`
   - Authorized redirect URIs: `https://actalyze-nine.vercel.app/api/auth/callback/google`

2. Update environment variables in Vercel:
   - Go to Project Settings → Environment Variables
   - Add `NEXTAUTH_URL` with your production URL
   - Add `NEXTAUTH_SECRET` with your generated secret
   - Add `GOOGLE_CLIENT_ID`
   - Add `GOOGLE_CLIENT_SECRET`

3. Redeploy your application

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the redirect URI in Google Cloud Console exactly matches: `http://localhost:3000/api/auth/callback/google`
- Check that there are no trailing slashes

### "Access blocked" error
- Make sure your OAuth consent screen is configured
- Add test users if your app is not published
- Or publish your app for production use

### Session not persisting
- Make sure `NEXTAUTH_SECRET` is set
- Check that cookies are enabled in your browser

## Adding More Authorized Users

To add more authorized emails, edit `/app/api/auth/[...nextauth]/route.ts`:

```typescript
const AUTHORIZED_EMAILS = [
  "johnmahan7@gmail.com",
  "dan@datasyinc.com",
  "johnmaheswaran@datasyinc.com",
  "newuser@example.com", // Add new emails here
];
```

Then redeploy the application.
