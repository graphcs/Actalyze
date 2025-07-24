import nodemailer from 'nodemailer'

interface EmailData {
    to: string
    subject: string
    html: string
    from?: string
}

// Create reusable transporter object using environment variables
const createTransporter = () => {
    // Support for Gmail and other SMTP providers
    if (process.env.EMAIL_PROVIDER === 'gmail') {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
            },
        })
    }

    throw new Error('Email configuration not found. Please set EMAIL_PROVIDER=gmail or SMTP settings.')
}

export async function sendEmail({
    to,
    subject,
    html,
    from = process.env.EMAIL_FROM || 'GutRoot <noreply@gutroot.com>'
}: EmailData): Promise<{ success: boolean; error: string | null; messageId?: string }> {
    try {
        const transporter = createTransporter()

        const mailOptions = {
            from,
            to,
            subject,
            html,
        }

        const info = await transporter.sendMail(mailOptions)
        console.log('Email sent successfully:', info.messageId)

        return {
            success: true,
            error: null,
            messageId: info.messageId
        }

    } catch (error) {
        console.error('Email service error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown email error'
        }
    }
}

export async function sendGutHealthReport(
    email: string,
    htmlContent: string,
    _userName: string = 'there'
): Promise<{ success: boolean; error: string | null; messageId?: string }> {
    const subject = `Your Personalized Gut Health Report - GutRoot`

    return sendEmail({
        to: email,
        subject,
        html: htmlContent,
    })
} 