interface CachedWeeklyReport {
    report: {
        digestive_score: number
        bowel_trends: string
        goal_reminders: string
        symptom_patterns_analysis: string
        ai_tip_of_week: string
        diet_recommendations?: string
        supplement_suggestions?: string
        lifestyle_changes?: string
    }
    weeklyData: {
        totalAssessments: number
        daysWithAssessments: number
        averageDigestiveScore: number
        digestiveScoreRange: { min: number; max: number }
    }
    metadata: {
        assessmentCount: number
        assessmentIds: string[]
        weekStart: string // YYYY-MM-DD format
        timestamp: number
        expiresAt: number
    }
}

const CACHE_KEY = 'weekly_report_latest'
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Get the start of the current week (7 days ago) in YYYY-MM-DD format
 */
function getCurrentWeekStart(): string {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6) // 7 days ago including today
    return weekStart.toISOString().split('T')[0] // YYYY-MM-DD
}

/**
 * Check if cached report is valid and up-to-date
 */
export function getCachedWeeklyReport(
    currentAssessmentCount: number,
    currentAssessmentIds: string[]
): CachedWeeklyReport | null {
    try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (!cached) return null

        const cachedReport: CachedWeeklyReport = JSON.parse(cached)
        const now = Date.now()

        // Check expiration
        if (now > cachedReport.metadata.expiresAt) {
            localStorage.removeItem(CACHE_KEY)
            return null
        }

        // Check if week changed
        const currentWeekStart = getCurrentWeekStart()
        if (cachedReport.metadata.weekStart !== currentWeekStart) {
            localStorage.removeItem(CACHE_KEY)
            return null
        }

        // Check if assessment data changed
        const sameCount = cachedReport.metadata.assessmentCount === currentAssessmentCount
        const sameIds = JSON.stringify(cachedReport.metadata.assessmentIds.sort()) ===
            JSON.stringify(currentAssessmentIds.sort())

        if (!sameCount || !sameIds) {
            localStorage.removeItem(CACHE_KEY)
            return null
        }

        console.log('✅ Using cached weekly report')
        return cachedReport

    } catch (error) {
        console.error('Error reading cached weekly report:', error)
        localStorage.removeItem(CACHE_KEY)
        return null
    }
}

/**
 * Cache a new weekly report
 */
export function setCachedWeeklyReport(
    report: CachedWeeklyReport['report'],
    weeklyData: CachedWeeklyReport['weeklyData'],
    assessmentCount: number,
    assessmentIds: string[]
): void {
    try {
        const now = Date.now()
        const cachedReport: CachedWeeklyReport = {
            report,
            weeklyData,
            metadata: {
                assessmentCount,
                assessmentIds: [...assessmentIds], // Clone array
                weekStart: getCurrentWeekStart(),
                timestamp: now,
                expiresAt: now + CACHE_DURATION_MS
            }
        }

        localStorage.setItem(CACHE_KEY, JSON.stringify(cachedReport))
        console.log('💾 Cached weekly report for', cachedReport.metadata.weekStart)

    } catch (error) {
        console.error('Error caching weekly report:', error)
    }
}

/**
 * Clear cached weekly report (call when new assessment is completed)
 */
export function clearWeeklyReportCache(): void {
    try {
        localStorage.removeItem(CACHE_KEY)
        console.log('🗑️ Cleared weekly report cache')
    } catch (error) {
        console.error('Error clearing weekly report cache:', error)
    }
}

/**
 * Get cache info for debugging
 */
export function getCacheInfo(): { exists: boolean; weekStart?: string; expiresAt?: number; assessmentCount?: number } {
    try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (!cached) return { exists: false }

        const cachedReport: CachedWeeklyReport = JSON.parse(cached)
        return {
            exists: true,
            weekStart: cachedReport.metadata.weekStart,
            expiresAt: cachedReport.metadata.expiresAt,
            assessmentCount: cachedReport.metadata.assessmentCount
        }
    } catch {
        return { exists: false }
    }
} 