import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
})

// Types for our auth
export interface AuthUser {
    id: string
    email: string
    user_metadata: {
        first_name?: string
        last_name?: string
        full_name?: string
        avatar_url?: string
    }
}

export interface SignUpData {
    firstName: string
    lastName: string
    email: string
    password: string
}

export interface SignInData {
    email: string
    password: string
} 