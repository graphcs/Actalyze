'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { checkOnboardingProgress, clearOnboardingProgress, OnboardingProgress } from '@/lib/onboarding-progress'
import ProgressModal from '@/components/ProgressModal'

export default function Home() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [existingProgress, setExistingProgress] = useState<OnboardingProgress>({ hasProgress: false })

  const handleGetStarted = () => {
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

  return (
    <>
        {/* Gradient Overlay - Bottom Right to Top Left */}
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            background: `linear-gradient(
              260deg,
              rgba(168, 203, 161, 0.85) 0%,
              rgba(168, 203, 161, 0.65) 25%,
              rgba(249, 244, 239, 0.4) 60%,
              rgba(249, 244, 239, 0.6) 100%
            )`,
            mixBlendMode: 'multiply'
          }}
        />
        <div className="h-screen w-screen flex flex-col items-center">
           <div className="relative w-full md:max-w-3xl xl:max-w-5xl h-full">
             <div className='absolute inset-0 w-full h-full -z-1 md:max-w-3xl xl:max-w-5xl mx-auto'>
               <img src="/green-desktop-banner.png" alt="GutRoot" className="w-full h-full object-cover hidden md:block" />
               <img src="/green-mobile-banner.png" alt="GutRoot" className="w-full h-full object-cover block md:hidden" />
             </div>
             
             {/* Brand Title - Top positioned */}
             <div className="absolute top-8 md:top-12 left-5 md:left-25">
               <h1 className="brand-title text-3xl font-black text-dark-green">
                 GutRoot
               </h1>
             </div>
             
             {/* Gut Health Text - Centered */}
             <div className="absolute inset-0 flex items-center justify-start pl-10 md:pl-35">
               <h2 className="text-5xl md:text-6xl xl:text-7xl leading-tight font-semibold text-dark-gray text-left">
                 Gut Health,
                 <br />
                 Personalized
                 <br />
                 from the Root Up.
               </h2>
             </div>
             
             {/* Button - Bottom positioned but above screen bottom */}
             <div className="absolute bottom-25 md:bottom-15 left-1/2 transform -translate-x-1/2">
               <button className="bg-orange-light text-dark-gray cursor-pointer rounded-full text-xl text-nowrap md:text-3xl xl:text-4xl px-10 md:px-20 lg:px-20 xl:px-20 py-3.5 md:py-5 xl:py-5 font-semibold" onClick={handleGetStarted}>
                 Start Your Gut Check
               </button>
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
  );
}
