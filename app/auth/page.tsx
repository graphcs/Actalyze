'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { SignUpData, SignInData } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { checkOnboardingProgress, clearOnboardingProgress, type OnboardingProgress } from '@/lib/onboarding-progress'
import ProgressModal from '@/components/ProgressModal'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  // Form states
  const [loginData, setLoginData] = useState<SignInData>({
    email: '',
    password: ''
  })

  const [signupData, setSignupData] = useState<SignUpData & { confirmPassword: string; agreeTerms: boolean }>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  })

  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [existingProgress, setExistingProgress] = useState<OnboardingProgress>({ hasProgress: false })

  // Handle OAuth callback and auth state changes
  useEffect(() => {
    // Handle OAuth callback when component mounts
    const handleAuthCallback = async () => {
      try {
        // Check for session (handles OAuth tokens from URL)
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth session error:', error)
          setErrors({ auth: error.message })
          return
        }

        if (session) {
          console.log('Session found, checking for existing progress...', session)
          
          // Check for existing onboarding progress
          const progress = checkOnboardingProgress()
          
          if (progress.hasProgress) {
            // Show modal to let user choose
            setExistingProgress(progress)
            setShowProgressModal(true)
          } else {
            // No existing progress, start fresh
            router.push('/onboarding/initial-question')
          }
          return
        }
      } catch (error) {
        console.error('Error handling auth callback:', error)
      }
    }

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session)
      
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in, redirecting...')
        
        // For OAuth users, create user profile if it doesn't exist
        if (session.user) {
          try {
            const { upsertUserProfile } = await import('@/lib/database')
            await upsertUserProfile({
              firstName: session.user.user_metadata?.first_name || session.user.user_metadata?.name?.split(' ')[0],
              lastName: session.user.user_metadata?.last_name || session.user.user_metadata?.name?.split(' ')[1],
              email: session.user.email
            })
          } catch (error) {
            console.error('Error creating user profile:', error)
          }
        }
        
        // Check for existing onboarding progress
        const progress = checkOnboardingProgress()
        
        if (progress.hasProgress) {
          // Show modal to let user choose
          setExistingProgress(progress)
          setShowProgressModal(true)
        } else {
          // No existing progress, start fresh
          router.push('/onboarding/initial-question')
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out')
      }
    })

    // Handle callback on mount
    handleAuthCallback()

    // Cleanup subscription
    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePassword = (password: string) => {
    return password.length >= 6
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (isLogin) {
      if (!loginData.email) newErrors.email = 'Email is required'
      else if (!validateEmail(loginData.email)) newErrors.email = 'Invalid email format'
      
      if (!loginData.password) newErrors.password = 'Password is required'
    } else {
      if (!signupData.firstName) newErrors.firstName = 'First name is required'
      if (!signupData.lastName) newErrors.lastName = 'Last name is required'
      
      if (!signupData.email) newErrors.email = 'Email is required'
      else if (!validateEmail(signupData.email)) newErrors.email = 'Invalid email format'
      
      if (!signupData.password) newErrors.password = 'Password is required'
      else if (!validatePassword(signupData.password)) newErrors.password = 'Password must be at least 6 characters'
      
      if (!signupData.confirmPassword) newErrors.confirmPassword = 'Confirm password is required'
      else if (signupData.password !== signupData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
      
      if (!signupData.agreeTerms) newErrors.agreeTerms = 'You must agree to terms and conditions'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Auth handlers
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password
      })

      if (error) {
        setErrors({ auth: error.message })
        setLoading(false)
      }
      // Don't redirect here - let the auth state change listener handle it
    } catch (error) {
      setErrors({ auth: 'An unexpected error occurred' })
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            first_name: signupData.firstName,
            last_name: signupData.lastName,
            full_name: `${signupData.firstName} ${signupData.lastName}`
          }
        }
      })

      if (error) {
        setErrors({ auth: error.message })
        setLoading(false)
      } else if (data.user) {
        // Create user profile in database
        try {
          const { upsertUserProfile } = await import('@/lib/database')
          await upsertUserProfile({
            firstName: signupData.firstName,
            lastName: signupData.lastName,
            email: signupData.email
          })
        } catch (profileError) {
          console.error('Error creating user profile:', profileError)
        }
        // Don't redirect here - let the auth state change listener handle it
      }
    } catch (error) {
      setErrors({ auth: 'An unexpected error occurred' })
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth`
        }
      })

      if (error) {
        setErrors({ auth: error.message })
        setLoading(false)
      }
      // Don't set loading to false here on success - user will be redirected to OAuth provider
    } catch (error) {
      setErrors({ auth: 'An unexpected error occurred' })
      setLoading(false)
    }
  }

  // Progress modal handlers
  const handleResumeProgress = () => {
    setShowProgressModal(false)
    
    // Determine where to resume based on progress
    if (existingProgress.currentStep && existingProgress.currentStep > 0) {
      // Resume at the saved step in main onboarding
      router.push('/onboarding')
    } else if (existingProgress.initialReason) {
      // Has initial reason but no step progress, go to main onboarding
      router.push('/onboarding')
    } else {
      // Fallback to initial question
      router.push('/onboarding/initial-question')
    }
  }

  const handleStartOver = () => {
    setShowProgressModal(false)
    
    // Clear existing progress
    clearOnboardingProgress()
    
    // Start fresh from initial question
    router.push('/onboarding/initial-question')
  }

  const handleCloseModal = () => {
    setShowProgressModal(false)
  }

  return (
    <div className="min-h-screen bg-cream-light flex items-center justify-center px-4 relative overflow-hidden">
      {/* Orange Gradient Overlay - Bottom Left */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: `linear-gradient(45deg,
                        rgba(250, 219, 107, 1) 0%, 
                        rgba(254, 250, 231, 1) 50%, 
                        rgba(255, 251, 236, 1) 70%,
                        transparent 85%
          )`,
              mixBlendMode: 'multiply'
        }}
      />

      {/* Main Container - Centered with full height */}
      <div className="w-full max-w-lg h-full flex flex-col relative z-10">
        {/* Brand Title - Top left of container */}
        <div className="pb-20">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Form Content - Centered vertically in remaining space */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full md:px-16">
        {/* Header */}
        <div className="text-start mb-8">
          <h2 className="text-3xl font-semibold text-dark-gray mb-6">
            {isLogin ? 'Sign In' : 'Sign up'}
          </h2>
        </div>

        {/* Error Message */}
        {errors.auth && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {errors.auth}
          </div>
        )}

        {/* Login Form */}
        {isLogin ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="Email"
                className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 ${
                  errors.email ? 'border-red-300' : 'border-pale-gray'
                }`}
                value={loginData.email}
                onChange={(e) => {
                  setLoginData({ ...loginData, email: e.target.value })
                  if (errors.email) setErrors({ ...errors, email: '' })
                }}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 pr-10 ${
                    errors.password ? 'border-red-300' : 'border-pale-gray'
                  }`}
                  value={loginData.password}
                  onChange={(e) => {
                    setLoginData({ ...loginData, password: e.target.value })
                    if (errors.password) setErrors({ ...errors, password: '' })
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-medium-gray hover:text-dark-gray cursor-pointer"
                >
                  <img 
                    src={showPassword ? "/Hide.png" : "/Show.png"} 
                    alt={showPassword ? "Hide password" : "Show password"} 
                    width={20} 
                    height={20} 
                  />
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div className="text-left">
              <button type="button" className="text-sm text-dark font-[500] underline hover:text-dark-gray cursor-pointer">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              Sign In
            </button>
          </form>
        ) : (
          /* Signup Form */
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2">
                First name
              </label>
              <input
                type="text"
                placeholder="Enter first name"
                className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 ${
                  errors.firstName ? 'border-red-300' : 'border-pale-gray'
                }`}
                value={signupData.firstName}
                onChange={(e) => {
                  setSignupData({ ...signupData, firstName: e.target.value })
                  if (errors.firstName) setErrors({ ...errors, firstName: '' })
                }}
              />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2">
                Last name
              </label>
              <input
                type="text"
                placeholder="Enter last name"
                className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 ${
                  errors.lastName ? 'border-red-300' : 'border-pale-gray'
                }`}
                value={signupData.lastName}
                onChange={(e) => {
                  setSignupData({ ...signupData, lastName: e.target.value })
                  if (errors.lastName) setErrors({ ...errors, lastName: '' })
                }}
              />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="Enter email"
                className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 ${
                  errors.email ? 'border-red-300' : 'border-pale-gray'
                }`}
                value={signupData.email}
                onChange={(e) => {
                  setSignupData({ ...signupData, email: e.target.value })
                  if (errors.email) setErrors({ ...errors, email: '' })
                }}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 pr-10 ${
                    errors.password ? 'border-red-300' : 'border-pale-gray'
                  }`}
                  value={signupData.password}
                  onChange={(e) => {
                    setSignupData({ ...signupData, password: e.target.value })
                    if (errors.password) setErrors({ ...errors, password: '' })
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-medium-gray hover:text-dark-gray cursor-pointer"
                >
                  <img 
                    src={showPassword ? "/Hide.png" : "/Show.png"} 
                    alt={showPassword ? "Hide password" : "Show password"} 
                    width={20} 
                    height={20} 
                  />
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-gray mb-2">
                Confirm Password
              </label>
              <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 ${
                  errors.confirmPassword ? 'border-red-300' : 'border-pale-gray'
                }`}
                value={signupData.confirmPassword}
                onChange={(e) => {
                  setSignupData({ ...signupData, confirmPassword: e.target.value })
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' })
                }}
              />
               <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-medium-gray hover:text-dark-gray cursor-pointer"
                >
                  <img 
                    src={showConfirmPassword ? "/Hide.png" : "/Show.png"} 
                    alt={showConfirmPassword ? "Hide password" : "Show password"} 
                    width={20} 
                    height={20} 
                  />
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="agreeTerms"
                className="mr-2"
                checked={signupData.agreeTerms}
                onChange={(e) => {
                  setSignupData({ ...signupData, agreeTerms: e.target.checked })
                  if (errors.agreeTerms) setErrors({ ...errors, agreeTerms: '' })
                }}
              />
              <label htmlFor="agreeTerms" className="text-sm text-dark-gray">
                Agree with terms and conditions
              </label>
            </div>
            {errors.agreeTerms && <p className="text-red-500 text-xs">{errors.agreeTerms}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              Sign up
            </button>
          </form>
        )}

        {/* OAuth Section - Only for Login */}
        {isLogin && (
          <>
            <div className="flex items-center justify-center my-6">
              <div className="w-8 border-t-2 border-black"></div>
              <span className="px-4 text-lg font-medium text-black">Or</span>
              <div className="w-8 border-t-2 border-black"></div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center"
              >
                <img src="/bxl-google.png" alt="Google" width={20} height={20} className="mr-3" />
                <span className="text-dark-gray font-medium">Continue with Google</span>
              </button>

              <button
                onClick={() => handleOAuthLogin('apple')}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center"
              >
                <img src="/bxl-apple.png" alt="Apple" width={20} height={20} className="mr-3" />
                <span className="text-dark-gray font-medium">Continue with Apple</span>
              </button>
            </div>
          </>
        )}

        {/* Toggle Auth Mode */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setErrors({})
            }}
            className="text-sm text-dark font-medium underline cursor-pointer hover:text-dark-gray"
          >
            {isLogin ? "Don't have an account? sign up" : "Already have an account? sign in"}
          </button>
        </div>
          </div>
        </div>
      </div>

      {/* Progress Modal */}
      <ProgressModal
        isOpen={showProgressModal}
        progress={existingProgress}
        onResume={handleResumeProgress}
        onStartOver={handleStartOver}
        onClose={handleCloseModal}
      />
    </div>
  )
} 