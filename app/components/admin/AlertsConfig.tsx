/**
 * Alert Configuration Component
 * Allows users to create and manage alert configurations
 */

"use client";

import { useState } from "react";
import {
  TrendingUp,
  Heart,
  User,
  Plus,
  Trash2,
  Edit2,
  Bell,
  Mail,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import type { AlertConfig, AlertType, CreateAlertRequest } from "@/types/alerts";

interface AlertsConfigProps {
  alerts: AlertConfig[];
  onCreateAlert: (alert: CreateAlertRequest) => Promise<void>;
  onUpdateAlert: (id: string, updates: Partial<AlertConfig>) => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
  onTestAlert?: (alert: AlertConfig, forceTrigger: boolean, sendEmail: boolean) => Promise<TestResult | null>;
  loading?: boolean;
}

const ALERT_TYPE_INFO: Record<AlertType, { label: string; icon: React.ElementType; description: string }> = {
  issue_surge: {
    label: "Issue Surge",
    icon: TrendingUp,
    description: "Alert when a topic suddenly trends above baseline",
  },
  sentiment_shift: {
    label: "Sentiment Shift",
    icon: Heart,
    description: "Alert when sentiment on a topic changes significantly",
  },
  rep_mention: {
    label: "Representative Mention",
    icon: User,
    description: "Alert when a representative is mentioned on social media",
  },
};

const STATE_OPTIONS = [
  { value: "national", label: "National" },
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }, { value: "DC", label: "Washington D.C." },
];

interface AlertFormData {
  alert_type: AlertType;
  topic: string;
  representative_name: string;
  district_code: string;
  threshold: number;
  notify_email: boolean;
}

// Common political topics for quick selection
const TOPIC_CHIPS = [
  // Economic
  { label: "Economy", category: "Economic" },
  { label: "Inflation", category: "Economic" },
  { label: "Jobs", category: "Economic" },
  { label: "Tax Cuts", category: "Economic" },
  { label: "Tax Policy", category: "Economic" },
  { label: "Tariffs", category: "Economic" },
  { label: "Trade", category: "Economic" },
  // Social
  { label: "Immigration", category: "Social" },
  { label: "Border Security", category: "Social" },
  { label: "Healthcare", category: "Social" },
  { label: "Abortion", category: "Social" },
  { label: "Gun Control", category: "Social" },
  { label: "Education", category: "Social" },
  { label: "Social Security", category: "Social" },
  { label: "Medicare", category: "Social" },
  // Environment & Energy
  { label: "Climate", category: "Environment" },
  { label: "Energy", category: "Environment" },
  { label: "Oil & Gas", category: "Environment" },
  { label: "Green Energy", category: "Environment" },
  // Foreign Policy
  { label: "Ukraine", category: "Foreign" },
  { label: "China", category: "Foreign" },
  { label: "Israel", category: "Foreign" },
  { label: "NATO", category: "Foreign" },
  // Government
  { label: "Government Spending", category: "Government" },
  { label: "National Debt", category: "Government" },
  { label: "DOGE", category: "Government" },
  { label: "Federal Reserve", category: "Government" },
];

// Recommended alert presets
const RECOMMENDED_ALERTS: { label: string; description: string; config: Omit<CreateAlertRequest, 'notify_email'> }[] = [
  {
    label: "Immigration",
    description: "Track immigration policy discussions",
    config: { alert_type: "issue_surge", topic: "immigration", district_code: "national", threshold: 50 },
  },
  {
    label: "Healthcare",
    description: "Monitor healthcare debate trends",
    config: { alert_type: "issue_surge", topic: "healthcare", district_code: "national", threshold: 50 },
  },
  {
    label: "Economy",
    description: "Track economic policy discussions",
    config: { alert_type: "sentiment_shift", topic: "economy", district_code: "national", threshold: 30 },
  },
  {
    label: "Gun Control",
    description: "Monitor gun legislation sentiment",
    config: { alert_type: "sentiment_shift", topic: "gun control", district_code: "national", threshold: 30 },
  },
  {
    label: "Climate",
    description: "Track climate policy trends",
    config: { alert_type: "issue_surge", topic: "climate", district_code: "national", threshold: 50 },
  },
  {
    label: "Taxes",
    description: "Monitor tax policy discussions",
    config: { alert_type: "issue_surge", topic: "taxes", district_code: "national", threshold: 50 },
  },
];

function AlertForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
}: {
  initialData?: Partial<AlertFormData>;
  onSubmit: (data: AlertFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const [formData, setFormData] = useState<AlertFormData>({
    alert_type: initialData?.alert_type || "issue_surge",
    topic: initialData?.topic || "",
    representative_name: initialData?.representative_name || "",
    district_code: initialData?.district_code || "national",
    threshold: initialData?.threshold || 50,
    notify_email: initialData?.notify_email ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const showTopicField = formData.alert_type === "issue_surge" || formData.alert_type === "sentiment_shift";
  const showRepField = formData.alert_type === "rep_mention";
  const showThreshold = formData.alert_type !== "rep_mention";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
      {/* Alert Type Selection */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Alert Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ALERT_TYPE_INFO) as AlertType[]).map((type) => {
              const info = ALERT_TYPE_INFO[type];
              const Icon = info.icon;
              const isSelected = formData.alert_type === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, alert_type: type })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${isSelected ? "" : "text-zinc-500"}`} />
                  <div className={`text-sm font-medium ${isSelected ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {info.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Topic Field */}
      {showTopicField && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Topic to Monitor
          </label>

          {/* Quick topic chips */}
          <div className="mb-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Quick select:</div>
            <div className="flex flex-wrap gap-1.5">
              {TOPIC_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setFormData({ ...formData, topic: chip.label.toLowerCase() })}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                    formData.topic.toLowerCase() === chip.label.toLowerCase()
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom topic input */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Or enter custom topic:</div>
          <input
            type="text"
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            placeholder="e.g., student loans, minimum wage, crypto regulation"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            required
          />
        </div>
      )}

      {/* Representative Name Field */}
      {showRepField && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Representative Name
          </label>
          <input
            type="text"
            value={formData.representative_name}
            onChange={(e) => setFormData({ ...formData, representative_name: e.target.value })}
            placeholder="e.g., Bob Good, Alexandria Ocasio-Cortez"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            required
          />
        </div>
      )}

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Location
        </label>
        <select
          value={formData.district_code}
          onChange={(e) => setFormData({ ...formData, district_code: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          {STATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Threshold */}
      {showThreshold && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Sensitivity Threshold
          </label>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {formData.alert_type === "issue_surge" ? (
              <>Alert when topic trends <strong>{formData.threshold}%</strong> above its normal baseline</>
            ) : (
              <>Alert when sentiment changes by <strong>{(formData.threshold / 100).toFixed(2)}</strong> (on -1 to +1 scale)</>
            )}
          </div>
          <input
            type="range"
            min={formData.alert_type === "issue_surge" ? 20 : 10}
            max={formData.alert_type === "issue_surge" ? 200 : 80}
            value={formData.threshold}
            onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
            className="w-full accent-zinc-900 dark:accent-zinc-100"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span className="flex flex-col items-start">
              <span className="font-medium">{formData.alert_type === "issue_surge" ? "20%" : "0.10"}</span>
              <span className="text-green-600 dark:text-green-400">More alerts</span>
            </span>
            <span className="flex flex-col items-center">
              <span className="font-medium">{formData.alert_type === "issue_surge" ? "50%" : "0.30"}</span>
              <span className="text-zinc-400">Balanced</span>
            </span>
            <span className="flex flex-col items-end">
              <span className="font-medium">{formData.alert_type === "issue_surge" ? "200%" : "0.80"}</span>
              <span className="text-orange-600 dark:text-orange-400">Major events only</span>
            </span>
          </div>
        </div>
      )}

      {/* Email Notification */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="notify_email"
          checked={formData.notify_email}
          onChange={(e) => setFormData({ ...formData, notify_email: e.target.checked })}
          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600"
        />
        <label htmlFor="notify_email" className="flex items-center gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          <Mail className="w-4 h-4" />
          Send email notification
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="px-4 py-2"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
        >
          {isEdit ? "Save Changes" : "Create Alert"}
        </Button>
      </div>
    </form>
  );
}

export interface TestResult {
  success: boolean;
  mode: string;
  result: {
    triggered: boolean;
    message?: string;
  };
  emailSent?: boolean;
  emailError?: string;
}

function AlertCard({
  alert,
  onToggle,
  onEdit,
  onDelete,
  onTest,
}: {
  alert: AlertConfig;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: (forceTrigger: boolean, sendEmail: boolean) => Promise<TestResult | null>;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const info = ALERT_TYPE_INFO[alert.alert_type];
  const Icon = info.icon;

  const displayValue = alert.alert_type === "rep_mention"
    ? alert.representative_name
    : alert.topic;

  const locationLabel = STATE_OPTIONS.find(s => s.value === alert.district_code)?.label || alert.district_code;

  const handleTest = async (forceTrigger: boolean) => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(forceTrigger, true);
      setTestResult(result);
      // Clear result after 10 seconds
      setTimeout(() => setTestResult(null), 10000);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`p-4 rounded-lg border transition-all ${
      alert.enabled
        ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
        : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 opacity-60"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              alert.enabled
                ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
            }`}
          >
            <Icon className="w-5 h-5" />
          </button>
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100">
              &ldquo;{displayValue}&rdquo;
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {locationLabel}
              {alert.threshold && alert.alert_type !== "rep_mention" && (
                <span> &bull; Threshold: {alert.alert_type === "issue_surge" ? `${alert.threshold}%` : (alert.threshold / 100).toFixed(2)}</span>
              )}
              {alert.notify_email && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Test buttons */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => handleTest(false)}
              disabled={testing}
              className="px-2 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
              title="Run live check against real data"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
            </button>
            <button
              onClick={() => handleTest(true)}
              disabled={testing}
              className="px-2 py-1 text-xs rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
              title="Force trigger alert (demo mode) and send test email"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Demo"}
            </button>
          </div>

          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Test result display */}
      {testResult && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${
          testResult.result.triggered
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            : "bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {testResult.result.triggered ? (
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-zinc-400" />
            )}
            <span className="font-medium">
              {testResult.result.triggered ? "Alert Triggered!" : "No Alert (threshold not met)"}
            </span>
            <span className="text-xs text-zinc-500">
              ({testResult.mode === 'forced_trigger' ? 'Demo mode' : 'Live check'})
            </span>
          </div>
          {testResult.result.message && (
            <p className="text-zinc-600 dark:text-zinc-300 ml-6">{testResult.result.message}</p>
          )}
          {testResult.emailSent !== undefined && (
            <p className="text-xs text-zinc-500 ml-6 mt-1">
              {testResult.emailSent ? "Email sent successfully" : `Email not sent${testResult.emailError ? `: ${testResult.emailError}` : ''}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertsConfig({
  alerts,
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
  onTestAlert,
  loading = false,
}: AlertsConfigProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (data: AlertFormData) => {
    await onCreateAlert({
      alert_type: data.alert_type,
      topic: data.topic || undefined,
      representative_name: data.representative_name || undefined,
      district_code: data.district_code,
      threshold: data.alert_type === "rep_mention" ? undefined : data.threshold,
      notify_email: data.notify_email,
    });
    setShowForm(false);
  };

  const handleUpdate = async (id: string, data: AlertFormData) => {
    await onUpdateAlert(id, {
      topic: data.topic || undefined,
      representative_name: data.representative_name || undefined,
      district_code: data.district_code,
      threshold: data.alert_type === "rep_mention" ? undefined : data.threshold,
      notify_email: data.notify_email,
    });
    setEditingId(null);
  };

  // Group alerts by type
  const alertsByType = alerts.reduce((acc, alert) => {
    if (!acc[alert.alert_type]) {
      acc[alert.alert_type] = [];
    }
    acc[alert.alert_type].push(alert);
    return acc;
  }, {} as Record<AlertType, AlertConfig[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Bell className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Alert Configuration
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Set up alerts for topics and representatives
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          disabled={loading || showForm}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
        >
          <Plus className="w-4 h-4" />
          Add Alert
        </Button>
      </div>

      {/* New Alert Form */}
      {showForm && (
        <AlertForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Alerts by Type */}
      {(Object.keys(ALERT_TYPE_INFO) as AlertType[]).map((type) => {
        const typeAlerts = alertsByType[type] || [];
        const info = ALERT_TYPE_INFO[type];
        const Icon = info.icon;

        return (
          <div key={type} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <Icon className="w-4 h-4" />
              {info.label}s
              <span className="text-zinc-400 dark:text-zinc-500">({typeAlerts.length})</span>
            </div>

            {typeAlerts.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 italic pl-6">
                No {info.label.toLowerCase()} alerts configured
              </p>
            ) : (
              <div className="space-y-2">
                {typeAlerts.map((alert) => (
                  editingId === alert.id ? (
                    <AlertForm
                      key={alert.id}
                      initialData={{
                        alert_type: alert.alert_type,
                        topic: alert.topic || "",
                        representative_name: alert.representative_name || "",
                        district_code: alert.district_code,
                        threshold: alert.threshold || 50,
                        notify_email: alert.notify_email,
                      }}
                      onSubmit={(data) => handleUpdate(alert.id, data)}
                      onCancel={() => setEditingId(null)}
                      isEdit
                    />
                  ) : (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onToggle={() => onUpdateAlert(alert.id, { enabled: !alert.enabled })}
                      onEdit={() => setEditingId(alert.id)}
                      onDelete={() => onDeleteAlert(alert.id)}
                      onTest={async (forceTrigger, sendEmail) => {
                        if (onTestAlert) {
                          return onTestAlert(alert, forceTrigger, sendEmail);
                        }
                        return null;
                      }}
                    />
                  )
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Recommended Alerts - show when no alerts exist */}
      {alerts.length === 0 && !showForm && (
        <div className="space-y-4">
          <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
            <Bell className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-zinc-500 dark:text-zinc-400">
              No alerts configured yet
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Recommended Alerts
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Quick-add popular political topics to monitor
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {RECOMMENDED_ALERTS.map((preset) => {
                const info = ALERT_TYPE_INFO[preset.config.alert_type];
                const Icon = info.icon;
                return (
                  <button
                    key={preset.label}
                    onClick={() => onCreateAlert({ ...preset.config, notify_email: true })}
                    disabled={loading}
                    className="flex items-start gap-2 p-3 text-left rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-all disabled:opacity-50"
                  >
                    <Icon className="w-4 h-4 mt-0.5 text-zinc-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {preset.label}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {preset.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
