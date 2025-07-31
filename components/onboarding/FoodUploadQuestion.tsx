'use client'

import { FormQuestion, FoodUploadData, FoodImage } from '@/types/onboarding'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { processFoodImages, validateImageFile } from '@/lib/food-image-upload'

interface FoodUploadQuestionProps {
  question: FormQuestion
  value: FoodUploadData
  onChange: (value: FoodUploadData) => void
}

export default function FoodUploadQuestion({ question, value, onChange }: FoodUploadQuestionProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState<'selection' | 'input'>('selection')

  // Always start at step 1 (selection) regardless of existing data
  useEffect(() => {
    setCurrentStep('selection')
  }, [])

  // Handle mode selection
  const handleModeChange = useCallback((mode: 'text' | 'upload') => {
    // Clear all data and set new mode
    const newValue: FoodUploadData = {
      mode,
      textInput: mode === 'text' ? '' : undefined,
      images: mode === 'upload' ? [] : undefined
    }
    
    onChange(newValue)
    setCurrentStep('input')
  }, [onChange])

  // Handle back navigation
  const handleBack = useCallback(() => {
    // Clear all data and return to selection step
    const newValue: FoodUploadData = {
      mode: 'text', // Default mode
      textInput: '',
      images: []
    }
    
    onChange(newValue)
    setCurrentStep('selection')
  }, [onChange])

  // Handle text input change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...value,
      textInput: e.target.value
    })
  }, [value, onChange])

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList) => {
    if (!user?.id || files.length === 0) return

    const currentImages = value.images || []
    const availableSlots = 3 - currentImages.length
    
    if (availableSlots <= 0) {
      alert('You can upload a maximum of 3 images')
      return
    }

    setIsUploading(true)

    try {
      const processedImages = await processFoodImages(
        files,
        user.id,
        // Progress callback
        (imageId, progress) => {
          onChange({
            ...value,
            images: (value.images || []).map(img => 
              img.id === imageId 
                ? { ...img, uploadProgress: progress }
                : img
            )
          })
        },
        // Status change callback
        (imageId, status, error) => {
          onChange({
            ...value,
            images: (value.images || []).map(img => 
              img.id === imageId 
                ? { ...img, status, error }
                : img
            )
          })
        }
      )

      onChange({
        ...value,
        images: [...currentImages, ...processedImages].slice(0, 3)
      })

    } catch (error) {
      console.error('Error processing images:', error)
      alert('Failed to process images. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }, [user?.id, value, onChange])

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }, [handleFileSelect])

  // Handle remove image
  const handleRemoveImage = useCallback((imageId: string) => {
    onChange({
      ...value,
      images: (value.images || []).filter(img => img.id !== imageId)
    })
  }, [value, onChange])

  // Trigger file picker
  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const currentImages = value.images || []
  const canAddMore = currentImages.length < 3

  // Step 1: Mode Selection
  if (currentStep === 'selection') {
    return (
      <div className="space-y-6">

        {/* Mode Selection Buttons */}
        <div className="grid grid-rows-2 gap-4">
          <button
            type="button"
            onClick={() => handleModeChange('upload')}
            className="py-4 px-6 w-full md:w-3/4 mx-auto rounded-full font-medium text-base bg-orange-light text-dark-gray cursor-pointer"
          >
            Upload (AI)
          </button>
          
          <button
            type="button"
            onClick={() => handleModeChange('text')}
            className="py-4 px-6 w-full md:w-3/4 mx-auto rounded-full font-medium text-base bg-orange-light text-dark-gray cursor-pointer"
          >
            List (Manual)
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Input Based on Selected Mode
  return (
    <div className="space-y-6">

      {/* Back Button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-dark-gray cursor-pointer"
        >
          <img 
            src="/back-arrow.png" 
            alt="Back" 
            className="w-6 h-6"
          />
          <span className="text-base font-medium">Back to selection</span>
        </button>
      </div>

      {/* Text Input Mode */}
      {value.mode === 'text' && (
        <div className="space-y-4">
          <textarea
            placeholder={question.placeholder}
            value={value.textInput || ''}
            onChange={handleTextChange}
            className="w-full px-4 py-4 bg-white rounded-lg border-2 border-gray-200 focus:border-orange-primary focus:outline-none transition-all duration-200 text-dark resize-none"
            rows={4}
          />
        </div>
      )}

      {/* Image Upload Mode */}
      {value.mode === 'upload' && (
        <div className="space-y-4">
          {/* Image Placeholders/Preview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }, (_, index) => {
              const image = currentImages[index]
              
              return (
                <div
                  key={index}
                  className={`relative aspect-square rounded-lg transition-all duration-200 ${
                    image
                      ? 'bg-white'
                      : 'bg-orange-pale'
                  }`}
                >
                  {image ? (
                    <>
                      {/* Image Preview */}
                      <div className="w-full h-full rounded-lg overflow-hidden">
                        {image.thumbnail ? (
                          <img
                            src={image.thumbnail}
                            alt={image.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-500 text-sm">Loading...</span>
                          </div>
                        )}
                      </div>

                      {/* Image Status Overlay */}
                      {image.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                          <div className="text-white text-center">
                            <div className="mb-2">
                              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                            </div>
                            <div className="text-sm">
                              {image.uploadProgress || 0}%
                            </div>
                          </div>
                        </div>
                      )}

                      {image.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500 bg-opacity-80 rounded-lg flex items-center justify-center">
                          <div className="text-white text-center px-2">
                            <div className="text-xl mb-1">⚠️</div>
                            <div className="text-xs">{image.error}</div>
                          </div>
                        </div>
                      )}

                      {/* Close Button */}
                      {image.status === 'uploaded' && (
                        <div className="absolute -top-3 -right-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(image.id)}
                            className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer"
                            title="Remove"
                          >
                            <img 
                              src="/Close.png" 
                              alt="Close" 
                              className="w-3 h-3"
                            />
                          </button>
                        </div>
                      )}

                      {/* File Name */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 rounded-b-lg truncate">
                        {image.name}
                      </div>
                    </>
                  ) : (
                    /* Empty Placeholder */
                    <div className="w-full h-full rounded-lg"></div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Upload Button */}
          <button
            type="button"
            onClick={triggerFilePicker}
            disabled={!canAddMore || isUploading}
            className={`py-4 px-6 w-full md:w-3/4 mx-auto flex items-center justify-center rounded-full font-medium text-base bg-orange-light text-dark-gray ${
              canAddMore && !isUploading
                ? 'cursor-pointer'
                : 'cursor-not-allowed'
            }`}
          >
            Upload
          </button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      )}
    </div>
  )
}