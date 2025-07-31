// Food upload related interfaces
export interface FoodImage {
    id: string
    file?: File
    url?: string
    name: string
    size: number
    type: string
    uploadProgress?: number
    status: 'pending' | 'uploading' | 'uploaded' | 'error'
    error?: string
    thumbnail?: string
}

export interface FoodUploadData {
    mode: 'text' | 'upload'
    textInput?: string
    images?: FoodImage[]
}

export interface OnboardingFormData {
    age: string
    gender: string
    gutConcerns: string[]
    bowelFrequency: string
    energyLevel: number
    hydrationHabits: string
    sleepQuality: string | null // Optional
    moodTracking: string
    dietaryPattern: string
    culturalPreference: string
    foodSensitivities: string[]
    stoolType: string
    foodRating: FoodUploadData
}

export interface FormQuestion {
    id: keyof OnboardingFormData
    title: string
    type: 'single-select' | 'multi-select' | 'slider' | 'image-select' | 'text-input' | 'text-area' | 'food-upload'
    required: boolean
    options?: QuestionOption[]
    sliderConfig?: SliderConfig
    imageOptions?: ImageOption[]
    placeholder?: string
    showBubble?: boolean
}

export interface QuestionOption {
    value: string
    label: string
    emoji?: string
}

export interface SliderConfig {
    min: number
    max: number
    step: number
    labels: {
        [key: number]: string
    }
}

export interface ImageOption {
    value: string
    imageSrc: string
    title: string
    description: string
}

export interface FormStep {
    currentStep: number
    totalSteps: number
    isComplete: boolean
    formData: OnboardingFormData
}

// Form questions configuration
export const FORM_QUESTIONS: FormQuestion[] = [
    {
        id: 'age',
        title: 'What is your age?',
        type: 'text-input',
        required: true,
        placeholder: 'Enter your age'
    },
    {
        id: 'gender',
        title: 'What is your gender?',
        type: 'single-select',
        required: true,
        options: [
            { value: 'man', label: 'Man' },
            { value: 'woman', label: 'Woman' },
            { value: 'non-binary', label: 'Non-binary' },
            { value: 'self-identify', label: 'Self Identify' },
            { value: 'prefer-not-to-say', label: 'Prefer not to say' }
        ]
    },
    {
        id: 'gutConcerns',
        title: 'What are your primary gut concerns? (multi-select)',
        type: 'multi-select',
        required: true,
        options: [
            { value: 'bloating', label: 'Bloating' },
            { value: 'constipation', label: 'Constipation' },
            { value: 'diarrhea', label: 'Diarrhea' },
            { value: 'acid-reflux', label: 'Acid reflux/heartburn' },
            { value: 'irregular-stool', label: 'Irregular stool' },
            { value: 'food-sensitivities', label: 'Food sensitivities' },
            { value: 'gas', label: 'Gas' },
            { value: 'cramping', label: 'Cramping' },
            { value: 'brain-fog', label: 'Brain fog' },
            { value: 'skin-issues', label: 'Skin issues' }
        ]
    },
    {
        id: 'bowelFrequency',
        title: 'How often do you have bowel movements?',
        type: 'single-select',
        required: true,
        options: [
            { value: '3-plus-daily', label: '3 or more times per day' },
            { value: '2-daily', label: '2 times per day' },
            { value: 'once-daily', label: 'Once per day' },
            { value: 'every-other-day', label: 'Every other day' },
            { value: '2-3-weekly', label: '2–3 times per week' },
            { value: 'once-weekly', label: 'Once per week' },
            { value: 'less-weekly', label: 'Less than once per week' },
            { value: 'varies', label: 'Varies / not consistent' }
        ]
    },
    {
        id: 'energyLevel',
        title: 'How is your energy level?',
        type: 'slider',
        required: true,
        sliderConfig: {
            min: 1,
            max: 5,
            step: 1,
            labels: {
                1: 'Exhausted all day',
                2: 'Low energy, frequent crashes',
                3: 'Manageable but dips after meals',
                4: 'Generally good energy',
                5: 'High and consistent energy'
            }
        }
    },
    {
        id: 'hydrationHabits',
        title: 'How much water do you drink daily?',
        type: 'single-select',
        required: true,
        options: [
            { value: 'under-4', label: '<4 glasses/day' },
            { value: '4-6', label: '4–6 glasses/day' },
            { value: '7-9', label: '7–9 glasses/day' },
            { value: '10-plus', label: '10+ glasses/day' },
            { value: 'track-actively', label: 'I track hydration actively' }
        ]
    },
    {
        id: 'sleepQuality',
        title: 'How would you rate your sleep quality? (optional)',
        type: 'single-select',
        required: false,
        options: [
            { value: 'poor', label: 'Poor (frequent wakeups or <6 hrs)' },
            { value: 'average', label: 'Average (6–7 hrs, some wakeups)' },
            { value: 'good', label: 'Good (7–8 hrs, restful)' },
            { value: 'excellent', label: 'Excellent (8+ hrs, deep & consistent)' }
        ]
    },
    {
        id: 'moodTracking',
        title: 'How are you feeling today? (single-select)',
        type: 'single-select',
        required: true,
        options: [
            { value: 'happy', label: 'Happy', emoji: '😊' },
            { value: 'calm', label: 'Calm', emoji: '😌' },
            { value: 'stressed', label: 'Stressed', emoji: '😣' },
            { value: 'anxious', label: 'Anxious', emoji: '😰' },
            { value: 'sad', label: 'Sad', emoji: '😢' },
            { value: 'angry', label: 'Angry', emoji: '😠' },
            { value: 'tired', label: 'Tired', emoji: '😴' },
            { value: 'neutral', label: 'Neutral', emoji: '😐' }
        ]
    },
    {
        id: 'dietaryPattern',
        title: 'What is your dietary pattern?',
        type: 'single-select',
        required: true,
        options: [
            { value: 'veg', label: 'Veg' },
            { value: 'non-veg', label: 'Non-Veg' },
            { value: 'vegan', label: 'Vegan' },
            { value: 'keto', label: 'Keto' },
            { value: 'if', label: 'IF' },
            { value: 'other', label: 'Other' }
        ]
    },
    {
        id: 'culturalPreference',
        title: 'Cultural or regional food preference:',
        type: 'single-select',
        required: true,
        options: [
            { value: 'south-asian', label: 'South Asian' },
            { value: 'east-southeast-asian', label: 'East & Southeast Asian' },
            { value: 'mediterranean-middle-eastern', label: 'Mediterranean & Middle Eastern' },
            { value: 'latin-american', label: 'Latin American' },
            { value: 'european', label: 'European (Western, Central, Eastern)' },
            { value: 'african', label: 'African (Primarily West)' },
            { value: 'north-american', label: 'North American' }
        ]
    },
    {
        id: 'foodSensitivities',
        title: 'Food sensitivities or allergies:',
        type: 'multi-select',
        required: false,
        options: [
            { value: 'lactose-intolerance', label: 'Lactose intolerance' },
            { value: 'gluten-sensitivity', label: 'Gluten sensitivity' },
            { value: 'nut-allergy', label: 'Nut allergy' },
            { value: 'fodmap-intolerance', label: 'FODMAP intolerance' },
            { value: 'soy-allergy', label: 'Soy allergy' },
            { value: 'shellfish-allergy', label: 'Shellfish allergy' },
            { value: 'egg-allergy', label: 'Egg allergy' }
        ]
    },
    {
        id: 'stoolType',
        title: 'What is your stool type?',
        type: 'image-select',
        required: true,
        imageOptions: [
            {
                value: 'type-1',
                imageSrc: '/stool-type-1.png',
                title: 'Type 1',
                description: 'Separate hard lumps'
            },
            {
                value: 'type-2',
                imageSrc: '/stool-type-2.png',
                title: 'Type 2',
                description: 'Lumpy and sausage like'
            },
            {
                value: 'type-3',
                imageSrc: '/stool-type-3.png',
                title: 'Type 3',
                description: 'A sausage shape with cracks in the surface'
            },
            {
                value: 'type-4',
                imageSrc: '/stool-type-4.png',
                title: 'Type 4',
                description: 'Like a smooth, soft sausage or snake'
            },
            {
                value: 'type-5',
                imageSrc: '/stool-type-5.png',
                title: 'Type 5',
                description: 'Soft blobs with clear-cut edges'
            },
            {
                value: 'type-6',
                imageSrc: '/stool-type-6.png',
                title: 'Type 6',
                description: 'Mushy consistency with ragged edges'
            },
            {
                value: 'type-7',
                imageSrc: '/stool-type-7.png',
                title: 'Type 7',
                description: 'Liquid consistency with no solid pieces'
            }
        ]
    },
    {
        id: 'foodRating',
        title: 'Tell me 3 foods from your fridge or pantry I will rate them for gut health.',
        type: 'food-upload',
        required: true,
        placeholder: 'List 3 food from your fridge or pantry...',
        showBubble: true
    }
]

// Default form data
export const DEFAULT_FORM_DATA: OnboardingFormData = {
    age: '',
    gender: '',
    gutConcerns: [],
    bowelFrequency: '',
    energyLevel: 3,
    hydrationHabits: '',
    sleepQuality: null,
    moodTracking: '',
    dietaryPattern: '',
    culturalPreference: '',
    foodSensitivities: [],
    stoolType: '',
    foodRating: {
        mode: 'text',
        textInput: '',
        images: []
    }
} 