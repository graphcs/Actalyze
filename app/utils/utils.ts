// Helper function to map stool types to descriptions
export function getStoolTypeDescription(stoolType: string): string {
    const stoolTypeMap: Record<string, string> = {
        'type-1': 'Bristol Type 1 (Separate Hard lumps)',
        'type-2': 'Bristol Type 2 (Lumpy and sausage like)',
        'type-3': 'Bristol Type 3 (Cracked sausage surface)',
        'type-4': 'Bristol Type 4 (Smooth soft sausage)',
        'type-5': 'Bristol Type 5 (Soft blobs with clear cut edges)',
        'type-6': 'Bristol Type 6 (Mushy consistency with ragged edges)',
        'type-7': 'Bristol Type 7 (Liquid consistency with no solid pieces)'
    }
    return stoolTypeMap[stoolType] || stoolType
}

// Helper function to convert mood strings to numeric values
export function getMoodScore(moodString: string): number {
    const moodMap: Record<string, number> = {
        'happy': 5,      // 😊 Very positive
        'calm': 4,       // 😌 Positive  
        'neutral': 3,    // 😐 Neutral
        'tired': 2,      // 😴 Slightly negative (affects wellbeing)
        'stressed': 2,   // 😣 Negative
        'anxious': 2,    // 😰 Negative
        'sad': 1,        // 😢 Very negative
        'angry': 1       // 😠 Very negative
    }
    return moodMap[moodString.toLowerCase()] || 3 // Default to neutral if unknown
}

// Helper function to map symptom severity to descriptions
export function getSymptomSeverityDescription(severity: string): string {
    const severityMap: Record<string, string> = {
        'mild': 'Mild - Occasional discomfort that doesn\'t significantly impact daily activities',
        'moderate': 'Moderate - Daily symptoms that affect comfort and some activities', 
        'severe': 'Severe - Significantly impacts daily life and activities, requiring immediate attention'
    }
    return severityMap[severity.toLowerCase()] || severity
}