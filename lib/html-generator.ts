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

const formatBulletPoints = (text: string, isSupplementSection: boolean = false): string => {
  if (!text) return ''

  // Clean the text first
  const cleanedText = cleanAIResponse(text)

  // Skip empty or placeholder sections
  if (!cleanedText || cleanedText === '-' || cleanedText.trim() === '') return ''

  const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  const bulletPoints: string[] = []
  let currentIndex = 0

  while (currentIndex < lines.length) {
    const titleLine = lines[currentIndex]

    // Skip if it's a bullet pattern (old format fallback)
    const bulletPatterns = [/^[-•*]\s*/, /^\d+\.\s*/, /^[a-zA-Z]\.\s*/]
    const isBulletPattern = bulletPatterns.some(pattern => pattern.test(titleLine))

    if (isBulletPattern) {
      // Handle old format as fallback
      const cleanLine = titleLine.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^[a-zA-Z]\.\s*/, '').trim()
      bulletPoints.push(`
        <tr>
          <td style="vertical-align: top; padding: 4px 0; color: #F5A623; font-weight: bold; font-size: 18px; line-height: 1.4;">•</td>
          <td style="padding: 4px 0 4px 12px; color: #2B2B2B; font-size: 18px; line-height: 1.4; font-weight: 500;">${cleanLine}</td>
        </tr>
      `)
      currentIndex++
      continue
    }

    // New structured format
    const title = titleLine
    const descriptionLines: string[] = []

    // Collect description lines until next title or end
    let nextIndex = currentIndex + 1
    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex]

      // Check if this looks like a new title (not starting with Dose:, Why:, Note:)
      const isSpecialLine = nextLine.startsWith('Dose:') || nextLine.startsWith('Why:') || nextLine.startsWith('Note:')
      const isNewTitle = !isSpecialLine && nextLine.length > 0 && !nextLine.startsWith(' ') &&
        !bulletPatterns.some(pattern => pattern.test(nextLine))

      // For non-supplement sections, any non-indented line is a new title
      // For supplement sections, only lines that don't start with Dose/Why/Note are new titles
      if (!isSupplementSection && isNewTitle && descriptionLines.length > 0) {
        break
      } else if (isSupplementSection && isNewTitle && !isSpecialLine && descriptionLines.length > 0) {
        break
      }

      descriptionLines.push(nextLine)
      nextIndex++
    }

    // Render the bullet point with title and description
    if (isSupplementSection) {
      let supplementContent = `<div style="font-weight: bold; color: #2B2B2B; font-size: 16px; margin-bottom: 6px;">${title}</div>`

      descriptionLines.forEach(line => {
        if (line.startsWith('Dose:')) {
          supplementContent += `<div style="color: #0D4C47; font-size: 14px; font-weight: bold; margin-top: 2px;">${line}</div>`
        } else if (line.startsWith('Why:')) {
          supplementContent += `<div style="color: #666666; font-size: 14px; margin-top: 2px;">${line}</div>`
        } else if (line.startsWith('Note:')) {
          supplementContent += `<div style="color: #F5A623; font-size: 14px; font-weight: normal; margin-top: 2px;">${line}</div>`
        } else {
          supplementContent += `<div style="color: #2B2B2B; font-size: 14px; line-height: 1.4; margin-top: 2px;">${line}</div>`
        }
      })

      bulletPoints.push(`
        <tr>
          <td style="vertical-align: top; padding: 4px 0; color: #F5A623; font-weight: bold; font-size: 18px; line-height: 1.4;">•</td>
          <td style="padding: 4px 0 4px 12px;">
            ${supplementContent}
          </td>
        </tr>
      `)
    } else {
      const description = descriptionLines.length > 0 ? descriptionLines.join(' ') : ''
      bulletPoints.push(`
        <tr>
          <td style="vertical-align: top; padding: 4px 0; color: #F5A623; font-weight: bold; font-size: 18px; line-height: 1.4;">•</td>
          <td style="padding: 4px 0 4px 12px;">
            <div style="font-weight: bold; color: #2B2B2B; font-size: 16px; margin-bottom: 4px;">${title}</div>
            ${description ? `<div style="color: #666666; font-size: 14px; line-height: 1.4;">${description}</div>` : ''}
          </td>
        </tr>
      `)
    }

    currentIndex = nextIndex
  }

  return bulletPoints.join('')
}

// Helper function to clean AI response text (same as PDF generator)
const cleanAIResponse = (text: string): string => {
  if (!text) return ''

  let cleaned = text

  // Remove ** wrappers from anywhere in the text
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1')

  // Remove section endings like '--' at the end
  cleaned = cleaned.replace(/--+\s*$/gm, '')

  // Remove section title patterns like "**SECTION_NAME:**"
  cleaned = cleaned.replace(/\*\*[A-Z_]+:\*\*/g, '')

  // Remove standalone dashes that indicate empty sections
  cleaned = cleaned.replace(/^-+$/gm, '')

  // Clean up multiple newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

  // Trim whitespace
  cleaned = cleaned.trim()

  return cleaned
}

// Helper function to check if a section should be rendered (same as PDF generator)
const shouldRenderSection = (content: string): boolean => {
  if (!content) return false

  const cleaned = cleanAIResponse(content)

  // Don't render if empty, just dashes, or placeholder text
  if (!cleaned ||
    cleaned === '-' ||
    cleaned === '--' ||
    cleaned.trim() === '' ||
    cleaned.toLowerCase().includes('not applicable') ||
    cleaned.toLowerCase().includes('n/a')) {
    return false
  }

  return true
}

const getScoreDescription = (score: number): string => {
  if (score >= 8) return 'Excellent digestive health!'
  if (score >= 6) return 'Good digestive health with room for improvement'
  if (score >= 4) return 'Moderate digestive health - focus areas identified'
  if (score >= 2) return 'Poor digestive health - significant improvements needed'
  return 'Critical digestive health - immediate attention required'
}

export function generateReportHTML(reportData: ReportData): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const _userName = reportData.userProfile?.firstName || 'there'

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your Gut Health Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Young+Serif&display=swap" rel="stylesheet">
    <style>
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        line-height: 1.6;
        color: #2B2B2B;
        background-color: #ffffff;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
      }
      
      .header {
        margin-bottom: 40px;
      }
      
      .brand-title {
        font-family: 'Young Serif', serif;
        font-size: 48px;
        font-weight: normal;
        color: #0D4C47;
        margin-bottom: 20px;
        letter-spacing: -0.02em;
      }
      
      .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 40px;
      }
      
      .report-title {
        font-size: 32px;
        font-weight: 600;
        color: #2B2B2B;
      }
      
      .report-date {
        font-size: 24px;
        font-weight: 500;
        color: #666666;
      }
      
      .score-section {
        background-color: #FFE8C0;
        border-radius: 16px;
        padding: 40px 30px;
        text-align: center;
        margin-bottom: 40px;
      }
      
      .score-title {
        font-size: 32px;
        font-weight: 600;
        color: #2B2B2B;
        margin-bottom: 20px;
      }
      
      .score-value-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 15px;
      }
      
      .score-value {
        font-size: 112px;
        font-weight: 700;
        color: #F5A623;
        line-height: 1;
      }
      
      .score-total {
        font-size: 32px;
        font-weight: 600;
        color: #F5A623;
        margin-left: 8px;
      }
      
      .score-description {
        font-size: 20px;
        font-weight: 500;
        color: #666666;
      }
      
      .section {
        margin: 40px 0;
      }
      
      .section-title-container {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
      }
      
      .section-line {
        width: 4px;
        height: 24px;
        background-color: #F5A623;
        margin-right: 12px;
      }
      
      .section-title {
        font-size: 30px;
        font-weight: 700;
        color: #0D4C47;
        font-family: 'Inter', serif;
        margin: 0;
      }
      
      .section-content {
        font-size: 20px;
        color: #2B2B2B;
        line-height: 1.6;
        margin-left: 16px;
      }
      
      .bullet-point {
        display: flex;
        margin-bottom: 12px;
        align-items: flex-start;
      }
      
      .bullet {
        color: #F5A623;
        font-weight: bold;
        font-size: 20px;
        margin-right: 12px;
        margin-top: 2px;
        min-width: 20px;
      }
      
      .bullet-text {
        flex: 1;
        font-weight: 500;
      }
      
      .power-tip {
        background-color: #FFE8C0;
        border-radius: 16px;
        padding: 24px;
        margin: 40px 0;
      }
      
      .power-tip-title {
        font-size: 20px;
        font-weight: 700;
        color: #2B2B2B;
        margin-bottom: 16px;
      }
      
      .power-tip-content {
        font-size: 20px;
        color: #2B2B2B;
        line-height: 1.6;
        font-weight: 500;
      }
      
      .footer {
        margin-top: 60px;
        text-align: center;
        color: #666666;
        font-size: 16px;
        font-weight: 500;
      }
      
      .footer-brand {
        font-weight: 500;
        color: #0D4C47;
        font-size: 24px;
        font-family: 'Young Serif', serif;
      }
        
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand-title">GutRoot</div>
      <div class="report-header">
        <div class="report-title">Your Personalized Gut Health Report</div>
        <div class="report-date">${currentDate}</div>
      </div>
    </div>

    <div class="score-section">
      <div class="score-title">Digestive health score</div>
      <div class="score-value-container">
        <span class="score-value">${reportData.digestive_score}</span>
        <span class="score-total">/10</span>
      </div>
      <div class="score-description">${getScoreDescription(reportData.digestive_score)}</div>
    </div>

    ${shouldRenderSection(reportData.diet_recommendations) ? `
    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Diet Recommendations</h3>
      </div>
      <div class="section-content">
        <table style="width: 100%; border-collapse: collapse;">
          ${formatBulletPoints(reportData.diet_recommendations)}
        </table>
      </div>
    </div>
    ` : ''}

    ${shouldRenderSection(reportData.supplement_suggestions) ? `
    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Supplement Suggestions</h3>
      </div>
      <div class="section-content">
        <table style="width: 100%; border-collapse: collapse;">
          ${formatBulletPoints(reportData.supplement_suggestions, true)}
        </table>
      </div>
    </div>
    ` : ''}

    ${shouldRenderSection(reportData.lifestyle_changes) ? `
    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Lifestyle Changes</h3>
      </div>
      <div class="section-content">
        <table style="width: 100%; border-collapse: collapse;">
          ${formatBulletPoints(reportData.lifestyle_changes)}
        </table>
      </div>
    </div>
    ` : ''}

    ${shouldRenderSection(reportData.bowel_trends) ? `
    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Bowel trends</h3>
      </div>
      <div class="section-content">
        <table style="width: 100%; border-collapse: collapse;">
          ${formatBulletPoints(reportData.bowel_trends)}
        </table>
      </div>
    </div>
    ` : ''}

    ${shouldRenderSection(reportData.goal_reminders) ? `
    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Goal reminder</h3>
      </div>
      <div class="section-content">
        <table style="width: 100%; border-collapse: collapse;">
          ${formatBulletPoints(reportData.goal_reminders)}
        </table>
      </div>
    </div>
    ` : ''}

    ${shouldRenderSection(reportData.symptom_patterns_analysis) ? `
    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Symptom patterns</h3>
      </div>
      <div class="section-content">
        <table style="width: 100%; border-collapse: collapse;">
          ${formatBulletPoints(reportData.symptom_patterns_analysis)}
        </table>
      </div>
    </div>
    ` : ''}

    ${shouldRenderSection(reportData.ai_tip_of_week) ? `
    <div class="power-tip">
      <div class="power-tip-title">This week's power tip</div>
      <div class="power-tip-content">${cleanAIResponse(reportData.ai_tip_of_week)}</div>
    </div>
    ` : ''}

    <div class="footer">
      <div>Generated by <span class="footer-brand">GutRoot</span></div>
      <div style="margin-top: 4px; color: #666666; font-weight: 400;">Your personalized gut health journey starts here!</div>
    </div>
  </body>
</html>`
} 