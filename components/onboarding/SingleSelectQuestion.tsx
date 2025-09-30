import { FormQuestion } from '@/types/onboarding'

interface SingleSelectQuestionProps {
  question: FormQuestion
  value: string | null
  onChange: (value: string) => void
}

export default function SingleSelectQuestion({ question, value, onChange }: SingleSelectQuestionProps) {
  if (!question.options) return null

  return (
    <div className="space-y-4 question-scroll md:flex md:flex-col md:items-center">
      {question.options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`w-full md:w-[80%] py-2 px-6 rounded-full text-md text-nowrap text-dark font-medium transition-all duration-200 text-left`}
          style={{ 
            backgroundColor: '#FAE4B2',
            ...(value === option.value && {
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
          </span>
        </button>
      ))}
    </div>
  )
} 