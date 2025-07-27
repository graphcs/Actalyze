import { FormQuestion } from '@/types/onboarding'
import { useState } from 'react'

interface SliderQuestionProps {
  question: FormQuestion
  value: number
  onChange: (value: number) => void
}

export default function SliderQuestion({ question, value, onChange }: SliderQuestionProps) {
  const [, ] = useState(false)
  
  if (!question.sliderConfig) return null
  
  const { min, max, step, labels } = question.sliderConfig
  const currentLabel = labels[value] || ''
  
  // Calculate position percentage for the slider within the shorter bar
  const totalSteps = max - min
  const currentStep = value - min
  const percentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  // Generate step positions for the lines - aligned with shorter bar (90% width, centered)
  const barWidth = 90 // Percentage of container width
  const barOffset = (100 - barWidth) / 2 // Center the bar (5% on each side)
  
  const steps = Array.from({ length: max - min + 1 }, (_, i) => ({
    value: min + i,
    position: barOffset + (totalSteps > 0 ? (i / totalSteps) * barWidth : 0),
    isExtremity: i === 0 || i === totalSteps
  }))

  return (
    <div className="space-y-8">
      {/* Slider Container */}
      <div className="relative px-4">
        {/* Scale Labels */}
        <div className="flex justify-between mb-4 text-sm font-medium text-black px-4">
          <span className="text-start">Not<br/>energetic</span>
          <span className="text-right">Very<br/>energetic</span>
        </div>
        
        {/* Custom Slider Track with Step Lines */}
        <div className="relative h-8 flex items-center">
          {/* Background Horizontal Bar - 90% width, centered */}
          <div 
            className="absolute h-1 bg-orange-light top-1/2 transform -translate-y-1/2 z-0"
            style={{ 
              width: `${barWidth}%`,
              left: `${barOffset}%`
            }}
          />
          
          {/* Step Lines */}
          {steps.map((stepItem, index) => (
            <div
              key={stepItem.value}
              className="absolute flex items-center justify-center z-5"
              style={{ left: `${stepItem.position}%` }}
            >
              {/* Step Line - Always orange-light */}
              <div 
                className={`bg-orange-light transition-all duration-200 rounded-full ${
                  stepItem.isExtremity 
                    ? 'w-1 h-7' // Longer lines for extremities
                    : 'w-1 h-5' // Shorter lines for middle steps
                }`}
              />
            </div>
          ))}
          
          {/* Slider Handle (Circle) - positioned on the shorter bar */}
          <div 
            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-200 z-10"
            style={{ 
              left: `${barOffset + (percentage * barWidth / 100)}%`
            }}
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <img 
                src="/circle.png" 
                alt="Slider handle" 
                className="w-8 h-8 cursor-pointer drop-shadow-sm flex-shrink-0"
              />
            </div>
          </div>
          
          {/* Hidden HTML5 Slider for functionality */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
        </div>
        
        {/* Scale Numbers - positioned to match step lines exactly */}
        <div className="relative mt-4 h-6">
          {steps.map((stepItem) => (
            <div
              key={stepItem.value}
              className="absolute transform -translate-x-1/2"
              style={{ left: `${stepItem.position}%` }}
            >
              <span className={`text-lg font-semibold ${
                value === stepItem.value ? 'text-orange-primary' : 'text-medium-gray'
              }`}>
                {stepItem.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Dynamic Label */}
      <div className="text-start">
        <div className="text-xl font-medium text-black">
          {value} = {currentLabel}
        </div>
      </div>
    </div>
  )
} 