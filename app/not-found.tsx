'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { checkOnboardingProgress, clearOnboardingProgress, OnboardingProgress } from '@/lib/onboarding-progress'
import ProgressModal from '@/components/ProgressModal'
import Link from 'next/link'

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [existingProgress, setExistingProgress] = useState<OnboardingProgress>({ hasProgress: false })

  const handleStartAssessment = () => {
    if (!isAuthenticated) {
      // If not authenticated, take them to auth page
      router.push('/auth')
      return
    }

    // If authenticated, check for existing progress
    const progress = checkOnboardingProgress()
    
    if (progress.hasProgress) {
      // Show modal to let user choose
      setExistingProgress(progress)
      setShowProgressModal(true)
    } else {
      // No existing progress, start fresh
      router.push('/onboarding/initial-question')
    }
  }

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

  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <>
      <div className="h-screen bg-cream-light flex items-center justify-center px-4 relative overflow-hidden">
        {/* Orange Gradient Overlay - Bottom Left */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            background: `linear-gradient(
              45deg,
              rgba(245, 166, 35, 0.4) 0%,
              rgba(245, 166, 35, 0.25) 25%,
              rgba(255, 244, 230, 0.15) 50%,
              rgba(255, 244, 230, 0.05) 70%,
              transparent 85%
            )`
          }}
        />

        {/* Main Container - Centered with full height */}
        <div className="w-full max-w-lg h-full flex flex-col relative z-10">
          {/* Brand Title - Top left of container */}
          <div className="pt-20">
            <Link href="/">
              <h1 className="brand-title text-4xl font-bold text-dark-green">
                GutRoot
              </h1>
            </Link>
          </div>

          {/* Content - Centered vertically in remaining space */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full md:px-16 text-center">
              {/* Error Title */}
              <div className="mb-8">
                <h2 className="text-3xl font-semibold text-dark-gray mb-4">
                  Page Not Found
                </h2>
                <p className="text-lg text-medium-gray leading-relaxed">
                  The page you&apos;re looking for doesn&apos;t exist. 
                  You might have mistyped the URL or the page may have been moved.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <button
                  onClick={handleGoHome}
                  className="w-full py-4 px-6 rounded-full font-semibold text-lg bg-orange-light text-dark-gray cursor-pointer"
                >
                  Go Back Home
                </button>

                <button
                  onClick={handleStartAssessment}
                  className="w-full py-4 px-6 rounded-full font-semibold text-lg bg-orange-light text-dark-gray cursor-pointer"
                >
                  Start Your Gut Assessment
                </button>
              </div>
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
    </>
  )
} 