'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Don't redirect while loading
    if (loading) return

    // Allow /auth and / routes to pass through
    if (pathname === '/auth' || pathname === '/') return

    // Redirect to auth if not authenticated
    if (!isAuthenticated) {
      console.log('User not authenticated, redirecting to /auth')
      router.push('/auth')
      return
    }

    console.log('User authenticated, allowing access to:', pathname)
  }, [isAuthenticated, loading, pathname, router])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-cream-light flex items-center justify-center">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-orange-primary rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
          <div className="w-3 h-3 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    )
  }

  // Allow /auth and / routes even if not authenticated
  if (pathname === '/auth' || pathname === '/') {
    return <>{children}</>
  }

  // Show content only if authenticated
  if (isAuthenticated) {
    return <>{children}</>
  }

  // Show nothing while redirecting
  return null
} 