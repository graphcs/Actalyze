'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function InitialQuestionPage() {
  const [selectedReason, setSelectedReason] = useState<string>('')
  const router = useRouter()

  const reasons = [
    'Constipation',
    'Bloating', 
    'Heartburn / Acid Reflux',
    'Colonoscopy Prep',
    'Just Curious'
  ]

  const handleContinue = () => {
    if (selectedReason) {
      // Store the selected reason and proceed to the multi-step form
      // You can store this in localStorage, state management, or pass as query param
      localStorage.setItem('gutRootInitialReason', selectedReason)
      router.push('/onboarding')
    }
  }

  return (
    <div className="min-h-screen bg-cream-light flex items-center justify-center px-4 relative overflow-hidden">
      {/* Orange Gradient Overlay - Bottom Left */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: `linear-gradient(
            45deg,
            rgba(248, 234, 190, 1) 0%,
            rgba(254, 250, 237, 1) 50%,
            rgba(249, 245, 241, 1) 70%,
            transparent 85%
          )`
        }}
      />

      {/* Main Container - Centered with full height */}
      <div className="w-full max-w-lg h-full flex flex-col relative z-10">
        {/* Brand Title - Top left of container */}
        <div className="md:pb-12 mb-8 md:mt-5 md:mb-0">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Content - Centered vertically in remaining space */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full md:px-2 max-w-sm mx-auto">
        {/* Question with Bubble Image */}
        <div className="relative mb-10">
          <img 
            src="/bubble-question.png" 
            alt="Question bubble" 
            className="w-full h-auto"
          />
          <div className="absolute inset-0 flex items-start justify-center pt-8 px-8">
            <p className="text-dark text-2xl leading-relaxed text-left font-medium">
              Hi, I&apos;m your personalized gut health guide. 
              What brings you here today?
            </p>
          </div>
        </div>

        {/* Choice Buttons */}
        <div className="space-y-4 mb-12">
          {reasons.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full py-4 px-6 text-xl text-nowrap rounded-full text-dark font-medium transition-all duration-100`}
              style={{ 
                backgroundColor: '#FAE4B2',
                ...(selectedReason === reason && {
                  borderTop: '2px solid #F5A623',
                  borderLeft: '2px solid #F5A623', 
                  borderRight: '2px solid #F5A623',
                  borderBottom: '6px solid #F5A623'
                })
              }}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* Continue Button */}
        <div className="fixed bottom-10 left-4 right-4 md:relative md:bottom-auto md:left-auto md:right-auto">
          <button
            onClick={handleContinue}
            disabled={!selectedReason}
            className="w-full py-4 px-6 rounded-full text-xl text-nowrap font-semibold bg-orange-primary text-dark cursor-pointer disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
          </div>
        </div>
      </div>
    </div>
  )
} 