'use client'

import { FormQuestion, FoodUploadData } from '@/types/onboarding'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { processFoodImages, deleteFoodImages } from '@/lib/food-image-upload'

interface FoodUploadQuestionProps {
  question: FormQuestion
  value: FoodUploadData
  onChange: (value: FoodUploadData) => void
  mode: 'text' | 'upload'
  onSubmit?: () => void
}

export default function FoodUploadQuestion({ question, value, onChange, mode, onSubmit }: FoodUploadQuestionProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)

  // Set mode when component mounts or mode changes
  useEffect(() => {
    if (value.mode !== mode) {
      onChange({
        mode,
        textInput: mode === 'text' ? value.textInput || '' : '',
        images: mode === 'upload' ? value.images || [] : []
      })
    }
  }, [mode, value.mode, onChange, value.textInput, value.images])



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
  const handleRemoveImage = useCallback(async (imageId: string) => {
    const imageToRemove = (value.images || []).find(img => img.id === imageId)
    
    // Delete from Supabase if image was successfully uploaded
    if (imageToRemove && imageToRemove.status === 'uploaded' && imageToRemove.url) {
      try {
        await deleteFoodImages([imageToRemove.url])
        console.log('Successfully deleted image from storage:', imageToRemove.name)
      } catch (error) {
        console.error('Failed to delete image from storage:', error)
        // Continue with UI removal even if storage deletion fails
      }
    }
    
    // Remove from UI
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

  // Always render input form based on the mode prop
  return (
    <div className="space-y-6">

      {/* Text Input Mode */}
      {mode === 'text' && (
        <div className="space-y-4">
          <textarea
            placeholder={question.placeholder}
            value={value.textInput || ''}
            onChange={handleTextChange}
            className="w-full px-4 py-4 bg-white rounded-lg border-2 border-white focus:border-orange-primary focus:outline-none transition-all duration-200 text-dark resize-none text-xl"
            rows={4}
          />
        </div>
      )}

      {/* Image Upload Mode */}
      {mode === 'upload' && (
        <div className="food-scroll pr-4 pt-3">
        <div className="space-y-4">
          {/* Dynamic Image Gallery */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {/* Uploaded Images */}
            {currentImages.map((image) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg bg-white"
              >
                {/* Image Preview */}
                <div className="w-full h-full rounded-lg overflow-hidden">
                  {image.thumbnail && (
                    <img
                      src={image.thumbnail}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {image.status === 'error' && (
                  <div className="absolute inset-0 bg-orange-pale bg-opacity-80 rounded-lg flex items-center justify-center">
                    <div className="text-dark-gray text-center px-2">
                      <div className="text-xl mb-1">⚠️</div>
                      <div className="text-sm">{image.error}</div>
                    </div>
                  </div>
                )}

                {/* Close Button */}
                {(image.status === 'uploaded' || image.status === 'error') && (
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
                <div className="absolute bottom-0 left-0 right-0 bg-orange-pale bg-opacity-70 text-dark-gray text-xs p-1 rounded-b-lg truncate">
                  {image.name}
                </div>
              </div>
            ))}

            {/* Dynamic Placeholder - only show if less than 3 images */}
            {currentImages.length < 3 && (
              <div
                onClick={triggerFilePicker}
                className="relative aspect-square rounded-lg bg-transparent cursor-pointer border-2 border-gray-400 flex items-center justify-center"
              >
                <div className="text-dark-gray text-center">
                  <img 
                    src="/Plus.png" 
                    alt="Plus" 
                    className="w-8 h-8"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Upload/Submit Button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={currentImages.length === 0 || isUploading}
            className={`py-4 px-6 w-full md:w-3/4 mx-auto text-xl flex items-center justify-center rounded-full font-semibold bg-orange-light text-dark-gray ${
              currentImages.length > 0 && !isUploading
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
        </div>
      )}
    </div>
  )
}