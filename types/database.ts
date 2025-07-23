export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    id: string
                    first_name: string | null
                    last_name: string | null
                    email: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    first_name?: string | null
                    last_name?: string | null
                    email?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    first_name?: string | null
                    last_name?: string | null
                    email?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            assessments: {
                Row: {
                    id: string
                    user_id: string | null
                    initial_reason: string | null
                    assessment_type: string
                    digestive_score: number | null
                    status: string
                    completed_at: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    initial_reason?: string | null
                    assessment_type?: string
                    digestive_score?: number | null
                    status?: string
                    completed_at?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    initial_reason?: string | null
                    assessment_type?: string
                    digestive_score?: number | null
                    status?: string
                    completed_at?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            question_responses: {
                Row: {
                    id: string
                    assessment_id: string | null
                    user_id: string | null
                    question_id: string
                    question_type: string
                    response_value: Json
                    response_text: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    assessment_id?: string | null
                    user_id?: string | null
                    question_id: string
                    question_type: string
                    response_value: Json
                    response_text?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    assessment_id?: string | null
                    user_id?: string | null
                    question_id?: string
                    question_type?: string
                    response_value?: Json
                    response_text?: string | null
                    created_at?: string
                }
            }
            progress_metrics: {
                Row: {
                    id: string
                    user_id: string | null
                    assessment_id: string | null
                    metric_type: string
                    metric_value: number | null
                    metric_text: string | null
                    metric_date: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    assessment_id?: string | null
                    metric_type: string
                    metric_value?: number | null
                    metric_text?: string | null
                    metric_date?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    assessment_id?: string | null
                    metric_type?: string
                    metric_value?: number | null
                    metric_text?: string | null
                    metric_date?: string
                    created_at?: string
                }
            }
            symptom_patterns: {
                Row: {
                    id: string
                    user_id: string | null
                    assessment_id: string | null
                    symptom_type: string
                    severity: number | null
                    frequency: string | null
                    triggers: Json | null
                    notes: string | null
                    recorded_date: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    assessment_id?: string | null
                    symptom_type: string
                    severity?: number | null
                    frequency?: string | null
                    triggers?: Json | null
                    notes?: string | null
                    recorded_date?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    assessment_id?: string | null
                    symptom_type?: string
                    severity?: number | null
                    frequency?: string | null
                    triggers?: Json | null
                    notes?: string | null
                    recorded_date?: string
                    created_at?: string
                }
            }
            reports: {
                Row: {
                    id: string
                    assessment_id: string | null
                    user_id: string | null
                    report_type: string
                    digestive_score: number | null
                    diet_recommendations: string | null
                    supplement_suggestions: string | null
                    lifestyle_changes: string | null
                    bowel_trends: string | null
                    goal_reminders: string | null
                    symptom_patterns_analysis: string | null
                    ai_tip_of_week: string | null
                    ai_model_used: string
                    ai_prompt_version: string
                    generation_time_ms: number | null
                    pdf_url: string | null
                    email_sent_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    assessment_id?: string | null
                    user_id?: string | null
                    report_type?: string
                    digestive_score?: number | null
                    diet_recommendations?: string | null
                    supplement_suggestions?: string | null
                    lifestyle_changes?: string | null
                    bowel_trends?: string | null
                    goal_reminders?: string | null
                    symptom_patterns_analysis?: string | null
                    ai_tip_of_week?: string | null
                    ai_model_used?: string
                    ai_prompt_version?: string
                    generation_time_ms?: number | null
                    pdf_url?: string | null
                    email_sent_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    assessment_id?: string | null
                    user_id?: string | null
                    report_type?: string
                    digestive_score?: number | null
                    diet_recommendations?: string | null
                    supplement_suggestions?: string | null
                    lifestyle_changes?: string | null
                    bowel_trends?: string | null
                    goal_reminders?: string | null
                    symptom_patterns_analysis?: string | null
                    ai_tip_of_week?: string | null
                    ai_model_used?: string
                    ai_prompt_version?: string
                    generation_time_ms?: number | null
                    pdf_url?: string | null
                    email_sent_at?: string | null
                    created_at?: string
                }
            }
            ai_tips: {
                Row: {
                    id: string
                    title: string
                    content: string
                    category: string | null
                    tip_week: number | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    content: string
                    category?: string | null
                    tip_week?: number | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    content?: string
                    category?: string | null
                    tip_week?: number | null
                    is_active?: boolean
                    created_at?: string
                }
            }
            reminder_settings: {
                Row: {
                    id: string
                    user_id: string | null
                    reminder_type: string
                    frequency_days: number
                    preferred_time: string
                    is_enabled: boolean
                    last_sent_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    reminder_type: string
                    frequency_days?: number
                    preferred_time?: string
                    is_enabled?: boolean
                    last_sent_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    reminder_type?: string
                    frequency_days?: number
                    preferred_time?: string
                    is_enabled?: boolean
                    last_sent_at?: string | null
                    created_at?: string
                }
            }
            subscriptions: {
                Row: {
                    id: string
                    user_id: string | null
                    plan_type: string
                    status: string
                    stripe_subscription_id: string | null
                    stripe_customer_id: string | null
                    current_period_start: string | null
                    current_period_end: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    plan_type?: string
                    status?: string
                    stripe_subscription_id?: string | null
                    stripe_customer_id?: string | null
                    current_period_start?: string | null
                    current_period_end?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    plan_type?: string
                    status?: string
                    stripe_subscription_id?: string | null
                    stripe_customer_id?: string | null
                    current_period_start?: string | null
                    current_period_end?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

// Convenience types for easier usage
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Assessment = Database['public']['Tables']['assessments']['Row']
export type QuestionResponse = Database['public']['Tables']['question_responses']['Row']
export type ProgressMetric = Database['public']['Tables']['progress_metrics']['Row']
export type SymptomPattern = Database['public']['Tables']['symptom_patterns']['Row']
export type Report = Database['public']['Tables']['reports']['Row']
export type AITip = Database['public']['Tables']['ai_tips']['Row']
export type ReminderSetting = Database['public']['Tables']['reminder_settings']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']

// Insert types
export type InsertUserProfile = Database['public']['Tables']['user_profiles']['Insert']
export type InsertAssessment = Database['public']['Tables']['assessments']['Insert']
export type InsertQuestionResponse = Database['public']['Tables']['question_responses']['Insert']
export type InsertProgressMetric = Database['public']['Tables']['progress_metrics']['Insert']
export type InsertSymptomPattern = Database['public']['Tables']['symptom_patterns']['Insert']
export type InsertReport = Database['public']['Tables']['reports']['Insert']
export type InsertAITip = Database['public']['Tables']['ai_tips']['Insert']
export type InsertReminderSetting = Database['public']['Tables']['reminder_settings']['Insert']
export type InsertSubscription = Database['public']['Tables']['subscriptions']['Insert']

// Assessment types
export type AssessmentType = 'daily_check' | 'full_assessment' | 'follow_up'
export type AssessmentStatus = 'draft' | 'completed'

// Report types  
export type ReportType = 'comprehensive' | 'daily_summary' | 'weekly_progress'

// Metric types
export type MetricType =
    | 'bowel_frequency'
    | 'energy_level'
    | 'bloating_severity'
    | 'mood_score'
    | 'heartburn_frequency'
    | 'constipation_level'
    | 'diarrhea_frequency'
    | 'sleep_quality'
    | 'stress_level'
    | 'hydration_level'

// Symptom types
export type SymptomType =
    | 'bloating'
    | 'constipation'
    | 'diarrhea'
    | 'heartburn'
    | 'cramping'
    | 'gas'
    | 'acid_reflux'
    | 'brain_fog'
    | 'skin_issues'
    | 'irregular_stool'

// Reminder types
export type ReminderType = 'daily_check' | 'weekly_summary' | 'monthly_assessment'

// Plan types
export type PlanType = 'free' | 'premium' | 'premium_plus'

// Subscription status
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired'

// AI Tip categories
export type TipCategory = 'diet' | 'lifestyle' | 'supplements' | 'mindfulness'

// Severity scale (1-5)
export type SeverityScale = 1 | 2 | 3 | 4 | 5

// Frequency options
export type FrequencyType = 'daily' | 'weekly' | 'occasionally' | 'rarely' 