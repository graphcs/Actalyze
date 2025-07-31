'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { brandFont } from '@/app/fonts'
import Link from 'next/link'

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function ProfilePage() {
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isOAuthUser, setIsOAuthUser] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    loadUserProfile()
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // Check if user signed up with OAuth (Google/Apple) or email/password
      const isOAuth = user.app_metadata?.providers?.includes('google') || 
                     user.app_metadata?.providers?.includes('apple') ||
                     user.app_metadata?.provider === 'google' ||
                     user.app_metadata?.provider === 'apple'
      
      setIsOAuthUser(isOAuth)

      // Get user profile data
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single()

      if (profile) {
        setProfileData(prev => ({
          ...prev,
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          email: user.email || ''
        }))
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    
    // Clear success message when user makes changes
    if (successMessage) {
      setSuccessMessage('')
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    setErrors({})
    setSuccessMessage('')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Validate password fields if updating password
      if (profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          setErrors({ confirmPassword: 'New passwords do not match' })
          setIsLoading(false)
          return
        }
        
        // For email/password users, verify current password first
        if (!isOAuthUser && !profileData.currentPassword) {
          setErrors({ currentPassword: 'Please enter your current password to update it' })
          setIsLoading(false)
          return
        }
        
        if (!isOAuthUser) {
          // Verify current password by attempting sign in
          const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: user.email!,
            password: profileData.currentPassword
          })
          
          if (verifyError) {
            setErrors({ currentPassword: 'Current password is incorrect' })
            setIsLoading(false)
            return
          }
        }
      }

      // Update profile data
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          updated_at: new Date().toISOString()
        })

      if (profileError) throw profileError

      // Update password if provided and validated
      if (profileData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: profileData.newPassword
        })
        if (passwordError) throw passwordError
      }

      // Clear password fields
      setProfileData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))

      setSuccessMessage('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      setErrors({ general: 'Error updating profile. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleManageSubscription = () => {
    // Placeholder for subscription management
    alert('Subscription management coming soon!')
  }

  return (
    <div className="min-h-screen bg-cream-light flex items-center justify-center px-4 relative overflow-hidden">
      {/* Orange Gradient Overlay */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: `linear-gradient(
            45deg,
            rgba(250, 219, 107, 0.8) 0%,
            rgba(255, 248, 225, 0.6) 40%,
            rgba(255, 251, 236, 0.4) 70%,
            transparent 85%
          )`
        }}
      />

      {/* Main Container */}
      <div className="w-full max-w-lg h-full flex flex-col relative z-10">
        {/* Brand Title */}
        <div className="pb-5 pt-5">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full md:px-16">
            {/* General Error Message */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
                {errors.general}
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4 text-sm">
                {successMessage}
              </div>
            )}

            {/* Premium Subscription Section */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-black mb-4">Premium subscription</h2>
              <button
                onClick={handleManageSubscription}
                className="w-full py-3 px-6 bg-orange-pale text-dark font-medium rounded-full"
              >
                Manage subscription
              </button>
            </div>

            {/* Profile Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-black mb-4">Profile</h2>
              
              <div className="space-y-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    First name
                  </label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 ${
                      errors.firstName ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter first name"
                  />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 ${
                      errors.lastName ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter last name"
                  />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    readOnly
                    className="w-full px-4 py-3 no-border rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                {/* Current Password - Only show for non-OAuth users */}
                {!isOAuthUser && (
                  <div>
                    <label className="block text-sm font-medium text-dark-gray mb-2">
                      Current password
                    </label>
                    <div className="relative">
                                             <input
                         type={showPassword ? 'text' : 'password'}
                         value={profileData.currentPassword}
                         onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                         className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 pr-12 ${
                           errors.currentPassword ? 'border-red-300' : ''
                         }`}
                         placeholder="••••••••"
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
                     {errors.currentPassword && <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>}
                   </div>
                 )}

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    {isOAuthUser ? 'Set password' : 'New password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={profileData.newPassword}
                      onChange={(e) => handleInputChange('newPassword', e.target.value)}
                      className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 pr-12 ${
                        errors.newPassword ? 'border-red-300' : ''
                      }`}
                      placeholder={isOAuthUser ? 'Enter password' : 'Enter new password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-medium-gray hover:text-dark-gray cursor-pointer"
                    >
                      <img 
                        src={showNewPassword ? "/Hide.png" : "/Show.png"} 
                        alt={showNewPassword ? "Hide password" : "Show password"} 
                        width={20} 
                        height={20} 
                      />
                    </button>
                  </div>
                  {errors.newPassword && <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-dark-gray mb-2">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={profileData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className={`w-full px-4 py-3 no-border bg-white rounded-lg focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 pr-12 ${
                        errors.confirmPassword ? 'border-red-300' : ''
                      }`}
                      placeholder="Confirm password"
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
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="btn-primary w-full mb-4"
            >
              Save
            </button>

            {/* Sign Out */}
            <div className="text-center">
              <button
                onClick={handleSignOut}
                className="text-dark hover:text-dark-gray font-medium underline cursor-pointer"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 