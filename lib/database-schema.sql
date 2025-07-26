-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assessments table (daily retakes supported)
CREATE TABLE public.assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  initial_reason TEXT, -- from initial question page
  assessment_type TEXT DEFAULT 'daily_check', -- daily_check, full_assessment, follow_up
  digestive_score INTEGER, -- 1-100 calculated score
  status TEXT DEFAULT 'completed', -- draft, completed
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual question responses (for AI analytics)
CREATE TABLE public.question_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  question_id TEXT NOT NULL, -- matches OnboardingFormData keys
  question_type TEXT NOT NULL, -- single-select, multi-select, slider, etc.
  response_value JSONB NOT NULL, -- flexible storage for any response type
  response_text TEXT, -- human-readable version for AI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress tracking metrics
CREATE TABLE public.progress_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  assessment_id UUID REFERENCES assessments(id),
  metric_type TEXT NOT NULL, -- bowel_frequency, energy_level, bloating_severity, mood_score, etc.
  metric_value NUMERIC,
  metric_text TEXT,
  metric_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite index for efficient queries
  CONSTRAINT unique_user_metric_date UNIQUE(user_id, metric_type, metric_date)
);

-- Symptom patterns tracking
CREATE TABLE public.symptom_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  assessment_id UUID REFERENCES assessments(id),
  symptom_type TEXT NOT NULL, -- bloating, constipation, heartburn, cramping, etc.
  severity INTEGER CHECK (severity >= 1 AND severity <= 5), -- 1-5 scale
  frequency TEXT, -- daily, weekly, occasionally, rarely
  triggers JSONB, -- array of potential triggers
  notes TEXT,
  recorded_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated reports
CREATE TABLE public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID REFERENCES assessments(id),
  user_id UUID REFERENCES auth.users(id),
  report_type TEXT DEFAULT 'comprehensive', -- comprehensive, daily_summary, weekly_progress
  
  -- Report sections
  digestive_score INTEGER,
  diet_recommendations TEXT,
  supplement_suggestions TEXT,
  lifestyle_changes TEXT,
  bowel_trends TEXT,
  goal_reminders TEXT,
  symptom_patterns_analysis TEXT,
  ai_tip_of_week TEXT,
  
  -- Metadata
  ai_model_used TEXT DEFAULT 'gpt-4.1',
  ai_prompt_version TEXT DEFAULT 'v3.0',
  generation_time_ms INTEGER,
  pdf_url TEXT, -- Supabase storage URL
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly AI tips (pre-generated or dynamic)
CREATE TABLE public.ai_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT, -- diet, lifestyle, supplements, mindfulness
  tip_week INTEGER, -- week number for cycling tips
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminder settings and history
CREATE TABLE public.reminder_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  reminder_type TEXT NOT NULL, -- daily_check, weekly_summary, monthly_assessment
  frequency_days INTEGER DEFAULT 1, -- every X days
  preferred_time TIME DEFAULT '09:00:00',
  is_enabled BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_reminder_type UNIQUE(user_id, reminder_type)
);

-- Subscription status (for future premium features)
CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  plan_type TEXT DEFAULT 'free', -- free, premium, premium_plus
  status TEXT DEFAULT 'active', -- active, cancelled, expired
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_assessments_user_date ON assessments(user_id, completed_at);
CREATE INDEX idx_question_responses_assessment ON question_responses(assessment_id);
CREATE INDEX idx_question_responses_user_question ON question_responses(user_id, question_id);
CREATE INDEX idx_progress_metrics_user_date ON progress_metrics(user_id, metric_date);
CREATE INDEX idx_progress_metrics_type ON progress_metrics(metric_type);
CREATE INDEX idx_symptom_patterns_user_date ON symptom_patterns(user_id, recorded_date);
CREATE INDEX idx_reports_user_created ON reports(user_id, created_at);

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can view own assessments" ON public.assessments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own responses" ON public.question_responses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own metrics" ON public.progress_metrics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own symptoms" ON public.symptom_patterns
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reports" ON public.reports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reminders" ON public.reminder_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- AI tips are public (read-only)
ALTER TABLE public.ai_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AI tips are public readable" ON public.ai_tips
  FOR SELECT USING (is_active = true);

-- Functions to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 