import { FormQuestion } from '@/types/onboarding'

interface TextInputQuestionProps {
  question: FormQuestion
  value: string
  onChange: (value: string) => void
}

export default function TextInputQuestion({ question, value, onChange }: TextInputQuestionProps) {
  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder={question.placeholder || ''}
        className="w-full px-4 py-3 bg-white rounded-lg no-border focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 text-dark"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
} 