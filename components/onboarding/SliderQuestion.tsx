import { FormQuestion } from '@/types/onboarding'
import { useState, useEffect } from 'react'

interface SliderQuestionProps {
  question: FormQuestion
  value: number
  onChange: (value: number) => void
}

export default function SliderQuestion({ question, value, onChange }: SliderQuestionProps) {
  const [isDragging, setIsDragging] = useState(false)
  
  if (!question.sliderConfig) return null
  
  const { min, max, step, labels } = question.sliderConfig
  const currentLabel = labels[value] || ''
  
  // Calculate position percentage for the slider
  const percentage = ((value - min) / (max - min)) * 100
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  return (
    <div className="space-y-8">
      {/* Slider Container */}
      <div className="relative px-4">
        {/* Scale Labels */}
        <div className="flex justify-between mb-4 text-sm text-medium-gray">
          <span>Not<br/>energetic</span>
          <span>Very<br/>energetic</span>
        </div>
        
        {/* Custom Slider Track */}
        <div className="relative h-2 bg-cream-300 rounded-full">
          {/* Progress Track */}
          <div 
            className="absolute h-2 bg-orange-primary rounded-full transition-all duration-200"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Slider Handle */}
          <div 
            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-200"
            style={{ left: `${percentage}%` }}
          >
            <img 
              src="/circle.png" 
              alt="Slider handle" 
              className="w-8 h-8 cursor-pointer"
            />
          </div>
          
          {/* Hidden HTML5 Slider for functionality */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        
        {/* Scale Numbers */}
        <div className="flex justify-between mt-2 text-lg font-semibold text-dark-gray">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((num) => (
            <span key={num} className={value === num ? 'text-orange-primary' : ''}>
              {num}
            </span>
          ))}
        </div>
      </div>
      
      {/* Dynamic Label */}
      <div className="text-center">
        <div className="text-lg font-medium text-dark-gray">
          {value} = {currentLabel}
        </div>
      </div>
    </div>
  )
} 