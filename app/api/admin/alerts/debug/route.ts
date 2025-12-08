/**
 * Debug endpoint to check alerts configuration
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const diagnostics: Record<string, string | boolean> = {};

  // Check Supabase env vars
  diagnostics.supabase_url_set = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  diagnostics.supabase_key_set = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check Resend env var
  diagnostics.resend_key_set = !!process.env.RESEND_API_KEY;

  // Try to connect to Supabase and check tables
  if (diagnostics.supabase_url_set && diagnostics.supabase_key_set) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Check alert_configs table
      const { error: configsError } = await supabase
        .from('alert_configs')
        .select('id')
        .limit(1);

      if (configsError) {
        diagnostics.alert_configs_table = `ERROR: ${configsError.message} (code: ${configsError.code})`;
      } else {
        diagnostics.alert_configs_table = 'OK';
      }

      // Check alert_baselines table
      const { error: baselinesError } = await supabase
        .from('alert_baselines')
        .select('id')
        .limit(1);

      if (baselinesError) {
        diagnostics.alert_baselines_table = `ERROR: ${baselinesError.message} (code: ${baselinesError.code})`;
      } else {
        diagnostics.alert_baselines_table = 'OK';
      }

      // Check alert_history table
      const { error: historyError } = await supabase
        .from('alert_history')
        .select('id')
        .limit(1);

      if (historyError) {
        diagnostics.alert_history_table = `ERROR: ${historyError.message} (code: ${historyError.code})`;
      } else {
        diagnostics.alert_history_table = 'OK';
      }

    } catch (error) {
      diagnostics.supabase_connection = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    }
  } else {
    diagnostics.supabase_connection = 'SKIPPED - env vars not set';
  }

  return NextResponse.json(diagnostics);
}
