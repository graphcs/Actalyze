"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import {
  validateAssessmentCompletion,
  getAssessmentDataSafely,
} from "@/lib/assessment-validation";
import { clearWeeklyReportCache } from "@/lib/weekly-report-cache";
import { supabase } from "@/lib/supabase";

type ProcessingStage =
  | "saving"
  | "generating"
  | "finalizing"
  | "complete"
  | "error";

interface ProcessingState {
  stage: ProcessingStage;
  message: string;
  progress: number;
}

const PROCESSING_STAGES: Record<ProcessingStage, ProcessingState> = {
  saving: {
    stage: "saving",
    message: "Saving your assessment...",
    progress: 33,
  },
  generating: {
    stage: "generating",
    message: "Generating your personalized report...",
    progress: 66,
  },
  finalizing: {
    stage: "finalizing",
    message: "Finalizing and sending to email...",
    progress: 100,
  },
  complete: {
    stage: "complete",
    message: "Complete!",
    progress: 100,
  },
  error: {
    stage: "error",
    message: "Processing failed. Please try again.",
    progress: 0,
  },
};

export default function CompletePage() {
  const [currentState, setCurrentState] = useState<ProcessingState>(
    PROCESSING_STAGES.saving
  );
  const [hasError, setHasError] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasProcessedRef = useRef(false);

  // Cleanup function
  const cleanupAfterProcessing = useCallback(() => {
    // Clear onboarding localStorage items
    localStorage.removeItem("gutRootOnboardingForm");
    localStorage.removeItem("gutRootOnboardingStep");
    localStorage.removeItem("gutRootInitialReason");
    localStorage.removeItem("gutRootProcessingStage");

    // Clear weekly report cache since new assessment data is available
    clearWeeklyReportCache();
  }, []);

  // Background processing function
  const triggerBackgroundProcessing = useCallback(async () => {
    // Prevent duplicate API calls
    if (hasProcessedRef.current) {
      return;
    }
    hasProcessedRef.current = true;

    try {
      const validation = validateAssessmentCompletion();
      const formData = getAssessmentDataSafely();

      if (!validation.isComplete || !formData || !user?.email) {
        throw new Error("Invalid assessment data");
      }

      // Get user profile for personalization
      const { getUserProfile } = await import("@/lib/database");
      const { profile } = await getUserProfile();

      // Save assessment to database first
      const { saveCompleteAssessment } = await import("@/lib/database");
      const initialReason = localStorage.getItem("gutRootInitialReason");
      const assessmentResult = await saveCompleteAssessment(
        formData,
        initialReason || undefined
      );

      if (!assessmentResult.assessmentId) {
        throw new Error("Failed to save assessment");
      }

      // Get session token for API authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Extract user name for personalization
      const firstName = profile?.first_name || "there";
      const lastName = profile?.last_name || undefined;

      // Trigger background report processing (fire-and-forget)
      fetch("/api/process-complete-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          assessmentId: assessmentResult.assessmentId,
          formData: formData,
          userEmail: user.email,
          userProfile: {
            firstName: firstName,
            lastName: lastName,
          },
          initialReason: initialReason,
          userId: user.id,
        }),
      }).catch((error) => {
        // Fire-and-forget: log error but don't block user flow
        console.error("Background report processing trigger failed:", error);
      });
    } catch (error) {
      // Fire-and-forget: log error but don't block user flow
      console.error("Background processing setup failed:", error);
    }
  }, [user]);

  // Main processing function
  const startProcessing = useCallback(async () => {
    try {
      // Start background processing immediately (fire-and-forget)
      triggerBackgroundProcessing();

      // Stage 1: Saving Assessment (UX timing only)
      setCurrentState(PROCESSING_STAGES.saving);
      localStorage.setItem("gutRootProcessingStage", "saving");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Stage 2: Generating Report (UX timing only)
      setCurrentState(PROCESSING_STAGES.generating);
      localStorage.setItem("gutRootProcessingStage", "generating");
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Stage 3: Finalizing and Sending (UX timing only)
      setCurrentState(PROCESSING_STAGES.finalizing);
      localStorage.setItem("gutRootProcessingStage", "finalizing");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Show complete state
      setCurrentState(PROCESSING_STAGES.complete);
      localStorage.setItem("gutRootProcessingStage", "complete");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Cleanup and redirect
      cleanupAfterProcessing();
      router.push("/report");
    } catch (error) {
      console.error("Processing failed:", error);
      setCurrentState(PROCESSING_STAGES.error);
      setHasError(true);
    }
  }, [router, triggerBackgroundProcessing, cleanupAfterProcessing]);

  // Check if user should be on this page and start processing
  useEffect(() => {
    // Wait for auth to load before making decisions
    if (loading) {
      return;
    }

    const validation = validateAssessmentCompletion();

    if (!validation.isComplete || !user?.email) {
      // No valid assessment data, redirect to initial question
      router.push("/onboarding/initial-question");
      return;
    }

    // Check if processing was already completed
    const completedStage = localStorage.getItem("gutRootProcessingStage");

    if (completedStage === "complete") {
      // Already completed, redirect to report
      router.push("/report");
      return;
    }

    // Prevent duplicate processing in React StrictMode
    if (hasProcessedRef.current) {
      return;
    }

    // Start processing from beginning or resume
    startProcessing();
  }, [user, router, startProcessing, loading]);

  const handleRetry = () => {
    setHasError(false);
    hasProcessedRef.current = false; // Reset processing flag for retry
    setCurrentState(PROCESSING_STAGES.saving);
    startProcessing();
  };

  // Show loading state while auth is loading
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
        style={{
          background: `
            radial-gradient(circle at top left, #B0D1A9 0%, transparent 50%),
            radial-gradient(circle at top right, #D7E3C7 0%, transparent 50%),
            radial-gradient(circle at bottom left, #D0E1C1 0%, transparent 50%),
            radial-gradient(circle at bottom right, #D2DCA6 0%, transparent 50%),
            linear-gradient(135deg, #B0D1A9 0%, #D7E3C7 25%, #D0E1C1 75%, #D2DCA6 100%)
          `,
        }}
      >
        <div className="w-full max-w-lg h-screen flex flex-col relative z-10">
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md text-center">
              <div className="flex justify-center space-x-2 mb-4">
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
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
        style={{
          background: `
               radial-gradient(circle at top left, #B0D1A9 0%, transparent 50%),
               radial-gradient(circle at top right, #D7E3C7 0%, transparent 50%),
               radial-gradient(circle at bottom left, #D0E1C1 0%, transparent 50%),
               radial-gradient(circle at bottom right, #D2DCA6 0%, transparent 50%),
               linear-gradient(135deg, #B0D1A9 0%, #D7E3C7 25%, #D0E1C1 75%, #D2DCA6 100%)
             `,
        }}
      >
        {/* Main Container */}
        <div className="w-full max-w-lg text-center relative z-10">
          <div className="bg-white rounded-3xl p-8 shadow-lg">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-dark-gray mb-4">
              Oops! Something went wrong
            </h1>
            <p className="text-medium-gray mb-6">
              We encountered an issue while processing your assessment. Please
              try again.
            </p>
            <button
              onClick={handleRetry}
              className="w-full py-3 px-6 cursor-pointer bg-orange-light text-dark font-semibold rounded-full"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden"
      style={{
        background: `
             radial-gradient(circle at top left, #B0D1A9 0%, transparent 50%),
             radial-gradient(circle at top right, #D7E3C7 0%, transparent 50%),
             radial-gradient(circle at bottom left, #D0E1C1 0%, transparent 50%),
             radial-gradient(circle at bottom right, #D2DCA6 0%, transparent 50%),
             linear-gradient(135deg, #B0D1A9 0%, #D7E3C7 25%, #D0E1C1 75%, #D2DCA6 100%)
           `,
      }}
    >
      {/* Main Container */}
      <div className="w-full max-w-lg h-screen flex flex-col relative z-10">
        {/* Brand Title */}
        <div className="pt-10 mb-28 md:mb-38">
          <Link href="/">
            <h1 className="brand-title text-4xl font-bold text-dark-green">
              GutRoot
            </h1>
          </Link>
        </div>

        {/* Content - Centered in remaining space */}
        <div className="flex-1 flex justify-center px-4">
          <div className="w-full max-w-md text-center">
            {/* Opened Inbox Image */}
            <Image
              src="/opened-inbox.png"
              alt="Opened inbox"
              width={128}
              height={128}
              className="mx-auto mb-6"
            />

            {/* Processing Message */}
            <h1 className="text-2xl font-bold text-dark-gray mb-2">
              {currentState.message}
            </h1>

            <p className="text-medium-gray mb-8">
              {currentState.stage === "complete"
                ? "Your personalized report is ready!"
                : "Please wait while we process your assessment..."}
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-orange-primary h-2 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${currentState.progress}%` }}
              />
            </div>

            {/* Checkmark when complete */}
            {currentState.stage === "complete" && (
              <div className="text-green-600 text-6xl">✓</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
