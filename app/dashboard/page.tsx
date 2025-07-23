'use client'

import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-cream-light flex items-center justify-center px-4">
      <div className="w-full max-w-4xl">
        {/* Brand Title */}
        <div className="mb-12">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Dashboard Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-semibold text-dark-gray mb-6">
            Welcome to Your Gut Health Dashboard
          </h2>
          
          <div className="space-y-6">
            <div className="bg-cream-50 rounded-lg p-6">
              <h3 className="text-xl font-medium text-dark-gray mb-3">
                Your Personalized Report
              </h3>
              <p className="text-medium-gray">
                Your gut health analysis has been sent to your email. Check your inbox for your personalized recommendations.
              </p>
            </div>

            <div className="bg-cream-50 rounded-lg p-6">
              <h3 className="text-xl font-medium text-dark-gray mb-3">
                Next Steps
              </h3>
              <ul className="text-medium-gray space-y-2">
                <li>• Review your personalized gut health report</li>
                <li>• Start implementing the recommended dietary changes</li>
                <li>• Track your progress using our tools</li>
                <li>• Schedule follow-up assessments</li>
              </ul>
            </div>

            <div className="text-center">
              <Link 
                href="/" 
                className="inline-block bg-orange-primary text-dark font-semibold py-3 px-8 rounded-full hover:opacity-90 transition-opacity"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 