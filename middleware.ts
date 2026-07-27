import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createClient } from "@supabase/supabase-js";

interface AuthSettings {
  mode: "restricted" | "public" | "guest";
  authorizedEmails: string[];
  adminEmails: string[];
}

// Default settings - used as fallback when the settings row is unreachable.
// Mode is "public": the app is open to everyone, so a database blip must not
// lock legitimate visitors out.
const DEFAULT_SETTINGS: AuthSettings = {
  mode: "public",
  authorizedEmails: [
    "johnmahan7@gmail.com",
    "dan@datasyinc.com",
    "johnmaheswaran@datasyinc.com",
  ],
  adminEmails: ["johnmahan7@gmail.com", "dan@datasyinc.com"],
};

// Escape hatch so access can be forced without a database write.
// AUTH_MODE=public | guest | restricted overrides the stored setting.
function modeOverride(): AuthSettings["mode"] | null {
  const m = process.env.AUTH_MODE?.trim().toLowerCase();
  return m === "public" || m === "guest" || m === "restricted" ? m : null;
}

// Cache settings to avoid hitting DB on every request
let cachedSettings: AuthSettings | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

async function getAuthSettings(): Promise<AuthSettings> {
  const now = Date.now();

  // Return cached settings if still valid
  if (cachedSettings && now - cacheTimestamp < CACHE_DURATION) {
    return cachedSettings;
  }

  try {
    const url = process.env.ACTALYZE_SUPABASE_URL;
    const key = process.env.ACTALYZE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return DEFAULT_SETTINGS;
    }

    const supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("key", "auth_settings")
      .single();

    if (error || !data) {
      cachedSettings = DEFAULT_SETTINGS;
    } else {
      cachedSettings = data.settings as AuthSettings;
    }
    cacheTimestamp = now;
    return cachedSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedRoutes = [
    "/dashboard",
    "/chatbot",
    "/upload",
    "/topic",
    "/state",
    "/district",
    "/wordcloud",
    "/draft-memo",
    "/standards-checker",
    "/constituent-meetings",
    "/casework",
    "/ethics-compliance",
    "/connect-cdp",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Get auth settings
  const stored = await getAuthSettings();
  const override = modeOverride();
  const settings: AuthSettings = override ? { ...stored, mode: override } : stored;

  // Public mode: the app is open to everyone, no sign-in and no guest cookie.
  if (settings.mode === "public") {
    return NextResponse.next();
  }

  // Check if user is authenticated
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If authenticated, check authorization for restricted mode
  if (token) {
    const userEmail = token.email as string | undefined;

    // In restricted mode, check if user is authorized
    if (settings.mode === "restricted" && userEmail) {
      if (!settings.authorizedEmails.includes(userEmail)) {
        // User is authenticated but not authorized - redirect to home
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // User is authenticated and authorized (or not restricted mode)
    return NextResponse.next();
  }

  // User is not authenticated - check for guest access via cookie only
  // The cookie is set client-side by the home page when user clicks "Continue as Guest"
  // This ensures admin settings control whether guest mode is available
  const guestModeCookie = request.cookies.get("guest_mode_enabled");

  if (guestModeCookie?.value === "true") {
    return NextResponse.next();
  }

  // Not authenticated and no valid guest session - redirect to home
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/chatbot/:path*",
    "/upload/:path*",
    "/topic/:path*",
    "/state/:path*",
    "/district/:path*",
    "/wordcloud/:path*",
    "/draft-memo/:path*",
    "/standards-checker/:path*",
    "/constituent-meetings/:path*",
    "/casework/:path*",
    "/ethics-compliance/:path*",
    "/connect-cdp/:path*",
    "/nationwide/:path*",
  ],
};
