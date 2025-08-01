// Utility functions for managing onboarding progress

import { OnboardingFormData } from '@/types/onboarding'

export interface OnboardingProgress {
    hasProgress: boolean
    currentStep?: number
    formData?: OnboardingFormData
    initialReason?: string
}

export function checkOnboardingProgress(): OnboardingProgress {
    if (typeof window === 'undefined') {
        return { hasProgress: false }
    }

    const savedFormData = localStorage.getItem('gutRootOnboardingForm')
    const savedStep = localStorage.getItem('gutRootOnboardingStep')
    const initialReason = localStorage.getItem('gutRootInitialReason')

    const hasProgress = !!(savedFormData || savedStep || initialReason)

    if (!hasProgress) {
        return { hasProgress: false }
    }

    return {
        hasProgress: true,
        currentStep: savedStep ? parseInt(savedStep) : undefined,
        formData: savedFormData ? JSON.parse(savedFormData) : undefined,
        initialReason: initialReason || undefined
    }
}

export function clearOnboardingProgress(): void {
    if (typeof window === 'undefined') return

    localStorage.removeItem('gutRootOnboardingForm')
    localStorage.removeItem('gutRootOnboardingStep')
    localStorage.removeItem('gutRootInitialReason')
}

export function getProgressDescription(progress: OnboardingProgress): string {
    if (!progress.hasProgress) return ''

    if (progress.initialReason && !progress.currentStep) {
        return `You selected "${progress.initialReason}" as your main concern`
    }

    if (progress.currentStep) {
        const totalSteps = 13 // Total number of onboarding steps
        return `You're on step ${progress.currentStep} of ${totalSteps} questions`
    }

    return 'You have some progress saved'
} 