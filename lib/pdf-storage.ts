import React from 'react'
import { pdf, Document } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { GutHealthReportPDF } from './pdf-generator'

interface ReportData {
    digestive_score: number
    diet_recommendations: string
    supplement_suggestions: string
    lifestyle_changes: string
    bowel_trends: string
    goal_reminders: string
    symptom_patterns_analysis: string
    ai_tip_of_week: string
    userProfile?: {
        firstName?: string
        lastName?: string
    }
    assessmentData?: {
        age?: string
        gender?: string
        initialReason?: string
    }
}

export async function generatePDFBuffer(reportData: ReportData): Promise<{ buffer: Buffer | null; error: string | null }> {
    try {
        console.log('Starting PDF generation with data:', {
            score: reportData.digestive_score,
            userProfile: reportData.userProfile,
            hasRecommendations: !!reportData.diet_recommendations
        })

        // Use React.createElement instead of JSX syntax for server-side compatibility
        const pdfDoc = pdf(React.createElement(GutHealthReportPDF, { data: reportData }) as any)
        console.log('PDF document created successfully')

        const pdfStream = await pdfDoc.toBlob()
        console.log('PDF blob generated successfully')

        // Convert Blob to Buffer
        const arrayBuffer = await pdfStream.arrayBuffer()
        const pdfBuffer = Buffer.from(arrayBuffer)
        console.log('PDF buffer created, size:', pdfBuffer.length, 'bytes')

        return { buffer: pdfBuffer, error: null }
    } catch (error) {
        console.error('Error generating PDF:', error)
        console.error('Error stack:', (error as Error).stack)
        return { buffer: null, error: (error as Error).message }
    }
}

export async function uploadPDFToSupabase(
    pdfBuffer: Buffer,
    fileName: string
): Promise<{ url: string | null; error: string | null }> {
    try {
        console.log('Starting PDF upload to Supabase:', {
            fileName,
            bufferSize: pdfBuffer.length,
            bucketName: 'reports'
        })

        const { data, error } = await supabase.storage
            .from('reports')
            .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            console.error('Supabase storage upload error:', error)
            return { url: null, error: error.message }
        }

        console.log('PDF uploaded successfully:', data.path)

        // Get the public URL
        const { data: urlData } = supabase.storage
            .from('reports')
            .getPublicUrl(data.path)

        console.log('Generated public URL:', urlData.publicUrl)

        return { url: urlData.publicUrl, error: null }
    } catch (error) {
        console.error('Error uploading PDF to Supabase:', error)
        console.error('Upload error stack:', (error as Error).stack)
        return { url: null, error: (error as Error).message }
    }
}

export async function generateReportFileName(userId: string, assessmentId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `gut-health-report_${userId}_${assessmentId}_${timestamp}.pdf`
}

export async function generateAndUploadPDF(
    reportData: ReportData,
    userId: string,
    assessmentId: string
): Promise<{ pdfUrl: string | null; fileName: string | null; error: string | null }> {
    try {
        // Generate PDF buffer
        const { buffer, error: pdfError } = await generatePDFBuffer(reportData)

        console.log('PDF Buffer generated:', !!buffer)
        console.log('PDF Generation Error:', pdfError)

        if (pdfError || !buffer) {
            return { pdfUrl: null, fileName: null, error: pdfError || 'Failed to generate PDF' }
        }

        // Generate filename
        const fileName = await generateReportFileName(userId, assessmentId)

        // Upload to Supabase
        const { url, error: uploadError } = await uploadPDFToSupabase(buffer, fileName)

        console.log('Upload Error:', uploadError)
        console.log('PDF URL:', url)

        if (uploadError || !url) {
            return { pdfUrl: null, fileName: null, error: uploadError || 'Failed to upload PDF' }
        }

        return { pdfUrl: url, fileName, error: null }
    } catch (error) {
        console.error('Error in generateAndUploadPDF:', error)
        return { pdfUrl: null, fileName: null, error: (error as Error).message }
    }
}

// Function to update report record with PDF URL
export async function updateReportWithPDF(
    reportId: string,
    pdfUrl: string
): Promise<{ success: boolean; error: string | null }> {
    try {
        const { error } = await supabase
            .from('reports')
            .update({ pdf_url: pdfUrl })
            .eq('id', reportId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, error: null }
    } catch (error) {
        return { success: false, error: (error as Error).message }
    }
} 