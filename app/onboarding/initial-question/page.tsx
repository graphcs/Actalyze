'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function InitialQuestionPage() {
  const [selectedReason, setSelectedReason] = useState<string>('')
  const router = useRouter()

  const reasons = [
    'Constipation',
    'Bloating/Gas', 
    'Heartburn / Acid Reflux',
    'Diarrhea',
    'General Gut Health'
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
    <div className="h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Yellow Gradient Overlay - Bottom Left */}
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

      {/* Main Container - Centered with full height */}
      <div className="w-full max-w-lg h-screen flex flex-col relative z-10 ">
        {/* Brand Title - Top left of container */}
        <div className="mt-7">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Content - Centered vertically in remaining space */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full md:px-2 max-w-sm mx-auto flex flex-col h-[80%]">
        {/* Question with Bubble Image */}
        <div className="relative mb-4">
          <img 
            src="/bubble-question.png" 
            alt="Question bubble" 
            className="w-full h-45 md:h-auto"
          />
          <div className="absolute inset-0 pt-8 px-8">
            <p className="text-dark text-xl md:text-2xl leading-relaxed text-left font-medium">
              Hi, I&apos;m your personalized gut health guide. 
              What is your primary digestive concern?
            </p>
          </div>
        </div>

        {/* Choice Buttons */}
        <div className="flex-1 question-scroll">
        <div className="space-y-4">
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

        </div>

                  {/* Continue Button */}
          <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 w-full max-w-sm px-4 md:px-3">
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