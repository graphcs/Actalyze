'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface ReportData {
  id: string
  digestive_score: number
  diet_recommendations: string
  supplement_suggestions: string
  lifestyle_changes: string
  bowel_trends: string
  goal_reminders: string
  symptom_patterns_analysis: string
  ai_tip_of_week: string
  created_at: string
}

export default function ReportPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const loadLatestReport = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // Get the latest report for the user
      const { data: report, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading report:', error)
      } else if (report) {
        setReportData(report)
      }
    } catch (error) {
      console.error('Error loading report:', error)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadLatestReport()
  }, [loadLatestReport])

  const getWeekRange = () => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay()) // Get Sunday
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Get Saturday

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric' 
      })
    }

    return `Week of ${formatDate(startOfWeek)}–${formatDate(endOfWeek)}, ${today.getFullYear()}`
  }

  const formatBulletPoints = (text: string) => {
    if (!text) return []
    
    // Split by lines and filter out empty ones
    const lines = text.split('\n').filter(line => line.trim().length > 0)
    
    return lines.map(line => {
      // Remove bullet indicators and clean the line
      return line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim()
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-light flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-dark-gray">Loading your report...</div>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-cream-light flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-xl font-medium text-dark-gray mb-4">No report found</div>
          <Link 
            href="/onboarding/initial-question"
            className="btn-primary"
          >
            Take Assessment
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-light px-4 relative overflow-hidden">
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
      <div className="w-full max-w-3xl mx-auto h-full flex flex-col relative z-10">
        {/* Header */}
        <div className="pt-10 pb-6 flex items-center justify-between">
          {/* Brand Title */}
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
          
          {/* Profile Icon */}
          <button 
            onClick={() => router.push('/profile')}
            className="p-2 hover:cursor-pointer"
          >
            <img 
              src="/Profile.png" 
              alt="Profile" 
              className="w-7 h-7"
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-8">
          {/* Digestive Score Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-black mb-4">
              Digestive score
            </h2>
            
            <div className="flex items-baseline justify-center mb-4">
              <span className="text-7xl font-semibold text-orange-primary">
                {reportData.digestive_score}
              </span>
              <span className="text-2xl font-semibold text-orange-primary ml-1">
                /10
              </span>
            </div>
            
            <div className="text-2xl text-center font-medium text-gray-500 mb-6">
              Overall good digestion
            </div>

            {/* Daily Log Button */}
            <div className="flex justify-center mb-6">
              <Link
                href="/onboarding/initial-question"
                className="w-[90%] md:w-[50%] py-4 px-8 bg-orange-light text-dark font-semibold rounded-full text-center"
              >
                + Daily Log
              </Link>
            </div>

            {/* Week Display */}
            <div className="text-2xl font-medium text-dark-gray mb-8">
              {getWeekRange()}
            </div>
          </div>

          {/* Bowel Trends Section */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-6 bg-orange-primary mr-3"></div>
              <h3 className="text-3xl font-semibold text-dark-green">
                Bowel trends
              </h3>
            </div>
            <div className="text-xl font-medium text-black leading-relaxed">
              {formatBulletPoints(reportData.bowel_trends).map((point, index) => (
                <div key={index} className="mb-2">
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Goal Reminder Section */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-6 bg-orange-primary mr-3"></div>
              <h3 className="text-3xl font-semibold text-dark-green">
                Goal reminder
              </h3>
            </div>
            <div className="text-xl font-medium text-black leading-relaxed">
              {formatBulletPoints(reportData.goal_reminders).map((point, index) => (
                <div key={index} className="mb-2">
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Diet Recommendations */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-6 bg-orange-primary mr-3"></div>
              <h3 className="text-3xl font-semibold text-dark-green">
                Diet recommendations
              </h3>
            </div>
            <div className="text-xl font-medium text-black leading-relaxed">
              {formatBulletPoints(reportData.diet_recommendations).map((point, index) => (
                <div key={index} className="mb-2">
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Supplement Suggestions */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-6 bg-orange-primary mr-3"></div>
              <h3 className="text-3xl font-semibold text-dark-green">
                Supplement suggestions
              </h3>
            </div>
            <div className="text-xl font-medium text-black leading-relaxed">
              {formatBulletPoints(reportData.supplement_suggestions).map((point, index) => (
                <div key={index} className="mb-2">
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Lifestyle Changes */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-6 bg-orange-primary mr-3"></div>
              <h3 className="text-3xl font-semibold text-dark-green">
                Lifestyle changes
              </h3>
            </div>
            <div className="text-xl font-medium text-black leading-relaxed">
              {formatBulletPoints(reportData.lifestyle_changes).map((point, index) => (
                <div key={index} className="mb-2">
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* Symptom Patterns Analysis */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-6 bg-orange-primary mr-3"></div>
              <h3 className="text-3xl font-semibold text-dark-green">
                Symptom patterns
              </h3>
            </div>
            <div className="text-xl font-medium text-black leading-relaxed">
              {formatBulletPoints(reportData.symptom_patterns_analysis).map((point, index) => (
                <div key={index} className="mb-2">
                  {point}
                </div>
              ))}
            </div>
          </div>

          {/* AI Tip of the Week - Highlighted Box */}
          {reportData.ai_tip_of_week && (
            <div className="bg-orange-pale rounded-lg p-4 mb-8">
              <h3 className="text-base font-semibold text-black mb-3">
                This week&apos;s power tip
              </h3>
              <div className="text-xl font-medium text-black leading-relaxed">
                {reportData.ai_tip_of_week}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 