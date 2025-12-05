import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

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

export async function GET() {
  try {
    // Try to fetch from Supabase app_settings table
    const { data, error } = await supabase
      .from("app_settings")
      .select("settings")
      .eq("key", "auth_settings")
      .single();

    if (error || !data) {
      // Table doesn't exist or no settings found - return defaults
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json(data.settings as AuthSettings);
  } catch {
    // Return defaults on any error
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(request: Request) {
  try {
    const settings: AuthSettings = await request.json();

    // Validate the settings
    if (!settings.mode || !settings.authorizedEmails || !settings.adminEmails) {
      return NextResponse.json(
        { error: "Invalid settings format" },
        { status: 400 }
      );
    }

    // Try to upsert to Supabase
    const { error } = await supabase.from("app_settings").upsert(
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
      // Still return success - the client can use localStorage as backup
      return NextResponse.json({
        success: true,
        warning: "Settings saved locally only - database table may not exist",
      });
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
