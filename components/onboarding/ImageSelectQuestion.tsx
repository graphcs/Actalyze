import { FormQuestion } from '@/types/onboarding'

interface ImageSelectQuestionProps {
  question: FormQuestion
  value: string
  onChange: (value: string) => void
}

export default function ImageSelectQuestion({ question, value, onChange }: ImageSelectQuestionProps) {
  if (!question.imageOptions) return null

  return (
    <div className="space-y-6">
      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 question-scroll">
        {question.imageOptions.map((option) => {
          const isSelected = value === option.value
          
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className="p-4 rounded-2xl transition-all duration-200 bg-[#FAE4B2]"
              style={{
                ...(isSelected && {
                  borderTop: '2px solid #F5A623',
                  borderLeft: '2px solid #F5A623', 
                  borderRight: '2px solid #F5A623',
                  borderBottom: '6px solid #F5A623'
                })
              }}
            >
              <div className="text-left h-full flex flex-col">
                
                {/* Title */}
                <div className="font-semibold text-black text-md">
                  {option.title}
                </div>
                
                {/* Description */}
                <div className="text-sm font-medium text-black leading-tight">
                  {option.description}
                </div>
                {/* Image */}
                <div className="flex justify-center flex-1 items-center">
                  <img 
                    src={option.imageSrc} 
                    alt={option.title}
                    className="w-full h-[80%] object-contain"
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
} 