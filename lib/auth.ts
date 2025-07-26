import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthState {
    user: User | null
    session: Session | null
    loading: boolean
    isAuthenticated: boolean
}

export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        session: null,
        loading: true,
        isAuthenticated: false
    })

    useEffect(() => {
        // Get initial session
        const getInitialSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error) {
                    console.error('Error getting session:', error)
                }

                setAuthState({
                    user: session?.user ?? null,
                    session,
                    loading: false,
                    isAuthenticated: !!session?.user
                })
            } catch (error) {
                console.error('Error in getInitialSession:', error)
                setAuthState({
                    user: null,
                    session: null,
                    loading: false,
                    isAuthenticated: false
                })
            }
        }

        getInitialSession()

        // Listen for auth changes (includes automatic token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth state changed:', event, session?.user?.email)

                // Update auth state
                setAuthState({
                    user: session?.user ?? null,
                    session,
                    loading: false,
                    isAuthenticated: !!session?.user
                })

                // Handle token refresh automatically (Supabase handles this internally)
                if (event === 'TOKEN_REFRESHED') {
                    console.log('Token refreshed automatically')
                }

                // Handle session expired
                if (event === 'SIGNED_OUT') {
                    console.log('User signed out or session expired')
                }
            }
        )

        // Cleanup subscription
        return () => {
            subscription.unsubscribe()
        }
    }, [])

    return authState
}

// Helper function to get session token for API calls
export const getSessionToken = async (): Promise<string | null> => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
            console.error('No valid session found:', error)
            return null
        }
        return session.access_token
    } catch (error) {
        console.error('Error getting session token:', error)
        return null
    }
}

// Helper function to check if user is authenticated
export const isUserAuthenticated = async (): Promise<boolean> => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession()
        return !error && !!session?.user
    } catch (error) {
        console.error('Error checking authentication:', error)
        return false
    }
} 