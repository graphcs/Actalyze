"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSessionToken, useAuth } from "@/lib/auth";
import {
  getCachedWeeklyReport,
  setCachedWeeklyReport,
} from "@/lib/weekly-report-cache";
import {
  validateAssessmentCompletion,
  getAssessmentDataSafely,
} from "@/lib/assessment-validation";
import { supabase } from "@/lib/supabase";
import { clearWeeklyReportCache } from "@/lib/weekly-report-cache";

interface WeeklyReportData {
  digestive_score: number;
  bowel_trends: string;
  goal_reminders: string;
  symptom_patterns_analysis: string;
  ai_tip_of_week: string;
  diet_recommendations?: string;
  supplement_suggestions?: string;
  lifestyle_changes?: string;
}

interface WeeklyData {
  totalAssessments: number;
  daysWithAssessments: number;
  averageDigestiveScore: number;
  digestiveScoreRange: { min: number; max: number };
}

export default function ReportPage() {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const hasProcessedAssessmentRef = useRef(false);
  const [isProcessingFreshAssessment, setIsProcessingFreshAssessment] =
    useState(false);
  const [shouldReloadReport, setShouldReloadReport] = useState(0);
  const router = useRouter();

  // Process fresh onboarding assessment in background
  const processFreshAssessment = useCallback(async () => {
    // Prevent multiple calls - this is the key fix!
    if (hasProcessedAssessmentRef.current) return;

    const validation = validateAssessmentCompletion();

    if (validation.isComplete && user?.email) {
      console.log(
        "🎯 processFreshAssessment: Starting fresh assessment processing"
      );
      hasProcessedAssessmentRef.current = true;
      setIsProcessingFreshAssessment(true);

      // Clear weekly report cache IMMEDIATELY since new assessment data is available
      // This prevents loadWeeklyReport from showing stale cached data
      console.log(
        "🗑️ processFreshAssessment: Clearing weekly report cache immediately"
      );
      clearWeeklyReportCache();

      try {
        const formData = getAssessmentDataSafely();
        console.log("🔍 processFreshAssessment: Form data:", formData);
        if (!formData) {
          console.log("❌ processFreshAssessment: No form data found, exiting");
          return;
        }

        // Save assessment and get user profile in parallel
        const [profileResult, assessmentResult] = await Promise.all([
          // Get user profile data
          (async () => {
            try {
              const { getUserProfile } = await import("@/lib/database");
              const { profile } = await getUserProfile();
              return { profile };
            } catch {
              return { profile: null };
            }
          })(),

          // Save assessment to database
          (async () => {
            try {
              const { saveCompleteAssessment } = await import("@/lib/database");
              const initialReason = localStorage.getItem(
                "gutRootInitialReason"
              );
              const result = await saveCompleteAssessment(
                formData,
                initialReason || undefined
              );
              return result;
            } catch {
              return { assessmentId: null, error: "Assessment save failed" };
            }
          })(),
        ]);

        const { profile } = profileResult;
        const { assessmentId } = assessmentResult;

        if (assessmentId) {
          // Trigger background report processing (fire-and-forget)
          const {
            data: { session },
          } = await supabase.auth.getSession();

          fetch("/api/process-complete-report", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token || ""}`,
            },
            body: JSON.stringify({
              assessmentId,
              formData,
              userEmail: user.email,
              userProfile: {
                firstName: profile?.first_name || "there",
                lastName: profile?.last_name,
              },
              initialReason: localStorage.getItem("gutRootInitialReason"),
              userId: user.id,
            }),
          }).catch(() => {
            console.log("Background report processing initiated");
          });

          // Clear localStorage after processing
          localStorage.removeItem("gutRootOnboardingForm");
          localStorage.removeItem("gutRootOnboardingStep");
          localStorage.removeItem("gutRootInitialReason");
        }
      } catch {
        console.log(
          "✅ processFreshAssessment: Assessment processing completed in background"
        );
      } finally {
        console.log(
          "📝 processFreshAssessment: Cleaning up, setting processing to false"
        );
        setIsProcessingFreshAssessment(false);
        // Keep hasProcessedAssessmentRef.current = true to prevent re-processing

        // Trigger a report reload after background processing completes
        setTimeout(() => {
          console.log(
            "🔄 Triggering report reload after background processing"
          );
          setShouldReloadReport((prev) => prev + 1);
        }, 2000); // Small delay to ensure background processing is complete
      }
    }
  }, [user]);

  const loadWeeklyReport = useCallback(async () => {
    // Prevent double calls in React strict mode (but allow reloads triggered by shouldReloadReport)
    if (hasLoadedRef.current && shouldReloadReport === 0) return;

    // Reset the ref when shouldReloadReport changes to allow reloading
    if (shouldReloadReport > 0) {
      hasLoadedRef.current = false;
      console.log(
        "🔄 loadWeeklyReport: Reset hasLoadedRef due to shouldReloadReport change"
      );
    }

    hasLoadedRef.current = true;

    try {
      // Get the current session token
      const sessionToken = await getSessionToken();

      if (!sessionToken) {
        router.push("/auth");
        return;
      }

      // First, get assessment metadata for cache validation
      const metadataResponse = await fetch("/api/weekly-assessment-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!metadataResponse.ok) {
        throw new Error("Failed to fetch assessment metadata");
      }

      const { metadata } = await metadataResponse.json();

      // Redirect if no assessments
      if (!metadata.hasAssessments) {
        router.push("/onboarding/initial-question");
        return;
      }

      // Check cache first
      const cachedReport = getCachedWeeklyReport(
        metadata.assessmentCount,
        metadata.assessmentIds
      );

      if (cachedReport) {
        // Use cached data
        setReportData(cachedReport.report);
        setWeeklyData(cachedReport.weeklyData);
        console.log("📋 Loaded from cache:", cachedReport.metadata);
        return;
      }

      console.log("🔄 Cache miss - generating new weekly report...");

      // Generate new weekly progress report
      const response = await fetch("/api/generate-weekly-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Weekly report generation failed:", errorData.error);

        if (response.status === 200 && errorData.redirect) {
          router.push(errorData.redirect);
          return;
        }

        throw new Error(`Failed to generate weekly report: ${errorData.error}`);
      }

      const { report, weeklyData: weekly } = await response.json();
      console.log("✅ Generated new weekly report");

      const weeklyReport = {
        ...report,
        digestive_score: report.digestive_score, // Use AI-generated score directly
      };

      // Cache the new report
      setCachedWeeklyReport(
        weeklyReport,
        weekly,
        metadata.assessmentCount,
        metadata.assessmentIds
      );

      setReportData(weeklyReport);
      setWeeklyData(weekly);
    } catch (error) {
      console.error("Error loading weekly report:", error);
      router.push("/onboarding/initial-question");
    } finally {
      setIsLoading(false);
    }
  }, [router, shouldReloadReport]);

  useEffect(() => {
    // Process fresh assessment first, then load weekly report
    const initializeReport = async () => {
      await processFreshAssessment();
      await loadWeeklyReport();
    };

    initializeReport();
  }, [processFreshAssessment, loadWeeklyReport]);

  const getWeekRange = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6); // Get 7 days ago (including today)

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
    };

    return `Week of ${formatDate(startOfWeek)}–${formatDate(
      today
    )}, ${today.getFullYear()}`;
  };

  const formatBulletPoints = (text: string) => {
    if (!text) return [];

    // Split by lines and filter out empty ones
    const lines = text.split("\n").filter((line) => line.trim().length > 0);

    return lines.map((line) => {
      // Remove bullet indicators and clean the line
      return line
        .replace(/^[-•*]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .trim();
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-light flex items-center justify-center">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-orange-primary rounded-full animate-bounce"></div>
          <div
            className="w-3 h-3 bg-orange-primary rounded-full animate-bounce"
            style={{ animationDelay: "0.1s" }}
          ></div>
          <div
            className="w-3 h-3 bg-orange-primary rounded-full animate-bounce"
            style={{ animationDelay: "0.2s" }}
          ></div>
        </div>
      </div>
    );
  }

  if (!reportData || !weeklyData) {
    return (
      <div className="min-h-screen bg-cream-light flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-xl font-medium text-dark-gray mb-4">
            No weekly data found
          </div>
          <div className="text-medium-gray mb-6">
            Complete at least one assessment to see your weekly progress
          </div>
          <Link href="/onboarding/initial-question" className="btn-primary">
            Take Assessment
          </Link>
        </div>
      </div>
    );
  }

  const getScoreDescription = (score: number) => {
    if (score >= 8) return "Excellent digestion";
    if (score >= 6) return "Overall good digestion";
    if (score >= 4) return "Moderate digestion";
    return "Needs attention";
  };

  return (
    <div className="min-h-screen bg-cream-light px-4 relative overflow-hidden">
      {/* Orange Gradient Overlay */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: `linear-gradient(
            45deg,
            rgba(250, 219, 107, 0.8) 0%,
            rgba(255, 248, 225, 0.6) 40%,
            rgba(255, 251, 236, 0.4) 70%,
            transparent 85%
          )`,
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
            onClick={() => router.push("/profile")}
            className="p-2 hover:cursor-pointer"
          >
            <img src="/Profile.png" alt="Profile" className="w-7 h-7" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-8">
          {/* Weekly Digestive Score Section */}
          <div className="mb-6">
            <h2 className="text-3xl font-semibold text-black mb-4">
              Digestive score
            </h2>

            <div className="flex items-baseline justify-center mb-3">
              <span className="text-7xl font-semibold text-orange-primary">
                {reportData.digestive_score}
              </span>
              <span className="text-2xl font-semibold text-orange-primary ml-1">
                /10
              </span>
            </div>

            <div className="text-xl text-center font-medium text-gray-500 mb-2">
              {getScoreDescription(reportData.digestive_score)}
            </div>

            {/* Daily Log Button */}
            <div className="flex justify-center mb-6">
              <Link
                href="/onboarding/initial-question"
                className="w-[90%] md:w-[50%] py-4 px-8 bg-orange-light text-xl text-dark font-semibold rounded-full text-center"
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
              {formatBulletPoints(reportData.bowel_trends).map(
                (point, index) => (
                  <div key={index} className="mb-2">
                    {point}
                  </div>
                )
              )}
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
              {formatBulletPoints(reportData.goal_reminders).map(
                (point, index) => (
                  <div key={index} className="mb-2">
                    {point}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Additional sections if available */}
          {reportData.diet_recommendations && (
            <div className="mb-8">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-orange-primary mr-3"></div>
                <h3 className="text-3xl font-semibold text-dark-green">
                  Diet recommendations
                </h3>
              </div>
              <div className="text-xl font-medium text-black leading-relaxed">
                {formatBulletPoints(reportData.diet_recommendations).map(
                  (point, index) => (
                    <div key={index} className="mb-2">
                      {point}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {reportData.supplement_suggestions && (
            <div className="mb-8">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-orange-primary mr-3"></div>
                <h3 className="text-3xl font-semibold text-dark-green">
                  Supplement suggestions
                </h3>
              </div>
              <div className="text-xl font-medium text-black leading-relaxed">
                {formatBulletPoints(reportData.supplement_suggestions).map(
                  (point, index) => (
                    <div key={index} className="mb-2">
                      {point}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {reportData.lifestyle_changes && (
            <div className="mb-8">
              <div className="flex items-center mb-3">
                <div className="w-1 h-6 bg-orange-primary mr-3"></div>
                <h3 className="text-3xl font-semibold text-dark-green">
                  Lifestyle changes
                </h3>
              </div>
              <div className="text-xl font-medium text-black leading-relaxed">
                {formatBulletPoints(reportData.lifestyle_changes).map(
                  (point, index) => (
                    <div key={index} className="mb-2">
                      {point}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Symptom Patterns Analysis */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <div className="w-1 h-6 bg-orange-primary mr-3"></div>
              <h3 className="text-3xl font-semibold text-dark-green">
                Symptom patterns
              </h3>
            </div>
            <div className="text-xl font-medium text-black leading-relaxed">
              {formatBulletPoints(reportData.symptom_patterns_analysis).map(
                (point, index) => (
                  <div key={index} className="mb-2">
                    {point}
                  </div>
                )
              )}
            </div>
          </div>

          {/* AI Tip of the Week - Highlighted Box */}
          {reportData.ai_tip_of_week && (
            <div className="bg-orange-pale rounded-xl p-4 mb-8">
              <h3 className="text-xl font-semibold text-black mb-3">
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
  );
}
