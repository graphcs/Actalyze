/**
 * Alert System Type Definitions
 */

export type AlertType = 'issue_surge' | 'sentiment_shift' | 'rep_mention';

export interface AlertConfig {
  id: string;
  user_email: string;
  alert_type: AlertType;
  enabled: boolean;

  // Configuration varies by type
  topic?: string;                  // For issue_surge, sentiment_shift
  representative_name?: string;    // For rep_mention
  district_code: string;           // e.g., 'VA05', 'national'
  threshold?: number;              // Surge: score threshold (0-100), Sentiment: shift amount (0-1)

  // Notification settings
  notify_email: boolean;

  created_at: string;
  updated_at: string;
}

export interface AlertBaseline {
  id: string;
  topic: string;
  district_code: string;
  avg_score?: number;              // Rolling average score (0-100)
  avg_sentiment?: number;          // Rolling average sentiment (-1 to 1)
  sample_count: number;
  last_updated: string;
}

export interface AlertHistoryEntry {
  id: string;
  config_id: string;
  alert_type: AlertType;
  message: string;
  details: AlertDetails;
  sent_at: string;
  delivery_status: 'sent' | 'failed' | 'pending';
}

export interface AlertDetails {
  topic?: string;
  representative_name?: string;
  district_code: string;
  current_score?: number;
  baseline_score?: number;
  current_sentiment?: number;
  baseline_sentiment?: number;
  mention_count?: number;
  sample_tweets?: string[];
}

// API request/response types
export interface CreateAlertRequest {
  alert_type: AlertType;
  topic?: string;
  representative_name?: string;
  district_code: string;
  threshold?: number;
  notify_email?: boolean;
}

export interface UpdateAlertRequest extends Partial<CreateAlertRequest> {
  enabled?: boolean;
}

export interface CheckAlertsResponse {
  checked: number;
  triggered: AlertHistoryEntry[];
  errors?: string[];
}

// Alert check result (internal)
export interface AlertCheckResult {
  triggered: boolean;
  message?: string;
  details?: AlertDetails;
}
