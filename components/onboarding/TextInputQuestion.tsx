import { FormQuestion } from '@/types/onboarding'

interface TextInputQuestionProps {
  question: FormQuestion
  value: string
  onChange: (value: string) => void
}

export default function TextInputQuestion({ question, value, onChange }: TextInputQuestionProps) {
  const isAgeQuestion = question.title === 'What is your age?'

  // Handle input for age - only allow numeric values
  const handleAgeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    const inputValue = target.value
    
    // Remove any non-numeric characters
    const numericValue = inputValue.replace(/[^0-9]/g, '')
    
    // Limit to reasonable age range (1-120)
    const numValue = parseInt(numericValue)
    if (numericValue === '' || (numValue >= 1 && numValue <= 120)) {
      onChange(numericValue)
    } else if (numValue > 120) {
      onChange('120')
    }
  }

  // Handle regular text input
  const handleTextInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="space-y-6">
      <input
        type={isAgeQuestion ? 'number' : 'text'}
        placeholder={question.placeholder || (isAgeQuestion ? 'Enter your age' : '')}
        className="w-full px-4 py-3 bg-white rounded-lg no-border focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 text-dark"
        value={value}
        onChange={isAgeQuestion ? undefined : handleTextInput}
        onInput={isAgeQuestion ? handleAgeInput : undefined}
        min={isAgeQuestion ? 1 : undefined}
        max={isAgeQuestion ? 120 : undefined}
        inputMode={isAgeQuestion ? 'numeric' : undefined}
        pattern={isAgeQuestion ? '[0-9]*' : undefined}
      />
    </div>
  )
} 