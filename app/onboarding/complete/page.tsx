'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { OnboardingFormData } from '@/types/onboarding'
import { getSessionToken } from '@/lib/auth'
import { clearWeeklyReportCache } from '@/lib/weekly-report-cache'
import { supabase } from '@/lib/supabase'
import { validateAssessmentCompletion, clearInvalidAssessmentData, getAssessmentDataSafely } from '@/lib/assessment-validation'
import { checkOnboardingProgress, OnboardingProgress } from '@/lib/onboarding-progress'
import ProgressModal from '@/components/ProgressModal'

export default function OnboardingCompletePage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<OnboardingFormData | null>(null)
  const [, setProcessingStage] = useState('')
  const [isValidating, setIsValidating] = useState(true)
  const [hasValidAccess, setHasValidAccess] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressData, setProgressData] = useState<OnboardingProgress | null>(null)
  const router = useRouter()

  useEffect(() => {
    validatePageAccess()
  }, [])

  const validatePageAccess = () => {
    setIsValidating(true)
    
    try {
      // Step 1: Validate assessment completion
      const validation = validateAssessmentCompletion()
      
      if (validation.isComplete) {
        // Assessment is complete - allow access
        const completedFormData = getAssessmentDataSafely()
        if (completedFormData) {
          setFormData(completedFormData)
          setHasValidAccess(true)
        } else {
          handleInvalidAccess()
        }
      } else if (validation.hasData && validation.completionPercentage > 0) {
        // Partial progress exists - show resume modal
        const progress = checkOnboardingProgress()
        if (progress.hasProgress) {
          setProgressData(progress)
          setShowProgressModal(true)
        } else {
          handleInvalidAccess()
        }
      } else {
        // No valid progress - redirect to start
        handleInvalidAccess()
      }
      
    } catch (error) {
      console.error('Error validating page access')
      handleInvalidAccess()
    } finally {
      setIsValidating(false)
    }
  }

  const handleInvalidAccess = () => {
    clearInvalidAssessmentData()
    router.replace('/onboarding/initial-question')
  }

  const handleResumeProgress = () => {
    setShowProgressModal(false)
    router.push('/onboarding')
  }

  const handleStartOver = () => {
    clearInvalidAssessmentData()
    setShowProgressModal(false)
    router.push('/onboarding/initial-question')
  }

  const handleCloseModal = () => {
    setShowProgressModal(false)
    handleInvalidAccess()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Additional validation before submission
    if (!hasValidAccess || !formData) {
      handleInvalidAccess()
      return
    }
    
    setIsSubmitting(true)

    try {
      setProcessingStage('Saving your assessment...')
      
      // Get user profile data
      const { getUserProfile } = await import('@/lib/database')
      const { profile, error: profileError } = await getUserProfile()
      
      if (profileError) {
        console.error('Failed to get user profile')
      }
      
      // Extract user name for personalization (fallback to 'there' if not available)
      const firstName = profile?.first_name || 'there'
      const lastName = profile?.last_name || undefined

      // Save assessment to database
      let assessmentId = null
      if (formData) {
        const { saveCompleteAssessment } = await import('@/lib/database')
        
        const initialReason = localStorage.getItem('gutRootInitialReason')
        const { assessmentId: savedAssessmentId, error } = await saveCompleteAssessment(
          formData, 
          initialReason || undefined
        )

        if (error) {
          console.error('Failed to save assessment')
          throw new Error(`Assessment save failed: ${error}`)
        } else {
          assessmentId = savedAssessmentId
        }
      }

      if (!assessmentId) {
        throw new Error('No assessment ID available for report generation')
      }

      setProcessingStage('Analyzing your gut health...')
      
      // Generate AI report
      const reportResponse = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          initialReason: localStorage.getItem('gutRootInitialReason'),
          userProfile: {
            firstName: firstName,
            lastName: lastName
          }
        }),
      })

      if (!reportResponse.ok) {
        const errorData = await reportResponse.json()
        throw new Error(`Report generation failed: ${errorData.error}`)
      }

      const { report } = await reportResponse.json()

      setProcessingStage('Finalizing your report...')
      
      // Save the AI report to database
      const { saveAIReport } = await import('@/lib/database')
      const { reportId, error: reportError } = await saveAIReport(assessmentId, report)

      if (reportError) {
        console.error('Failed to save AI report:', reportError)
        throw new Error(`Failed to save report: ${reportError}`)
      }

      if (!reportId) {
        throw new Error('No report ID returned from database')
      }

      // Get user ID for background processing
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('Authentication required')
      }

      // Trigger background PDF generation and email sending (fire-and-forget)
      try {
        
        fetch('/api/process-background-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reportData: {
              ...report,
              userProfile: {
                firstName: firstName,
                lastName: lastName
              },
              assessmentData: {
                age: formData?.age,
                gender: formData?.gender,
                initialReason: localStorage.getItem('gutRootInitialReason')
              }
            },
            reportId: reportId,
            assessmentId: assessmentId,
            userEmail: email,
            userId: user.id
          }),
        }).catch(error => {
          // Fire-and-forget: log error but don't block user flow
          console.error('Background processing trigger failed')
        })
        
      } catch (bgError) {
        // Fire-and-forget: log error but don't block user flow
        console.error('Background processing setup failed')
      }
      
    } catch (error) {
      console.error('Error during submission')
      
      // Show user a helpful error message but continue with flow
      setProcessingStage('Completing setup...')
    }
    
    // Clear form data from localStorage after processing
    localStorage.removeItem('gutRootOnboardingForm')
    localStorage.removeItem('gutRootOnboardingStep')
    localStorage.removeItem('gutRootInitialReason')
    
    // Clear weekly report cache since new assessment data is available
    clearWeeklyReportCache()
    
    router.push('/onboarding/upgrade')
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Show loading state while validating access
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
           style={{
             background: `
               radial-gradient(circle at top left, #B0D1A9 0%, transparent 50%),
               radial-gradient(circle at top right, #D7E3C7 0%, transparent 50%),
               radial-gradient(circle at bottom left, #D0E1C1 0%, transparent 50%),
               radial-gradient(circle at bottom right, #D2DCA6 0%, transparent 50%),
               linear-gradient(135deg, #B0D1A9 0%, #D7E3C7 25%, #D0E1C1 75%, #D2DCA6 100%)
             `
           }}>
        <div className="w-full max-w-lg h-screen flex flex-col relative z-10">
          <div className="pt-10">
            <Link href="/">
              <h1 className="brand-title text-4xl font-bold text-dark-green">
                GutRoot
              </h1>
            </Link>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce"></div>
                <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                <div className="w-4 h-4 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <>
      {/* Progress Modal */}
      {showProgressModal && progressData && !hasValidAccess && (
        <ProgressModal
          isOpen={showProgressModal}
          progress={progressData}
          onResume={handleResumeProgress}
          onStartOver={handleStartOver}
          onClose={handleCloseModal}
        />
      )}

      {/* Main Page Content */}
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
           style={{
             background: `
               radial-gradient(circle at top left, #B0D1A9 0%, transparent 50%),
               radial-gradient(circle at top right, #D7E3C7 0%, transparent 50%),
               radial-gradient(circle at bottom left, #D0E1C1 0%, transparent 50%),
               radial-gradient(circle at bottom right, #D2DCA6 0%, transparent 50%),
               linear-gradient(135deg, #B0D1A9 0%, #D7E3C7 25%, #D0E1C1 75%, #D2DCA6 100%)
             `
           }}>
        {/* Main Container - Centered */}
        <div className="w-full max-w-lg h-screen flex flex-col relative z-10">
          {/* Brand Title */}
          <div className="pt-10">
            <Link href="/">
              <h1 className="brand-title text-4xl font-bold text-dark-green">
                GutRoot
              </h1>
            </Link>
          </div>

          {/* Content - Centered in remaining space */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md">
            
            {isSubmitting ? (
            /* Submission Processing State */
            <>
              {/* Opened Inbox Icon */}
              <div className="mb-16 text-center">
                <img 
                  src="/opened-inbox.png" 
                  alt="Processing" 
                  className="w-[40%] mx-auto"
                />
              </div>

              {/* Processing Text */}
              <div className="mb-12">
                <div className="px-6 md:px-12">
                  <h2 className="text-xl font-medium text-dark-gray text-start">
                    Great! You&apos;ll also receive weekly gut health tips
                    {/* Loading indicator - inline after "tips" */}
                    <span className="ml-2 inline-flex items-center space-x-1">
                      <div className="w-3 h-3 bg-orange-primary rounded-full animate-bounce"></div>
                      <div className="w-3 h-3 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                      <div className="w-3 h-3 bg-orange-primary rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    </span>
                  </h2>
                </div>
              </div>
            </>
          ) : (
            /* Initial Form State */
            <>
              {/* Inbox Icon */}
              <div className="mb-12 text-center">
                <img 
                  src="/inbox.png" 
                  alt="Inbox" 
                  className="w-[50%] mx-auto"
                />
              </div>

              {/* Title Text */}
              <div className="mb-12">
                <h2 className="text-2xl font-medium text-dark-gray text-start leading-relaxed">
                  Want to save your results and
                  get your plan by email?
                </h2>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="w-full space-y-8">
                <div>
                  <label className="block text-left text-sm font-medium text-dark-gray mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full px-4 py-4 bg-white rounded-lg no-border focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 text-dark-gray"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !email || !validateEmail(email)}
                  className="w-full py-4 px-6 rounded-full font-semibold text-lg transition-all duration-200 bg-orange-light text-black cursor-pointer disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              </form>
            </>
          )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
} 