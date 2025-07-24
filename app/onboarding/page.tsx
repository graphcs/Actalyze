'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  OnboardingFormData, 
  FORM_QUESTIONS, 
  DEFAULT_FORM_DATA 
} from '@/types/onboarding'

// Question Components
import SingleSelectQuestion from '@/components/onboarding/SingleSelectQuestion'
import MultiSelectQuestion from '@/components/onboarding/MultiSelectQuestion'
import SliderQuestion from '@/components/onboarding/SliderQuestion'
import ImageSelectQuestion from '@/components/onboarding/ImageSelectQuestion'
import TextInputQuestion from '@/components/onboarding/TextInputQuestion'
import TextAreaQuestion from '@/components/onboarding/TextAreaQuestion'

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<OnboardingFormData>(DEFAULT_FORM_DATA)
  const [initialReason, setInitialReason] = useState<string>('')
  const router = useRouter()

  // Load saved form data and initial reason on mount
  useEffect(() => {
    const savedFormData = localStorage.getItem('gutRootOnboardingForm')
    const savedStep = localStorage.getItem('gutRootOnboardingStep')
    const reason = localStorage.getItem('gutRootInitialReason')
    
    if (savedFormData) {
      setFormData(JSON.parse(savedFormData))
    }
    
    if (savedStep) {
      setCurrentStep(parseInt(savedStep))
    }
    
    if (reason) {
      setInitialReason(reason)
    }
  }, [])

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('gutRootOnboardingForm', JSON.stringify(formData))
    localStorage.setItem('gutRootOnboardingStep', currentStep.toString())
  }, [formData, currentStep])

  const currentQuestion = FORM_QUESTIONS[currentStep]
  const totalSteps = FORM_QUESTIONS.length
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100

  const updateFormData = (field: keyof OnboardingFormData, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Form completed, redirect to results page
      router.push('/onboarding/complete')
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    } else {
      // Go back to initial question page
      router.push('/onboarding/initial-question')
    }
  }

  const isStepValid = () => {
    if (!currentQuestion.required) return true
    
    const value = formData[currentQuestion.id]
    
    switch (currentQuestion.type) {
      case 'single-select':
      case 'image-select':
      case 'text-input':
      case 'text-area':
        return value !== '' && value !== null && value !== undefined
      case 'slider':
        return value !== null && value !== undefined
      case 'multi-select':
        return Array.isArray(value) && value.length > 0
      default:
        return true
    }
  }

  const renderQuestion = () => {
    const onChange = (value: unknown) => updateFormData(currentQuestion.id, value)

    switch (currentQuestion.type) {
      case 'single-select':
        return (
          <SingleSelectQuestion 
            question={currentQuestion}
            value={formData[currentQuestion.id] as string | null}
            onChange={onChange}
          />
        )
      case 'multi-select':
        return (
          <MultiSelectQuestion 
            question={currentQuestion}
            value={formData[currentQuestion.id] as string[]}
            onChange={onChange}
          />
        )
      case 'slider':
        return (
          <SliderQuestion 
            question={currentQuestion}
            value={formData[currentQuestion.id] as number}
            onChange={onChange}
          />
        )
      case 'image-select':
        return (
          <ImageSelectQuestion 
            question={currentQuestion}
            value={formData[currentQuestion.id] as string}
            onChange={onChange}
          />
        )
      case 'text-input':
        return (
          <TextInputQuestion 
            question={currentQuestion}
            value={formData[currentQuestion.id] as string}
            onChange={onChange}
          />
        )
      case 'text-area':
        return (
          <TextAreaQuestion 
            question={currentQuestion}
            value={formData[currentQuestion.id] as string}
            onChange={onChange}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="onboarding-page bg-cream-light flex items-center justify-center px-4 relative h-screen">
      {/* Orange Gradient Overlay */}
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

      {/* Main Container */}
      <div className="w-full max-w-lg h-full flex flex-col relative z-10">
        {/* Brand Title */}
        <div className="pt-10 mb-4">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center">
            <button 
              onClick={handleBack}
              className="mr-4 p-2 bg-white rounded-full hover:opacity-70 transition-opacity shadow-sm"
            >
              <img src="/back-arrow.png" alt="Back" className="w-6 h-6" />
            </button>
            <div className="flex-1 bg-white rounded-full h-3">
              <div 
                className="h-3 rounded-full transition-all duration-300"
                style={{ 
                  width: `${progressPercentage}%`,
                  background: 'linear-gradient(to right, #A8CBA1, #0D4C47)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pt-12">
          <div className="w-full max-w-sm md:max-w-xl mx-auto">
            
            {/* Show intro text in bubble on first step */}
            {currentStep === 0 && initialReason && (
              <div className="relative mb-8">
                <img 
                  src="/bubble-question.png" 
                  alt="Question bubble" 
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 flex items-center justify-center px-8">
                  <p className="text-dark text-xl leading-relaxed text-left font-medium">
                    I will ask you a few quick questions to personalize your plan.
                  </p>
                </div>
              </div>
            )}

            {/* Question Container */}
            <div className="mb-4">
              {/* Show bubble question for questions with showBubble property (not first step) */}
              {currentQuestion.showBubble && currentStep !== 0 ? (
                <div className="relative mb-8">
                  <img 
                    src="/bubble-question.png" 
                    alt="Question bubble" 
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 flex items-center justify-center px-8">
                    <p className="text-dark text-2xl leading-relaxed text-start font-medium">
                      {currentQuestion.title}
                    </p>
                  </div>
                </div>
              ) : (
                <h2 className="text-3xl font-semibold text-dark mb-6 leading-tight">
                  {currentQuestion.title}
                </h2>
              )}
              
              {renderQuestion()}
            </div>

            {/* Continue Button */}
            <div className="fixed bottom-8 left-4 right-4">
              <div className="flex justify-center">
                <button
                  onClick={handleNext}
                  disabled={currentQuestion.required && !isStepValid()}
                  className="w-full md:w-[80%] max-w-md py-4 rounded-full font-semibold transition-all duration-200 bg-orange-primary text-dark cursor-pointer disabled:cursor-not-allowed"
                >
                  {currentStep === totalSteps - 1 ? 'Submit' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 