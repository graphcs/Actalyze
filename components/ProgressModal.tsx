'use client'

import { OnboardingProgress } from '@/lib/onboarding-progress'

interface ProgressModalProps {
  isOpen: boolean
  progress: OnboardingProgress
  onResume: () => void
  onStartOver: () => void
  onClose: () => void
}

export default function ProgressModal({ 
  isOpen, 
  progress, 
  onResume, 
  onStartOver, 
  onClose 
}: ProgressModalProps) {
  if (!isOpen) return null

  const getProgressDescription = () => {
    if (progress.initialReason && !progress.currentStep) {
      return `You selected "${progress.initialReason}" as your main concern`
    }

    if (progress.currentStep) {
      const totalSteps = 12
      return `You're on step ${progress.currentStep} of ${totalSteps} questions`
    }

    return 'You have some progress saved'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="relative bg-cream-light rounded-xl shadow-xl max-w-md w-full p-8 overflow-hidden">
        {/* Gradient Background Overlay */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            background: `linear-gradient(
              45deg,
              rgba(245, 166, 35, 0.15) 0%,
              rgba(245, 166, 35, 0.08) 25%,
              rgba(255, 244, 230, 0.05) 50%,
              rgba(255, 244, 230, 0.02) 70%,
              transparent 85%
            )`
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-dark-green mb-3">
              Continue Your Assessment?
            </h2>
            <p className="text-medium-gray text-sm">
              We found some saved progress from your previous session.
            </p>
          </div>

          {/* Progress Description */}
          <div className="bg-white bg-opacity-60 rounded-xl p-5 mb-8 border border-orange-light border-opacity-30">
            <p className="text-dark-gray text-sm text-center">
              <span className="font-semibold text-dark-green">Your Progress:</span><br />
              <span className="text-medium-gray">{getProgressDescription()}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={onResume}
              className="w-full h-12 px-6 bg-orange-light text-dark-gray font-semibold rounded-full cursor-pointer"
            >
              Resume Assessment
            </button>
            
            <button
              onClick={onStartOver}
              className="w-full h-12 px-6 bg-orange-light text-dark-gray font-semibold rounded-full cursor-pointer"
            >
              Start Over
            </button>
            
            <button
              onClick={onClose}
              className="w-full h-12 px-6 bg-orange-light text-dark-gray font-semibold rounded-full cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 