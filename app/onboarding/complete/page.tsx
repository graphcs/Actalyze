'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function OnboardingCompletePage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState(null)
  const router = useRouter()

  useEffect(() => {
    // Retrieve the completed form data
    const savedFormData = localStorage.getItem('gutRootOnboardingForm')
    if (savedFormData) {
      setFormData(JSON.parse(savedFormData))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Save assessment to database
      if (formData) {
        const { saveCompleteAssessment } = await import('@/lib/database')
        
        const initialReason = localStorage.getItem('gutRootInitialReason')
        const { assessmentId, error } = await saveCompleteAssessment(
          formData, 
          initialReason || undefined
        )

        if (error) {
          console.error('Failed to save assessment:', error)
          // Continue with the flow even if database save fails
        } else {
          console.log('Assessment saved successfully:', assessmentId)
        }
      }

      // TODO: Generate AI report and send email
      console.log('Form Data:', formData)
      console.log('Email:', email)
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error) {
      console.error('Error during submission:', error)
      // Continue with the flow even if there's an error
    }
    
    // Clear form data from localStorage after successful database save
    localStorage.removeItem('gutRootOnboardingForm')
    localStorage.removeItem('gutRootOnboardingStep')
    localStorage.removeItem('gutRootInitialReason')
    
    // Redirect immediately without changing submitting state
    router.push('/onboarding/upgrade')
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

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
            /* Submission Success State */
            <>
              {/* Opened Inbox Icon */}
              <div className="mb-16 text-center">
                <img 
                  src="/opened-inbox.png" 
                  alt="Opened Inbox" 
                  className="w-[60%] h-[60%] mx-auto"
                />
              </div>

              {/* Success Text */}
              <div className="mb-12">
                <h2 className="text-xl font-medium text-dark-gray text-start px-6 md:px-12">
                  Great! You'll also receive<br />
                  weekly gut health tips...
                </h2>
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
                  className="mx-auto"
                />
              </div>

              {/* Title Text */}
              <div className="mb-12">
                <h2 className="text-2xl font-medium text-dark-gray text-start leading-relaxed">
                  Want to save your results and<br />
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
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-full font-semibold text-lg transition-all duration-200 bg-orange-light text-black cursor-pointer"
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
  )
} 