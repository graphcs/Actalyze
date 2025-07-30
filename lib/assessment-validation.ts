import { OnboardingFormData, FORM_QUESTIONS } from '@/types/onboarding'

export interface ValidationResult {
    isValid: boolean
    isComplete: boolean
    hasData: boolean
    missingFields: string[]
    completionPercentage: number
}

export function validateAssessmentCompletion(): ValidationResult {
    try {
        // Check if form data exists
        const savedFormData = localStorage.getItem('gutRootOnboardingForm')
        const savedStep = localStorage.getItem('gutRootOnboardingStep')
        const savedReason = localStorage.getItem('gutRootInitialReason')

        if (!savedFormData) {
            return {
                isValid: false,
                isComplete: false,
                hasData: false,
                missingFields: [],
                completionPercentage: 0
            }
        }

        const formData: OnboardingFormData = JSON.parse(savedFormData)
        const currentStep = savedStep ? parseInt(savedStep) : 0

        // Check required fields completion
        const requiredQuestions = FORM_QUESTIONS.filter(q => q.required)
        const missingFields: string[] = []
        let filledFields = 0

        requiredQuestions.forEach(question => {
            const fieldValue = formData[question.id]

            // Check if field is properly filled based on its type
            let isFieldValid = false

            switch (question.type) {
                case 'text-input':
                case 'text-area':
                case 'single-select':
                case 'image-select':
                    isFieldValid = typeof fieldValue === 'string' && fieldValue.trim() !== ''
                    break

                case 'multi-select':
                    isFieldValid = Array.isArray(fieldValue) && fieldValue.length > 0
                    break

                case 'slider':
                    isFieldValid = typeof fieldValue === 'number' && fieldValue > 0
                    break

                default:
                    isFieldValid = fieldValue !== undefined && fieldValue !== null
            }

            if (isFieldValid) {
                filledFields++
            } else {
                missingFields.push(question.id)
            }
        })

        const completionPercentage = (filledFields / requiredQuestions.length) * 100
        const isComplete = missingFields.length === 0 && Boolean(savedReason)

        // Additional validation: check if user actually progressed through the flow
        const totalSteps = FORM_QUESTIONS.length + 1 // +1 for initial question
        const hasProgressedThroughFlow = currentStep >= totalSteps || isComplete

        return {
            isValid: Boolean(hasProgressedThroughFlow && completionPercentage > 0),
            isComplete: Boolean(isComplete && hasProgressedThroughFlow),
            hasData: true,
            missingFields,
            completionPercentage: Math.round(completionPercentage)
        }

    } catch (error) {
        console.error('Error validating assessment completion:', error)
        return {
            isValid: false,
            isComplete: false,
            hasData: false,
            missingFields: [],
            completionPercentage: 0
        }
    }
}

export function clearInvalidAssessmentData(): void {
    try {
        localStorage.removeItem('gutRootOnboardingForm')
        localStorage.removeItem('gutRootOnboardingStep')
        localStorage.removeItem('gutRootInitialReason')
        console.log('🧹 Cleared invalid assessment data')
    } catch (error) {
        console.error('Error clearing assessment data:', error)
    }
}

export function getAssessmentDataSafely(): OnboardingFormData | null {
    try {
        const validation = validateAssessmentCompletion()

        if (!validation.isComplete) {
            return null
        }

        const savedFormData = localStorage.getItem('gutRootOnboardingForm')
        return savedFormData ? JSON.parse(savedFormData) : null

    } catch (error) {
        console.error('Error getting assessment data safely:', error)
        return null
    }
}