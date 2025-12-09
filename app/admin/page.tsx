"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Users, Settings, Plus, Trash2, Save, Bell, RefreshCw } from "lucide-react";
import AlertsConfig, { TestResult } from "@/app/components/admin/AlertsConfig";
import AlertHistory from "@/app/components/admin/AlertHistory";
import type { AlertConfig, AlertHistoryEntry, CreateAlertRequest } from "@/types/alerts";

interface AuthSettings {
  mode: "restricted" | "public" | "guest";
  authorizedEmails: string[];
  adminEmails: string[];
}

type TabId = "auth" | "alerts";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("auth");
  const [settings, setSettings] = useState<AuthSettings>({
    mode: "restricted",
    authorizedEmails: [],
    adminEmails: [],
  });
  const [newEmail, setNewEmail] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Alerts state
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);

  // Check if current user is admin based on fetched settings
  const isAdmin = settings.adminEmails.includes(session?.user?.email || "");

  // Fetch settings from server
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const [alertsRes, historyRes] = await Promise.all([
        fetch("/api/admin/alerts"),
        fetch("/api/admin/alerts/history?limit=20"),
      ]);

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setAlertHistory(data.history || []);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (activeTab === "alerts" && isAdmin) {
      fetchAlerts();
    }
  }, [activeTab, isAdmin, fetchAlerts]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && !loading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [status, isAdmin, loading, router]);

  const saveSettings = async () => {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage("Settings saved successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Failed to save settings");
      }
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addAuthorizedEmail = () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setMessage("Please enter a valid email address");
      return;
    }

    if (settings.authorizedEmails.includes(newEmail.toLowerCase())) {
      setMessage("Email already in authorized list");
      return;
    }

    setSettings({
      ...settings,
      authorizedEmails: [...settings.authorizedEmails, newEmail.toLowerCase()],
    });
    setNewEmail("");
    setMessage("Email added to authorized list (don't forget to save!)");
  };

  const removeAuthorizedEmail = (email: string) => {
    // Prevent removing yourself
    if (email === session?.user?.email) {
      setMessage("You cannot remove your own email from authorized users");
      return;
    }

    setSettings({
      ...settings,
      authorizedEmails: settings.authorizedEmails.filter((e) => e !== email),
    });
    setMessage("Email removed from authorized list (don't forget to save!)");
  };

  const addAdminEmail = () => {
    if (!newAdminEmail.trim() || !newAdminEmail.includes("@")) {
      setMessage("Please enter a valid email address");
      return;
    }

    if (settings.adminEmails.includes(newAdminEmail.toLowerCase())) {
      setMessage("Email already in admin list");
      return;
    }

    // Auto-add to authorized emails if not already there
    const updatedAuthorized = settings.authorizedEmails.includes(
      newAdminEmail.toLowerCase()
    )
      ? settings.authorizedEmails
      : [...settings.authorizedEmails, newAdminEmail.toLowerCase()];

    setSettings({
      ...settings,
      authorizedEmails: updatedAuthorized,
      adminEmails: [...settings.adminEmails, newAdminEmail.toLowerCase()],
    });
    setNewAdminEmail("");
    setMessage("Email added to admin list (don't forget to save!)");
  };

  const removeAdminEmail = (email: string) => {
    // Prevent removing yourself
    if (email === session?.user?.email) {
      setMessage("You cannot remove yourself from admin users");
      return;
    }

    setSettings({
      ...settings,
      adminEmails: settings.adminEmails.filter((e) => e !== email),
    });
    setMessage("Email removed from admin list (don't forget to save!)");
  };

  // Alert handlers
  const handleCreateAlert = async (data: CreateAlertRequest) => {
    try {
      const response = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const { alert } = await response.json();
        setAlerts([...alerts, alert]);
        setMessage("Alert created successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        const error = await response.json();
        setMessage(`Failed to create alert: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to create alert:", error);
      setMessage("Failed to create alert");
    }
  };

  const handleUpdateAlert = async (id: string, updates: Partial<AlertConfig>) => {
    try {
      const response = await fetch("/api/admin/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      if (response.ok) {
        const { alert } = await response.json();
        setAlerts(alerts.map((a) => (a.id === id ? alert : a)));
      } else {
        const error = await response.json();
        setMessage(`Failed to update alert: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to update alert:", error);
      setMessage("Failed to update alert");
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/alerts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAlerts(alerts.filter((a) => a.id !== id));
        setMessage("Alert deleted");
        setTimeout(() => setMessage(""), 3000);
      } else {
        const error = await response.json();
        setMessage(`Failed to delete alert: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to delete alert:", error);
      setMessage("Failed to delete alert");
    }
  };

  const handleCheckAlerts = async () => {
    setCheckingAlerts(true);
    try {
      const response = await fetch("/api/admin/alerts/check", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(
          `Checked ${result.checked} alerts. ${result.triggered.length} triggered.`
        );
        // Refresh history
        const historyRes = await fetch("/api/admin/alerts/history?limit=20");
        if (historyRes.ok) {
          const data = await historyRes.json();
          setAlertHistory(data.history || []);
        }
      } else {
        setMessage("Failed to check alerts");
      }
    } catch (error) {
      console.error("Failed to check alerts:", error);
      setMessage("Failed to check alerts");
    } finally {
      setCheckingAlerts(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleTestAlert = async (
    alert: AlertConfig,
    forceTrigger: boolean,
    sendEmail: boolean
  ): Promise<TestResult | null> => {
    try {
      const response = await fetch("/api/admin/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert, forceTrigger, sendTestEmail: sendEmail }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.emailSent) {
          setMessage("Test email sent successfully!");
          setTimeout(() => setMessage(""), 5000);
        }
        return result;
      } else {
        const error = await response.json();
        setMessage(`Test failed: ${error.error}`);
        return null;
      }
    } catch (error) {
      console.error("Failed to test alert:", error);
      setMessage("Failed to test alert");
      return null;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
          <p className="text-zinc-600 dark:text-zinc-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-zinc-700 dark:text-zinc-300" />
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Manage authentication and alerts
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("auth")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "auth"
                  ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Auth Settings
            </button>
            <button
              onClick={() => setActiveTab("alerts")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "alerts"
                  ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Bell className="w-4 h-4 inline-block mr-2" />
              Alerts
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.includes("success") || message.includes("added") || message.includes("deleted") || message.includes("Checked")
                ? "bg-green-100 dark:bg-green-950/30 text-green-900 dark:text-green-300 border border-green-200 dark:border-green-900"
                : "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-900 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900"
            }`}
          >
            {message}
          </div>
        )}

        {/* Auth Settings Tab */}
        {activeTab === "auth" && (
          <div className="grid gap-6">
            {/* Authentication Mode */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
                <h2 className="text-xl font-bold">Authentication Mode</h2>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="radio"
                    name="mode"
                    value="restricted"
                    checked={settings.mode === "restricted"}
                    onChange={(e) =>
                      setSettings({ ...settings, mode: e.target.value as "restricted" | "public" | "guest" })
                    }
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold">Restricted Access</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Only authorized emails can access the application
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="radio"
                    name="mode"
                    value="public"
                    checked={settings.mode === "public"}
                    onChange={(e) =>
                      setSettings({ ...settings, mode: e.target.value as "restricted" | "public" | "guest" })
                    }
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold">Public Access</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Anyone with a Google account can sign in
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="radio"
                    name="mode"
                    value="guest"
                    checked={settings.mode === "guest"}
                    onChange={(e) =>
                      setSettings({ ...settings, mode: e.target.value as "restricted" | "public" | "guest" })
                    }
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold">Guest Mode</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Allow access without authentication (Continue as Guest)
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Authorized Users */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
                <h2 className="text-xl font-bold">Authorized Users</h2>
                <span className="text-sm text-zinc-500">
                  ({settings.authorizedEmails.length} users)
                </span>
              </div>

              <div className="mb-4 flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addAuthorizedEmail()}
                  placeholder="email@example.com"
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-zinc-500 outline-none"
                />
                <button
                  onClick={addAuthorizedEmail}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {settings.authorizedEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{email}</span>
                      {settings.adminEmails.includes(email) && (
                        <span className="px-2 py-0.5 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded">
                          Admin
                        </span>
                      )}
                      {email === session?.user?.email && (
                        <span className="px-2 py-0.5 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeAuthorizedEmail(email)}
                      disabled={email === session?.user?.email}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Users */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
                <h2 className="text-xl font-bold">Admin Users</h2>
                <span className="text-sm text-zinc-500">
                  ({settings.adminEmails.length} admins)
                </span>
              </div>

              <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-700 dark:text-zinc-300">
                <strong>Note:</strong> Admin users have access to this panel and
                can manage all settings.
              </div>

              <div className="mb-4 flex gap-2">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addAdminEmail()}
                  placeholder="admin@example.com"
                  className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-zinc-500 outline-none"
                />
                <button
                  onClick={addAdminEmail}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {settings.adminEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      <span className="text-sm">{email}</span>
                      {email === session?.user?.email && (
                        <span className="px-2 py-0.5 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeAdminEmail(email)}
                      disabled={email === session?.user?.email}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-800 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save All Changes"}
            </button>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === "alerts" && (
          <div className="grid gap-6">
            {/* Check Now Button */}
            <div className="flex justify-end">
              <button
                onClick={handleCheckAlerts}
                disabled={checkingAlerts}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-lg flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${checkingAlerts ? "animate-spin" : ""}`} />
                {checkingAlerts ? "Checking..." : "Check Now"}
              </button>
            </div>

            {/* Alert Configuration */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <AlertsConfig
                alerts={alerts}
                onCreateAlert={handleCreateAlert}
                onUpdateAlert={handleUpdateAlert}
                onDeleteAlert={handleDeleteAlert}
                onTestAlert={handleTestAlert}
                loading={alertsLoading}
              />
            </div>

            {/* Alert History */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <AlertHistory history={alertHistory} loading={alertsLoading} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
