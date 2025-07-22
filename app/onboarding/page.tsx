'use client'

import { useEffect, useState } from 'react'

export default function OnboardingPage() {
  const [initialReason, setInitialReason] = useState<string>('')

  useEffect(() => {
    // Retrieve the reason from localStorage
    const reason = localStorage.getItem('gutRootInitialReason')
    if (reason) {
      setInitialReason(reason)
    }
  }, [])

  return (
    <div className="min-h-screen bg-cream-light flex items-center justify-center px-4 relative overflow-hidden">
      {/* Main Container - Centered with full height */}
      <div className="w-full max-w-lg h-full flex flex-col relative z-10">
        {/* Brand Title - Top left of container */}
        <div className="pb-20">
          <h1 className="brand-title text-4xl font-bold text-dark-green">
            GutRoot
          </h1>
        </div>

        {/* Content - Centered vertically in remaining space */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full md:px-16 text-center">
            <h2 className="text-3xl font-semibold text-dark-gray mb-4">
              Welcome to GutRoot!
            </h2>
            <p className="text-dark-gray text-lg mb-8">
              Let's start your personalized gut health journey
            </p>
            {initialReason && (
              <div className="bg-cream-200 p-4 rounded-lg mb-6">
                <p className="text-dark-gray">
                  You're here for: <strong>{initialReason}</strong>
                </p>
              </div>
            )}
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <p className="text-medium-gray">
                Multi-step onboarding form coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 