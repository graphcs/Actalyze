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

const formatBulletPoints = (text: string): string => {
  if (!text) return ''

  // Split by lines and process each one
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  return lines.map(line => {
    // Check if line starts with bullet indicators
    const bulletPatterns = [/^[-•*]\s*/, /^\d+\.\s*/, /^[a-zA-Z]\.\s*/]
    const isBullet = bulletPatterns.some(pattern => pattern.test(line))

    if (isBullet) {
      // Clean the line and wrap in bullet styling
      const cleanLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^[a-zA-Z]\.\s*/, '')
      return `<div class="bullet-point">
        <span class="bullet">•</span>
        <span class="bullet-text">${cleanLine}</span>
      </div>`
    } else {
      // Regular paragraph
      return `<div class="bullet-point">
        <span class="bullet">•</span>
        <span class="bullet-text">${line}</span>
      </div>`
    }
  }).join('')
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

    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Diet Recommendations</h3>
      </div>
      <div class="section-content">
        ${formatBulletPoints(reportData.diet_recommendations)}
      </div>
    </div>

    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Supplement Suggestions</h3>
      </div>
      <div class="section-content">
        ${formatBulletPoints(reportData.supplement_suggestions)}
      </div>
    </div>

    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Lifestyle Changes</h3>
      </div>
      <div class="section-content">
        ${formatBulletPoints(reportData.lifestyle_changes)}
      </div>
    </div>

    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Bowel trends</h3>
      </div>
      <div class="section-content">
        ${formatBulletPoints(reportData.bowel_trends)}
      </div>
    </div>

    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Goal reminder</h3>
      </div>
      <div class="section-content">
        ${formatBulletPoints(reportData.goal_reminders)}
      </div>
    </div>

    <div class="section">
      <div class="section-title-container">
        <div class="section-line"></div>
        <h3 class="section-title">Symptom patterns</h3>
      </div>
      <div class="section-content">
        ${formatBulletPoints(reportData.symptom_patterns_analysis)}
      </div>
    </div>

    ${reportData.ai_tip_of_week ? `
    <div class="power-tip">
      <div class="power-tip-title">This week's power tip</div>
      <div class="power-tip-content">${reportData.ai_tip_of_week}</div>
    </div>
    ` : ''}

    <div class="footer">
      <div>Generated by <span class="footer-brand">GutRoot</span></div>
      <div style="margin-top: 4px; color: #666666; font-weight: 400;">Your personalized gut health journey starts here!</div>
    </div>
  </body>
</html>`
} 