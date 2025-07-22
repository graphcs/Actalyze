import { FormQuestion } from '@/types/onboarding'

interface TextAreaQuestionProps {
  question: FormQuestion
  value: string
  onChange: (value: string) => void
}

export default function TextAreaQuestion({ question, value, onChange }: TextAreaQuestionProps) {
  return (
    <div className="space-y-6">
      <textarea
        placeholder={question.placeholder || ''}
        className="w-full px-4 py-3 bg-white rounded-lg no-border focus:ring-2 focus:ring-orange-primary focus:border-transparent outline-none transition-all duration-200 text-dark min-h-[120px] resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
      />
    </div>
  )
} 