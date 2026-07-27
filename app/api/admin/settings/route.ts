import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Lazy-load Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.ACTALYZE_SUPABASE_URL;
    const key = process.env.ACTALYZE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

interface AuthSettings {
  mode: "restricted" | "public" | "guest";
  authorizedEmails: string[];
  adminEmails: string[];
}

// Default settings - used as fallback
const DEFAULT_SETTINGS: AuthSettings = {
  mode: "restricted",
  authorizedEmails: [
    "johnmahan7@gmail.com",
    "dan@datasyinc.com",
    "johnmaheswaran@datasyinc.com",
  ],
  adminEmails: ["johnmahan7@gmail.com", "dan@datasyinc.com"],
};

/**
 * Read the stored auth settings, falling back to defaults when the row or the
 * table is unreachable. Never throws.
 */
async function readStoredSettings(): Promise<AuthSettings> {
  try {
    const { data, error } = await getSupabase()
      .from("app_settings")
      .select("settings")
      .eq("key", "auth_settings")
      .single();

    if (error || !data) {
      // Table doesn't exist or no settings found - return defaults
      return DEFAULT_SETTINGS;
    }

    return data.settings as AuthSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * GET /api/admin/settings
 *
 * Intentionally readable without a session: the home page, Nav and Sidebar all
 * need `mode` before a user has signed in. The email allow-lists are NOT public
 * - anonymous and non-admin callers only ever see `{ mode }` (non-admins also
 * get empty arrays so existing clients don't blow up on `.includes()`), while
 * authenticated admins get the full document so the admin console can edit it.
 */
export async function GET() {
  const settings = await readStoredSettings();

  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // Treat any session-resolution failure as "anonymous" - fail closed.
    session = null;
  }

  const email = session?.user?.email;

  // Anonymous: mode only. Nothing enumerable.
  if (!email) {
    return NextResponse.json({ mode: settings.mode });
  }

  const isAdmin = (settings.adminEmails || []).includes(email);

  if (!isAdmin) {
    return NextResponse.json({
      mode: settings.mode,
      authorizedEmails: [],
      adminEmails: [],
    });
  }

  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  try {
    // --- AuthN: a session is required to write auth settings at all ---
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- AuthZ: the caller must already be an admin in the STORED settings.
    // Checking against the stored copy (not the submitted body) is what stops
    // an authenticated non-admin from promoting themselves. ---
    const stored = await readStoredSettings();

    if (!(stored.adminEmails || []).includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings: AuthSettings = await request.json();

    // Validate the settings
    if (!settings.mode || !settings.authorizedEmails || !settings.adminEmails) {
      return NextResponse.json(
        { error: "Invalid settings format" },
        { status: 400 }
      );
    }

    // Try to upsert to Supabase
    const { error } = await getSupabase().from("app_settings").upsert(
      {
        key: "auth_settings",
        settings: settings,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "key",
      }
    );

    if (error) {
      console.error("Failed to save to Supabase:", error);
      // Return error so client knows it failed
      return NextResponse.json(
        {
          error: "Failed to save settings to database",
          details: error.message,
          hint: "The app_settings table may not exist. Run the SQL in lib/app-settings-schema.sql"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
