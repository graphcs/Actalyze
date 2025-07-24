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
            return `<div style="display: flex; margin-bottom: 8px;">
        <span style="color: #F5A623; margin-right: 8px; font-weight: bold;">•</span>
        <span style="flex: 1;">${cleanLine}</span>
      </div>`
        } else {
            // Regular paragraph
            return `<p style="margin-bottom: 12px; line-height: 1.6;">${line}</p>`
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
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
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
        text-align: center;
        margin-bottom: 40px;
        padding-bottom: 30px;
        border-bottom: 3px solid #0D4C47;
      }
      
      .brand-title {
        font-size: 36px;
        font-weight: 900;
        color: #0D4C47;
        margin-bottom: 10px;
        letter-spacing: -0.02em;
      }
      
      .report-title {
        font-size: 24px;
        font-weight: 600;
        color: #2B2B2B;
        margin-bottom: 8px;
      }
      
      .report-date {
        font-size: 14px;
        color: #666666;
      }
      
      .score-section {
        text-align: center;
        margin: 40px 0;
        padding: 30px;
        background: linear-gradient(135deg, #A8CBA1 0%, #0D4C47 100%);
        border-radius: 16px;
        color: white;
      }
      
      .score-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 15px;
      }
      
      .score-value {
        font-size: 72px;
        font-weight: 700;
        margin-bottom: 10px;
      }
      
      .score-description {
        font-size: 16px;
        font-weight: 500;
        opacity: 0.9;
      }
      
      .section {
        margin: 35px 0;
      }
      
      .section-title {
        font-size: 20px;
        font-weight: 600;
        color: #0D4C47;
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 2px solid #A8CBA1;
      }
      
      .section-content {
        font-size: 15px;
        color: #2B2B2B;
        line-height: 1.6;
        margin-left: 0;
      }
      
      .power-tip {
        margin: 20px 0;
        background-color: #FFC76C;
        border-radius: 12px;
        padding: 20px;
      }
      
      .power-tip-title {
        font-size: 16px;
        font-weight: 700;
        color: #2B2B2B;
        margin-bottom: 12px;
      }
      
      .power-tip-content {
        font-size: 15px;
        color: #2B2B2B;
        line-height: 1.5;
      }
      
      .footer {
        margin-top: 50px;
        padding-top: 30px;
        border-top: 2px solid #A8CBA1;
        text-align: center;
        color: #666666;
        font-size: 14px;
      }
      
      .footer-brand {
        font-weight: 600;
        color: #0D4C47;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand-title">GutRoot</div>
      <div class="report-title">Your Personalized Gut Health Report</div>
      <div class="report-date">${currentDate}</div>
    </div>

    <div class="score-section">
      <div class="score-title">Your Overall Digestive Health Score</div>
      <div class="score-value">${reportData.digestive_score}/10</div>
      <div class="score-description">${getScoreDescription(reportData.digestive_score)}</div>
    </div>

    <div class="section">
      <div class="section-title">🥗 Personalized Diet Recommendations</div>
      <div class="section-content">
        ${formatBulletPoints(reportData.diet_recommendations)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">💊 Supplement Suggestions</div>
      <div class="section-content">
        ${formatBulletPoints(reportData.supplement_suggestions)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">🏃‍♀️ Lifestyle Changes</div>
      <div class="section-content">
        ${formatBulletPoints(reportData.lifestyle_changes)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">📊 Bowel Health Analysis</div>
      <div class="section-content">
        ${formatBulletPoints(reportData.bowel_trends)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">🎯 Weekly Goals</div>
      <div class="section-content">
        ${formatBulletPoints(reportData.goal_reminders)}
      </div>
    </div>

    <div class="section">
      <div class="section-title">🔍 Symptom Pattern Analysis</div>
      <div class="section-content">
        ${formatBulletPoints(reportData.symptom_patterns_analysis)}
      </div>
    </div>

    ${reportData.ai_tip_of_week ? `
    <div class="power-tip">
      <div class="power-tip-title">💡 AI Tip of the Week</div>
      <div class="power-tip-content">${reportData.ai_tip_of_week}</div>
    </div>
    ` : ''}

    <div class="footer">
      <div>Generated by <span class="footer-brand">GutRoot</span></div>
      <div style="margin-top: 8px;">Your personalized gut health journey starts here!</div>
    </div>
  </body>
</html>`
} 