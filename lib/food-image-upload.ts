import { createClient } from '@supabase/supabase-js'
import { FoodImage } from '@/types/onboarding'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg']
const MAX_DIMENSION = 1024 // Resize images to max 1024px on longest side
const THUMBNAIL_SIZE = 200
const COMPRESSION_QUALITY = 0.8

// Bucket configuration
const FOOD_IMAGES_BUCKET = 'food-images'

/**
 * Validates if the file is a valid image
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            isValid: false,
            error: 'Please upload a JPEG or PNG image'
        }
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            isValid: false,
            error: 'Image size must be less than 10MB'
        }
    }

    return { isValid: true }
}

/**
 * Compresses and resizes an image file
 */
export function compressImage(
    file: File,
    maxDimension: number = MAX_DIMENSION,
    quality: number = COMPRESSION_QUALITY
): Promise<{ compressedFile: File; thumbnail: string }> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img

            if (width > height) {
                if (width > maxDimension) {
                    height = (height * maxDimension) / width
                    width = maxDimension
                }
            } else {
                if (height > maxDimension) {
                    width = (width * maxDimension) / height
                    height = maxDimension
                }
            }

            // Set canvas dimensions
            canvas.width = width
            canvas.height = height

            // Draw and compress
            ctx?.drawImage(img, 0, 0, width, height)

            // Generate thumbnail
            const thumbnailCanvas = document.createElement('canvas')
            const thumbnailCtx = thumbnailCanvas.getContext('2d')
            const thumbnailScale = Math.min(THUMBNAIL_SIZE / width, THUMBNAIL_SIZE / height)

            thumbnailCanvas.width = width * thumbnailScale
            thumbnailCanvas.height = height * thumbnailScale
            thumbnailCtx?.drawImage(img, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height)

            const thumbnail = thumbnailCanvas.toDataURL('image/jpeg', 0.7)

            // Convert main canvas to blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        })
                        resolve({ compressedFile, thumbnail })
                    } else {
                        reject(new Error('Failed to compress image'))
                    }
                },
                file.type,
                quality
            )
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = URL.createObjectURL(file)
    })
}

/**
 * Uploads a food image to Supabase storage with progress tracking
 */
export async function uploadFoodImage(
    file: File,
    userId: string,
    onProgress?: (progress: number) => void
): Promise<{ url: string; error?: string }> {
    try {
        // Generate unique filename
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 15)
        const fileExtension = file.name.split('.').pop()
        const fileName = `${userId}/${timestamp}_${randomId}.${fileExtension}`

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(FOOD_IMAGES_BUCKET)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            console.error('Upload error:', error)
            return { url: '', error: error.message }
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(FOOD_IMAGES_BUCKET)
            .getPublicUrl(fileName)

        if (onProgress) {
            onProgress(100)
        }

        return { url: urlData.publicUrl }

    } catch (error) {
        console.error('Upload error:', error)
        return {
            url: '',
            error: error instanceof Error ? error.message : 'Upload failed'
        }
    }
}

/**
 * Processes multiple food images (validation, compression, upload)
 */
export async function processFoodImages(
    files: FileList,
    userId: string,
    onProgress?: (imageId: string, progress: number) => void,
    onStatusChange?: (imageId: string, status: FoodImage['status'], error?: string) => void
): Promise<FoodImage[]> {
    const maxImages = 3
    const selectedFiles = Array.from(files).slice(0, maxImages)
    const processedImages: FoodImage[] = []

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        const imageId = `food-${Date.now()}-${i}`

        // Create initial image object
        const foodImage: FoodImage = {
            id: imageId,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            uploadProgress: 0
        }

        processedImages.push(foodImage)

        try {
            // Update status to uploading
            foodImage.status = 'uploading'
            onStatusChange?.(imageId, 'uploading')

            // Validate file
            const validation = validateImageFile(file)
            if (!validation.isValid) {
                foodImage.status = 'error'
                foodImage.error = validation.error
                onStatusChange?.(imageId, 'error', validation.error)
                continue
            }

            // Compress image
            const { compressedFile, thumbnail } = await compressImage(file)
            foodImage.thumbnail = thumbnail
            foodImage.file = compressedFile
            foodImage.size = compressedFile.size

            // Upload to Supabase
            const { url, error } = await uploadFoodImage(
                compressedFile,
                userId,
                (progress) => {
                    foodImage.uploadProgress = progress
                    onProgress?.(imageId, progress)
                }
            )

            if (error) {
                foodImage.status = 'error'
                foodImage.error = error
                onStatusChange?.(imageId, 'error', error)
            } else {
                foodImage.status = 'uploaded'
                foodImage.url = url
                foodImage.uploadProgress = 100
                onStatusChange?.(imageId, 'uploaded')
            }

        } catch (error) {
            console.error('Error processing image:', error)
            foodImage.status = 'error'
            foodImage.error = error instanceof Error ? error.message : 'Processing failed'
            onStatusChange?.(imageId, 'error', foodImage.error)
        }
    }

    return processedImages
}

/**
 * Deletes food images from Supabase storage
 */
export async function deleteFoodImages(imageUrls: string[]): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    for (const url of imageUrls) {
        try {
            // Extract file path from URL
            const urlParts = url.split(`${FOOD_IMAGES_BUCKET}/`)
            if (urlParts.length < 2) {
                errors.push(`Invalid URL format: ${url}`)
                continue
            }

            const filePath = urlParts[1]

            const { error } = await supabase.storage
                .from(FOOD_IMAGES_BUCKET)
                .remove([filePath])

            if (error) {
                errors.push(`Failed to delete ${filePath}: ${error.message}`)
            }
        } catch (error) {
            errors.push(`Error deleting ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    return {
        success: errors.length === 0,
        errors
    }
}

/**
 * Creates the food-images bucket and sets up policies (run once during setup)
 */
export async function setupFoodImagesBucket(): Promise<{ success: boolean; error?: string }> {
    try {
        // This function would need to be run with service role key
        // For now, we'll document the manual setup required
        console.log('Food images bucket setup required. Please run the following SQL in Supabase:')

        const setupSQL = `
-- Create food-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for food-images bucket
CREATE POLICY "Users can upload their own food images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'food-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own food images"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'food-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own food images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'food-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Auto-delete policy for food images older than 24 hours
-- This can be set up as a Supabase Edge Function or database trigger
`;

        console.log(setupSQL)

        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Setup failed'
        }
    }
}

/**
 * Utility to generate file names for food images
 */
export function generateFoodImageFileName(userId: string, originalName: string): string {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = originalName.split('.').pop()
    return `${userId}/${timestamp}_${randomId}.${fileExtension}`
}

/**
 * Utility to check if URL is a food image from our bucket
 */
export function isFoodImageUrl(url: string): boolean {
    return url.includes(`${FOOD_IMAGES_BUCKET}/`)
}