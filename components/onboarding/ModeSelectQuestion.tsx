import { FormQuestion } from '@/types/onboarding'

interface ModeSelectQuestionProps {
  question: FormQuestion
  value: string
  onChange: (value: string) => void
}

export default function ModeSelectQuestion({ question, value, onChange }: ModeSelectQuestionProps) {
  if (!question.options) return null

  return (
    <div className="space-y-6">
      {/* Mode Selection Buttons */}
      <div className="grid grid-rows-2 gap-4">
        {question.options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`py-4 px-6 w-full md:w-3/4 cursor-pointer bg-orange-pale mx-auto text-xl rounded-full font-semibold transition-all duration-200 text-dark ${
              value === option.value
                ? 'border-orange-primary border-b-6 border-t-2 border-l-2 border-r-2'
                : 'no-border'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}