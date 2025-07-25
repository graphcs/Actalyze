import { FormQuestion } from '@/types/onboarding'

interface MultiSelectQuestionProps {
  question: FormQuestion
  value: string[]
  onChange: (value: string[]) => void
}

export default function MultiSelectQuestion({ question, value, onChange }: MultiSelectQuestionProps) {
  if (!question.options) return null

  const handleToggle = (optionValue: string) => {
    const currentValues = value || []
    const isSelected = currentValues.includes(optionValue)
    
    if (isSelected) {
      // Remove from selection
      onChange(currentValues.filter(v => v !== optionValue))
    } else {
      // Add to selection
      onChange([...currentValues, optionValue])
    }
  }

  return (
    <div className="space-y-4 question-scroll md:flex md:flex-col md:items-center">
      {question.options.map((option) => {
        const isSelected = value?.includes(option.value) || false
        
        return (
          <button
            key={option.value}
            onClick={() => handleToggle(option.value)}
            className={`w-full md:w-[80%] py-4 px-6 rounded-full text-dark font-medium transition-all duration-200 text-left`}
            style={{ 
              backgroundColor: '#FAE4B2',
              ...(isSelected && {
                borderTop: '2px solid #F5A623',
                borderLeft: '2px solid #F5A623', 
                borderRight: '2px solid #F5A623',
                borderBottom: '6px solid #F5A623'
              })
            }}
          >
            <span className="flex items-center">
              {option.emoji && (
                <span className="mr-3 text-xl">{option.emoji}</span>
              )}
              {option.label}
              {isSelected && (
                <span className="ml-auto text-orange-primary font-bold">✓</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
} 