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
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import type { AlertConfig, AlertType, CreateAlertRequest } from "@/types/alerts";

interface AlertsConfigProps {
  alerts: AlertConfig[];
  onCreateAlert: (alert: CreateAlertRequest) => Promise<void>;
  onUpdateAlert: (id: string, updates: Partial<AlertConfig>) => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
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
          <input
            type="text"
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            placeholder="e.g., immigration, healthcare, economy"
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
            Threshold: {formData.alert_type === "issue_surge" ? `${formData.threshold}% above baseline` : `${(formData.threshold / 100).toFixed(2)} sentiment shift`}
          </label>
          <input
            type="range"
            min={formData.alert_type === "issue_surge" ? 20 : 10}
            max={formData.alert_type === "issue_surge" ? 200 : 80}
            value={formData.threshold}
            onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{formData.alert_type === "issue_surge" ? "20% (sensitive)" : "0.1 (sensitive)"}</span>
            <span>{formData.alert_type === "issue_surge" ? "200% (rare)" : "0.8 (rare)"}</span>
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

function AlertCard({
  alert,
  onToggle,
  onEdit,
  onDelete,
}: {
  alert: AlertConfig;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const info = ALERT_TYPE_INFO[alert.alert_type];
  const Icon = info.icon;

  const displayValue = alert.alert_type === "rep_mention"
    ? alert.representative_name
    : alert.topic;

  const locationLabel = STATE_OPTIONS.find(s => s.value === alert.district_code)?.label || alert.district_code;

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
      alert.enabled
        ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
        : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 opacity-60"
    }`}>
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
              <span> &bull; Threshold: {alert.alert_type === "issue_surge" ? `${alert.threshold}%` : alert.threshold}</span>
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
  );
}

export default function AlertsConfig({
  alerts,
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
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
                    />
                  )
                ))}
              </div>
            )}
          </div>
        );
      })}

      {alerts.length === 0 && !showForm && (
        <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
          <Bell className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No alerts configured yet
          </p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
            Click &ldquo;Add Alert&rdquo; to get started
          </p>
        </div>
      )}
    </div>
  );
}
