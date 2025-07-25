import { pdf } from '@react-pdf/renderer'
import { supabase } from './supabase'
import { PDFReport } from './pdf-generator'
import React from 'react'

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
}

export async function generatePDFBuffer(reportData: ReportData): Promise<{ buffer: Buffer | null; error: string | null }> {
    try {
        // Create PDF document using React.createElement
        // Using unknown type assertion for @react-pdf/renderer compatibility
        const pdfDocument = React.createElement(PDFReport, { reportData }) as unknown as React.ReactElement

        // Generate PDF as stream
        const pdfStream = await pdf(pdfDocument).toBlob()

        // Convert blob to buffer for Node.js
        const arrayBuffer = await pdfStream.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        return { buffer, error: null }
    } catch (error) {
        console.error('PDF generation error:', error)
        return {
            buffer: null,
            error: error instanceof Error ? error.message : 'Unknown PDF generation error'
        }
    }
}

export async function uploadPDFToSupabase(
    pdfBuffer: Buffer,
    userId: string,
    reportId: string
): Promise<{ url: string | null; error: string | null }> {
    try {
        const fileName = `reports/${userId}/${reportId}.pdf`

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('reports')
            .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true // Replace if exists
            })

        if (error) {
            return { url: null, error: error.message }
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('reports')
            .getPublicUrl(fileName)

        return { url: publicUrl, error: null }
    } catch (error) {
        console.error('PDF upload error:', error)
        return {
            url: null,
            error: error instanceof Error ? error.message : 'Unknown upload error'
        }
    }
}

export async function generateAndUploadPDF(
    reportData: ReportData,
    userId: string,
    reportId: string
): Promise<{ url: string | null; error: string | null }> {
    try {
        // Generate PDF buffer
        const { buffer, error: generateError } = await generatePDFBuffer(reportData)

        if (generateError || !buffer) {
            return { url: null, error: generateError || 'Failed to generate PDF' }
        }

        // Upload to Supabase
        const { url, error: uploadError } = await uploadPDFToSupabase(buffer, userId, reportId)

        if (uploadError) {
            return { url: null, error: uploadError }
        }

        return { url, error: null }
    } catch (error) {
        console.error('Generate and upload PDF error:', error)
        return {
            url: null,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
} 