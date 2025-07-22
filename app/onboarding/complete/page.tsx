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

    // Simulate API call to generate and send report
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Clear form data from localStorage
    localStorage.removeItem('gutRootOnboardingForm')
    localStorage.removeItem('gutRootOnboardingStep')
    localStorage.removeItem('gutRootInitialReason')
    
    // TODO: Integrate with AI report generation
    console.log('Form Data:', formData)
    console.log('Email:', email)
    
    setIsSubmitting(false)
    router.push('/dashboard') // Redirect to dashboard or success page
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  return (
    <div className="min-h-screen bg-cream-light flex items-center justify-center px-4 relative overflow-hidden">
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
        <div className="pb-20">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full md:px-16 text-center">
            
            {/* Success Message */}
            <div className="mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-semibold text-dark-gray mb-4">
                Congratulations!
              </h2>
              <p className="text-dark-gray text-lg mb-8">
                Your personalized gut health assessment is complete. 
                We're generating your custom report now.
              </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-left text-sm font-medium text-dark-gray mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email to receive your report"
                  className="w-full px-4 py-3 bg-white rounded-lg border border-pale-gray focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!validateEmail(email) || isSubmitting}
                className={`w-full py-4 px-6 rounded-full font-semibold transition-all duration-200 ${
                  validateEmail(email) && !isSubmitting
                    ? 'bg-orange-primary text-dark hover:opacity-90 cursor-pointer'
                    : 'bg-pale-gray text-medium-gray cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Generating Report...' : 'Send My Report'}
              </button>
            </form>

            {/* Additional Info */}
            <div className="mt-8 text-sm text-medium-gray">
              <p>Your report will include:</p>
              <ul className="mt-2 space-y-1">
                <li>• Personalized gut health analysis</li>
                <li>• Dietary recommendations</li>
                <li>• Lifestyle suggestions</li>
                <li>• Next steps for improvement</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 