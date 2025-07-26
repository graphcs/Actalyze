import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Register fonts with local file paths
Font.register({
  family: 'Young Serif',
  src: process.cwd() + '/public/fonts/youngserif.regular.ttf',
})

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: process.cwd() + '/public/fonts/Inter-Regular.ttf',
      fontWeight: 'normal',
    },
    {
      src: process.cwd() + '/public/fonts/Inter-Bold.ttf',
      fontWeight: 'bold',
    },
  ],
})

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

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 12,
    lineHeight: 1.6,
    color: '#2B2B2B',
  },
  
  // Header styles
  header: {
    marginBottom: 20,
  },
  brandTitle: {
    fontFamily: 'Young Serif',
    fontSize: 32,
    fontWeight: 'normal',
    color: '#0D4C47',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  reportDate: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#2B2B2B',
  },
  
  // Score section styles
  scoreSection: {
    backgroundColor: '#FFE8C0',
    borderRadius: 16,
    padding: 40,
    textAlign: 'center',
    marginBottom: 5,
    alignItems: 'center',
  },
  scoreTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 20,
  },
  scoreValueContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  scoreValue: {
    fontSize: 100,
    fontWeight: 'bold',
    color: '#F5A623',
    lineHeight: 1,
  },
  scoreTotal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F5A623',
    marginLeft: 8,
  },
  scoreDescription: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#666666',
  },
  
  // Section styles
  section: {
    marginTop: 25,
    marginBottom: 15,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'nowrap', // Prevent title from wrapping away from content
  },
  sectionLine: {
    width: 4,
    height: 24,
    backgroundColor: '#F5A623',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0D4C47',
    fontFamily: 'Inter',
  },
  sectionContent: {
    fontSize: 12,
    color: '#2B2B2B',
    lineHeight: 1.4,
    marginLeft: 4,
  },
  
  // Bullet point styles
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
    flexWrap: 'nowrap', // Keep bullet text together
  },
  bullet: {
    color: '#F5A623',
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 12,
    marginTop: 2,
    minWidth: 20,
  },
  bulletText: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 14,
  },
  
 // Power tip container for stronger grouping
 powerTipContainer: {
  marginTop: 50,
  marginBottom: 40,
},
// Power tip styles
powerTip: {
  backgroundColor: '#FFE8C0',
  borderRadius: 16,
  padding: 24,
},
powerTipTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#2B2B2B',
  marginBottom: 16,
},
  powerTipContent: {
    fontSize: 14,
    color: '#2B2B2B',
    lineHeight: 1.6,
    fontWeight: 'normal',
  },
  
  // Footer styles
  footer: {
    textAlign: 'center',
    marginTop: 40,
    color: '#666666',
    fontSize: 16,
    fontWeight: 'normal',
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
  },
  footerBrand: {
    fontWeight: 'normal',
    color: '#0D4C47',
    fontSize: 16,
    fontFamily: 'Young Serif',
  },
  footerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  footerSubtext: {
    marginTop: 4,
    color: '#666666',
    fontWeight: 'normal',
  },

  // Wrapper to ensure proper spacing from footer
  contentWrapper: {
    paddingBottom: 80, // Space for footer
  },

  // New styles for structured bullet points
  structuredBulletPoint: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
    flexWrap: 'nowrap', // Keep bullet title with description
  },
  structuredContent: {
    flex: 1,
  },
  bulletTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#2B2B2B',
    marginBottom: 4,
  },
  bulletDescription: {
    fontSize: 12,
    color: '#2B2B2B',
    lineHeight: 1.4,
  },

  // New styles for supplement bullet points
  supplementBulletPoint: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
    flexWrap: 'nowrap', // Keep supplement title with all details
  },
  supplementContent: {
    flex: 1,
  },
  supplementTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#2B2B2B',
    marginBottom: 6,
  },
  supplementDose: {
    fontSize: 12,
    color: '#2B2B2B',
    marginTop: 2,
    fontWeight: 'normal',
  },
  supplementWhy: {
    fontSize: 12,
    color: '#2B2B2B',
    marginTop: 2,
  },
  supplementNote: {
    fontSize: 12,
    color: '#2B2B2B',
    marginTop: 2,
    fontWeight: 'normal',
  },
  supplementDescription: {
    fontSize: 12,
    color: '#2B2B2B',
    lineHeight: 1.4,
    marginTop: 2,
  },
})

const formatBulletPoints = (text: string, isSupplementSection: boolean = false): React.ReactNode[] => {
  if (!text) return []

  // Clean the text first
  const cleanedText = cleanAIResponse(text)
  
  // Skip empty or placeholder sections
  if (!cleanedText || cleanedText === '-' || cleanedText.trim() === '') return []

  const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  const bulletPoints: React.ReactNode[] = []
  let currentIndex = 0

  while (currentIndex < lines.length) {
    const titleLine = lines[currentIndex]
    
    // Skip if it's a bullet pattern (old format fallback)
    const bulletPatterns = [/^[-•*]\s*/, /^\d+\.\s*/, /^[a-zA-Z]\.\s*/]
    const isBulletPattern = bulletPatterns.some(pattern => pattern.test(titleLine))
    
    if (isBulletPattern) {
      // Handle old format as fallback
      const cleanLine = titleLine.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').replace(/^[a-zA-Z]\.\s*/, '').trim()
      bulletPoints.push(
        <View key={currentIndex} wrap={false} style={styles.bulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{cleanLine}</Text>
        </View>
      )
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
      bulletPoints.push(
        <View key={currentIndex} wrap={false} style={styles.supplementBulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <View style={styles.supplementContent}>
            <Text style={styles.supplementTitle}>{title}</Text>
            {descriptionLines.map((line, i) => {
              if (line.startsWith('Dose:')) {
                return <Text key={i} style={styles.supplementDose}>{line}</Text>
              } else if (line.startsWith('Why:')) {
                return <Text key={i} style={styles.supplementWhy}>{line}</Text>
              } else if (line.startsWith('Note:')) {
                return <Text key={i} style={styles.supplementNote}>{line}</Text>
              } else {
                return <Text key={i} style={styles.supplementDescription}>{line}</Text>
              }
            })}
          </View>
        </View>
      )
    } else {
      bulletPoints.push(
        <View key={currentIndex} wrap={false} style={styles.structuredBulletPoint}>
          <Text style={styles.bullet}>•</Text>
          <View style={styles.structuredContent}>
            <Text style={styles.bulletTitle}>{title}</Text>
            {descriptionLines.length > 0 && (
              <Text style={styles.bulletDescription}>{descriptionLines.join(' ')}</Text>
            )}
          </View>
        </View>
      )
    }

    currentIndex = nextIndex
  }

  return bulletPoints
}

// Helper function to clean AI response text
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

// Helper function to check if a section should be rendered
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

interface PDFReportProps {
  reportData: ReportData
}

export const PDFReport: React.FC<PDFReportProps> = ({ reportData }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.contentWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.brandTitle}>GutRoot</Text>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Your Personalized Gut Health Report</Text>
              <Text style={styles.reportDate}>{currentDate}</Text>
            </View>
          </View>

          {/* Digestive Score Section */}
          <View style={styles.scoreSection}>
            <Text style={styles.scoreTitle}>Digestive health score</Text>
            <View style={styles.scoreValueContainer}>
              <Text style={styles.scoreValue}>{reportData.digestive_score}</Text>
              <Text style={styles.scoreTotal}>/10</Text>
            </View>
            <Text style={styles.scoreDescription}>
              {getScoreDescription(reportData.digestive_score)}
            </Text>
          </View>

          {/* Diet Recommendations */}
          {shouldRenderSection(reportData.diet_recommendations) && (
            <View style={styles.section}>
              <View wrap={false} style={styles.sectionTitleContainer}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitle}>Diet Recommendations</Text>
              </View>
              <View style={styles.sectionContent}>
                {formatBulletPoints(reportData.diet_recommendations)}
              </View>
            </View>
          )}

          {/* Supplement Suggestions */}
          {shouldRenderSection(reportData.supplement_suggestions) && (
            <View style={styles.section}>
              <View wrap={false} style={styles.sectionTitleContainer}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitle}>Supplement Suggestions</Text>
              </View>
              <View style={styles.sectionContent}>
                {formatBulletPoints(reportData.supplement_suggestions, true)}
              </View>
            </View>
          )}

          {/* Lifestyle Changes */}
          {shouldRenderSection(reportData.lifestyle_changes) && (
            <View style={styles.section}>
              <View wrap={false} style={styles.sectionTitleContainer}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitle}>Lifestyle Changes</Text>
              </View>
              <View style={styles.sectionContent}>
                {formatBulletPoints(reportData.lifestyle_changes)}
              </View>
            </View>
          )}

          {/* Bowel Trends */}
          {shouldRenderSection(reportData.bowel_trends) && (
            <View style={styles.section}>
              <View wrap={false} style={styles.sectionTitleContainer}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitle}>Bowel trends</Text>
              </View>
              <View style={styles.sectionContent}>
                {formatBulletPoints(reportData.bowel_trends)}
              </View>
            </View>
          )}

          {/* Goal Reminders */}
          {shouldRenderSection(reportData.goal_reminders) && (
            <View style={styles.section}>
              <View wrap={false} style={styles.sectionTitleContainer}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitle}>Goal reminder</Text>
              </View>
              <View style={styles.sectionContent}>
                {formatBulletPoints(reportData.goal_reminders)}
              </View>
            </View>
          )}

          {/* Symptom Patterns */}
          {shouldRenderSection(reportData.symptom_patterns_analysis) && (
            <View style={styles.section}>
              <View wrap={false} style={styles.sectionTitleContainer}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionTitle}>Symptom patterns</Text>
              </View>
              <View style={styles.sectionContent}>
                {formatBulletPoints(reportData.symptom_patterns_analysis)}
              </View>
            </View>
          )}

          {/* AI Tip of the Week */}
          {shouldRenderSection(reportData.ai_tip_of_week) && (
            <View wrap={false} style={styles.powerTipContainer}>
            <View style={styles.powerTip}>
              <Text style={styles.powerTipTitle}>AI Tip of the Week</Text>
              <Text style={styles.powerTipContent}>{cleanAIResponse(reportData.ai_tip_of_week)}</Text>
            </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated by <Text style={styles.footerBrand}>GutRoot</Text>
          </Text>
          <Text style={styles.footerSubtext}>
            Your personalized gut health journey starts here!
          </Text>
        </View>
      </Page>
    </Document>
  )
} 