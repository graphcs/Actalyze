import { supabase } from './supabase'
import { OnboardingFormData, FoodUploadData } from '@/types/onboarding'
import {
    InsertAssessment,
    InsertQuestionResponse,
    InsertProgressMetric,
    InsertSymptomPattern,
    Assessment,
    QuestionResponse,
    ProgressMetric,
    MetricType,
    SymptomType,
    UserProfile,
    Report
} from '@/types/database'

// Assessment functions
export async function createAssessment(data: {
    initialReason?: string
    assessmentType?: 'daily_check' | 'full_assessment' | 'follow_up'
}): Promise<{ assessment: Assessment | null; error: string | null }> {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (!user) {
            return { assessment: null, error: 'User not authenticated' }
        }

        const assessmentData: InsertAssessment = {
            user_id: user.id,
            initial_reason: data.initialReason,
            assessment_type: data.assessmentType || 'full_assessment',
            status: 'completed'
        }

        const { data: assessment, error } = await supabase
            .from('assessments')
            .insert(assessmentData)
            .select()
            .single()

        if (error) {
            return { assessment: null, error: error.message }
        }

        return { assessment, error: null }
    } catch (error) {
        return { assessment: null, error: (error as Error).message }
    }
}

// Question responses functions
export async function saveQuestionResponses(
    assessmentId: string,
    formData: OnboardingFormData
): Promise<{ success: boolean; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'User not authenticated' }
        }

        // Convert form data to individual question responses
        const responses: InsertQuestionResponse[] = []

        Object.entries(formData).forEach(([questionId, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                // Determine question type based on the question ID and value
                let questionType: string
                let responseText: string

                if (Array.isArray(value)) {
                    questionType = 'multi-select'
                    responseText = value.join(', ')
                } else if (typeof value === 'number') {
                    questionType = 'slider'
                    responseText = value.toString()
                } else if (questionId === 'foodRating' && typeof value === 'object') {
                    // Handle FoodUploadData object
                    questionType = 'food-upload'
                    const foodData = value as FoodUploadData

                    if (foodData.mode === 'text') {
                        responseText = foodData.textInput || ''
                    } else if (foodData.mode === 'upload') {
                        // Create a summary of uploaded images for responseText
                        const uploadedImages = foodData.images?.filter(img => img.status === 'uploaded') || []
                        responseText = uploadedImages.length > 0
                            ? `${uploadedImages.length} food images uploaded: ${uploadedImages.map(img => img.name).join(', ')}`
                            : 'No images uploaded'
                    } else {
                        responseText = 'Invalid food rating mode'
                    }
                } else {
                    // Determine if it's single-select, text-input, text-area, or image-select
                    // You can enhance this logic based on your question configuration
                    if (questionId === 'age') {
                        questionType = 'text-input'
                        responseText = value.toString()
                    } else if (questionId === 'foodRating') {
                        // Fallback for legacy string-based food ratings
                        questionType = 'text-area'
                        responseText = value.toString()
                    } else if (questionId === 'stoolType') {
                        questionType = 'image-select'
                        responseText = value.toString()
                    } else {
                        questionType = 'single-select'
                        responseText = value.toString()
                    }
                }

                responses.push({
                    assessment_id: assessmentId,
                    user_id: user.id,
                    question_id: questionId,
                    question_type: questionType,
                    response_value: value,
                    response_text: responseText
                })
            }
        })

        if (responses.length === 0) {
            return { success: false, error: 'No responses to save' }
        }

        const { error } = await supabase
            .from('question_responses')
            .insert(responses)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, error: null }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Progress metrics functions
export async function saveProgressMetrics(
    assessmentId: string,
    formData: OnboardingFormData
): Promise<{ success: boolean; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'User not authenticated' }
        }

        const metrics: InsertProgressMetric[] = []

        // Extract specific metrics from form data
        if (formData.bowelFrequency) {
            metrics.push({
                user_id: user.id,
                assessment_id: assessmentId,
                metric_type: 'bowel_frequency',
                metric_text: formData.bowelFrequency
            })
        }

        if (formData.energyLevel) {
            metrics.push({
                user_id: user.id,
                assessment_id: assessmentId,
                metric_type: 'energy_level',
                metric_value: formData.energyLevel
            })
        }

        if (formData.moodTracking) {
            metrics.push({
                user_id: user.id,
                assessment_id: assessmentId,
                metric_type: 'mood_score',
                metric_text: formData.moodTracking
            })
        }

        if (formData.sleepQuality) {
            metrics.push({
                user_id: user.id,
                assessment_id: assessmentId,
                metric_type: 'sleep_quality',
                metric_text: formData.sleepQuality
            })
        }

        if (formData.hydrationHabits) {
            metrics.push({
                user_id: user.id,
                assessment_id: assessmentId,
                metric_type: 'hydration_level',
                metric_text: formData.hydrationHabits
            })
        }

        if (metrics.length === 0) {
            return { success: true, error: null } // No metrics to save, but not an error
        }

        const { error } = await supabase
            .from('progress_metrics')
            .upsert(metrics, {
                onConflict: 'user_id,metric_type,metric_date',
                ignoreDuplicates: false
            })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, error: null }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Symptom patterns functions
export async function saveSymptomPatterns(
    assessmentId: string,
    formData: OnboardingFormData
): Promise<{ success: boolean; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'User not authenticated' }
        }

        const symptoms: InsertSymptomPattern[] = []

        // Extract symptoms from gut concerns
        if (formData.gutConcerns && formData.gutConcerns.length > 0) {
            formData.gutConcerns.forEach(concern => {
                let symptomType: SymptomType
                const severity = 3 // Default moderate severity

                switch (concern) {
                    case 'bloating':
                        symptomType = 'bloating'
                        break
                    case 'constipation':
                        symptomType = 'constipation'
                        break
                    case 'diarrhea':
                        symptomType = 'diarrhea'
                        break
                    case 'acid-reflux':
                        symptomType = 'acid_reflux'
                        break
                    case 'gas':
                        symptomType = 'gas'
                        break
                    case 'cramping':
                        symptomType = 'cramping'
                        break
                    case 'brain-fog':
                        symptomType = 'brain_fog'
                        break
                    case 'skin-issues':
                        symptomType = 'skin_issues'
                        break
                    case 'irregular-stool':
                        symptomType = 'irregular_stool'
                        break
                    default:
                        return // Skip unknown symptoms
                }

                symptoms.push({
                    user_id: user.id,
                    assessment_id: assessmentId,
                    symptom_type: symptomType,
                    severity: severity,
                    frequency: 'daily', // Default frequency
                    notes: `Reported in assessment: ${concern}`
                })
            })
        }

        if (symptoms.length === 0) {
            return { success: true, error: null } // No symptoms to save, but not an error
        }

        const { error } = await supabase
            .from('symptom_patterns')
            .insert(symptoms)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, error: null }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Comprehensive save function
export async function saveCompleteAssessment(
    formData: OnboardingFormData,
    initialReason?: string
): Promise<{ assessmentId: string | null; error: string | null }> {
    try {
        // Create assessment
        const { assessment, error: assessmentError } = await createAssessment({
            initialReason,
            assessmentType: 'full_assessment'
        })

        if (assessmentError || !assessment) {
            return { assessmentId: null, error: assessmentError }
        }

        // Save all related data in parallel
        const [
            questionResponsesResult,
            progressMetricsResult,
            symptomPatternsResult
        ] = await Promise.all([
            saveQuestionResponses(assessment.id, formData),
            saveProgressMetrics(assessment.id, formData),
            saveSymptomPatterns(assessment.id, formData)
        ])

        // Check for any errors (but don't fail the whole operation)
        const errors = [
            questionResponsesResult.error,
            progressMetricsResult.error,
            symptomPatternsResult.error
        ].filter(Boolean)

        if (errors.length > 0) {
            console.warn('Some data failed to save')
        }

        return { assessmentId: assessment.id, error: null }
    } catch (error) {
        return { assessmentId: null, error: (error as Error).message }
    }
}

// AI Report functions
export async function saveAIReport(
    assessmentId: string,
    reportData: {
        digestive_score: number
        diet_recommendations: string
        supplement_suggestions: string
        lifestyle_changes: string
        bowel_trends: string
        goal_reminders: string
        symptom_patterns_analysis: string
        ai_tip_of_week: string
    },
    aiModelUsed: string = 'gpt-4.1',
    aiPromptVersion: string = '3.0'
): Promise<{ reportId: string | null; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { reportId: null, error: 'User not authenticated' }
        }

        const reportRecord = {
            assessment_id: assessmentId,
            user_id: user.id,
            report_type: 'comprehensive',
            digestive_score: reportData.digestive_score,
            diet_recommendations: reportData.diet_recommendations,
            supplement_suggestions: reportData.supplement_suggestions,
            lifestyle_changes: reportData.lifestyle_changes,
            bowel_trends: reportData.bowel_trends,
            goal_reminders: reportData.goal_reminders,
            symptom_patterns_analysis: reportData.symptom_patterns_analysis,
            ai_tip_of_week: reportData.ai_tip_of_week,
            ai_model_used: aiModelUsed,
            ai_prompt_version: aiPromptVersion,
            generation_time_ms: null, // Will be set by caller if needed
            pdf_url: null, // Will be set later when PDF is generated
            email_sent_at: null // Will be set when email is sent
        }

        const { data: report, error } = await supabase
            .from('reports')
            .insert(reportRecord)
            .select()
            .single()

        if (error) {
            return { reportId: null, error: error.message }
        }

        // Update the assessment with the digestive score from the AI report
        const { error: updateError } = await supabase
            .from('assessments')
            .update({ digestive_score: reportData.digestive_score })
            .eq('id', assessmentId)
            .eq('user_id', user.id) // Ensure user can only update their own assessments

        if (updateError) {
            console.warn('Failed to update assessment with digestive score')
            // Continue anyway - report was saved successfully
        } else {
            console.log(`Updated assessment with digestive score`)
        }

        return { reportId: report.id, error: null }
    } catch (error) {
        return { reportId: null, error: (error as Error).message }
    }
}

export async function updateReportEmailStatus(
    reportId: string,
    emailSentAt: string
): Promise<{ success: boolean; error: string | null }> {
    try {
        const { error } = await supabase
            .from('reports')
            .update({ email_sent_at: emailSentAt })
            .eq('id', reportId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, error: null }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

export async function getLatestReport(assessmentId?: string): Promise<{ report: Report | null; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { report: null, error: 'User not authenticated' }
        }

        let query = supabase
            .from('reports')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (assessmentId) {
            query = query.eq('assessment_id', assessmentId)
        }

        const { data: report, error } = await query.limit(1).single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            return { report: null, error: error.message }
        }

        return { report: report || null, error: null }
    } catch (error) {
        return { report: null, error: (error as Error).message }
    }
}

export async function getReportPDFUrl(reportId: string): Promise<{ pdfUrl: string | null; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { pdfUrl: null, error: 'User not authenticated' }
        }

        const { data: report, error } = await supabase
            .from('reports')
            .select('pdf_url')
            .eq('id', reportId)
            .eq('user_id', user.id) // Ensure user can only access their own reports
            .single()

        if (error) {
            return { pdfUrl: null, error: error.message }
        }

        return { pdfUrl: report.pdf_url, error: null }
    } catch (error) {
        return { pdfUrl: null, error: (error as Error).message }
    }
}

export async function getUserReports(limit: number = 10): Promise<{ reports: Report[]; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { reports: [], error: 'User not authenticated' }
        }

        const { data: reports, error } = await supabase
            .from('reports')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            return { reports: [], error: error.message }
        }

        return { reports: reports || [], error: null }
    } catch (error) {
        return { reports: [], error: (error as Error).message }
    }
}

// User profile functions
export async function getUserProfile(): Promise<{ profile: UserProfile | null; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { profile: null, error: 'User not authenticated' }
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (error) {
            // If profile doesn't exist, return null (not an error)
            if (error.code === 'PGRST116') {
                return { profile: null, error: null }
            }
            return { profile: null, error: error.message }
        }

        return { profile: data, error: null }
    } catch (error) {
        return { profile: null, error: (error as Error).message }
    }
}

export async function upsertUserProfile(profileData: {
    firstName?: string
    lastName?: string
    email?: string
}): Promise<{ success: boolean; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: 'User not authenticated' }
        }

        const { error } = await supabase
            .from('user_profiles')
            .upsert({
                id: user.id,
                first_name: profileData.firstName,
                last_name: profileData.lastName,
                email: profileData.email || user.email
            })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, error: null }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
}

// Get user's latest assessment
export async function getLatestAssessment(): Promise<{ assessment: Assessment | null; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { assessment: null, error: 'User not authenticated' }
        }

        const { data: assessment, error } = await supabase
            .from('assessments')
            .select('*')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false })
            .limit(1)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            return { assessment: null, error: error.message }
        }

        return { assessment: assessment || null, error: null }
    } catch (error) {
        return { assessment: null, error: (error as Error).message }
    }
}

// Get user's progress metrics for a date range
export async function getProgressMetrics(
    metricType?: MetricType,
    daysBack: number = 30
): Promise<{ metrics: ProgressMetric[]; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { metrics: [], error: 'User not authenticated' }
        }

        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysBack)

        let query = supabase
            .from('progress_metrics')
            .select('*')
            .eq('user_id', user.id)
            .gte('metric_date', startDate.toISOString().split('T')[0])
            .order('metric_date', { ascending: false })

        if (metricType) {
            query = query.eq('metric_type', metricType)
        }

        const { data: metrics, error } = await query

        if (error) {
            return { metrics: [], error: error.message }
        }

        return { metrics: metrics || [], error: null }
    } catch (error) {
        return { metrics: [], error: (error as Error).message }
    }
}

// Weekly progress functions
export async function getWeeklyAssessments(days: number = 7): Promise<{ assessments: Assessment[]; error: string | null }> {
    try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { assessments: [], error: 'User not authenticated' }
        }

        // Calculate date range
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(endDate.getDate() - days)

        const { data: assessments, error } = await supabase
            .from('assessments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('completed_at', startDate.toISOString())
            .lte('completed_at', endDate.toISOString())
            .order('completed_at', { ascending: false })

        if (error) {
            return { assessments: [], error: error.message }
        }

        return { assessments: assessments || [], error: null }
    } catch (error) {
        return { assessments: [], error: (error as Error).message }
    }
}

export async function getWeeklyAssessmentDetails(assessmentIds: string[]): Promise<{
    assessmentDetails: Array<{
        assessment: Assessment
        responses: QuestionResponse[]
    }>
    error: string | null
}> {
    try {
        if (assessmentIds.length === 0) {
            return { assessmentDetails: [], error: null }
        }

        // Get all assessments
        const { data: assessments, error: assessmentError } = await supabase
            .from('assessments')
            .select('*')
            .in('id', assessmentIds)

        if (assessmentError) {
            return { assessmentDetails: [], error: assessmentError.message }
        }

        // Get all question responses for these assessments
        const { data: responses, error: responseError } = await supabase
            .from('question_responses')
            .select('*')
            .in('assessment_id', assessmentIds)

        if (responseError) {
            return { assessmentDetails: [], error: responseError.message }
        }

        // Group responses by assessment_id
        const responsesByAssessment = (responses || []).reduce((acc, response) => {
            if (!acc[response.assessment_id!]) {
                acc[response.assessment_id!] = []
            }
            acc[response.assessment_id!].push(response)
            return acc
        }, {} as Record<string, QuestionResponse[]>)

        // Combine assessments with their responses
        const assessmentDetails = (assessments || []).map(assessment => ({
            assessment,
            responses: responsesByAssessment[assessment.id] || []
        }))

        return { assessmentDetails, error: null }
    } catch (error) {
        return { assessmentDetails: [], error: (error as Error).message }
    }
}

export async function getLastWeekAssessments(): Promise<{
    assessmentDetails: Array<{
        assessment: Assessment
        responses: QuestionResponse[]
    }>
    error: string | null
}> {
    try {
        // Calculate date range for the week before the current week
        const currentWeekStart = new Date()
        currentWeekStart.setDate(currentWeekStart.getDate() - 7)

        const lastWeekStart = new Date(currentWeekStart)
        lastWeekStart.setDate(currentWeekStart.getDate() - 7)

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { assessmentDetails: [], error: 'User not authenticated' }
        }

        const { data: assessments, error } = await supabase
            .from('assessments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('completed_at', lastWeekStart.toISOString())
            .lt('completed_at', currentWeekStart.toISOString())
            .order('completed_at', { ascending: false })

        if (error) {
            return { assessmentDetails: [], error: error.message }
        }

        if (!assessments || assessments.length === 0) {
            return { assessmentDetails: [], error: null }
        }

        // Get details for last week's assessments
        const assessmentIds = assessments.map(a => a.id)
        return getWeeklyAssessmentDetails(assessmentIds)
    } catch (error) {
        return { assessmentDetails: [], error: (error as Error).message }
    }
} 