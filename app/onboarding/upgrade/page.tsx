'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UpgradePage() {
  const router = useRouter()

  const handleUpgradeToPremium = () => {
    // TODO: Implement Stripe payment flow
    console.log('Upgrading to Premium...')
    // For now, redirect to dashboard
    router.push('/dashboard')
  }

  const handleContinueFree = () => {
    // Continue with free plan
    router.push('/dashboard')
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
          <div className="w-full max-w-md text-center">
          
            {/* Credit Cards/Documents Icon */}
            <div className="mb-16">
              <img 
                src="/credit-cards.png" 
                alt="Progress documents" 
                className="w-[70%] h-auto mx-auto"
              />
            </div>

            {/* Title Text */}
            <div className="mb-16">
              <h2 className="text-xl font-medium text-start text-dark-gray px-4">
                Want to save your progress,
                access expert tools, and
                follow your plan?
              </h2>
            </div>

            {/* Action Buttons */}
            <div className="space-y-6 px-4">
              {/* Upgrade to Premium Button */}
              <button
                onClick={handleUpgradeToPremium}
                className="w-full py-4 px-6 rounded-full font-semibold text-lg transition-all duration-200 bg-orange-light text-black hover:opacity-90 cursor-pointer"
              >
                Upgrade to Premium
              </button>

              {/* Continue Free Link */}
              <button
                onClick={handleContinueFree}
                className="w-full text-black font-medium text-lg underline cursor-pointer"
              >
                Continue Free
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 