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
    marginBottom: 40,
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
    marginTop: 20,
    marginBottom: 20,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  reportDate: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666666',
  },
  
  // Score section styles
  scoreSection: {
    backgroundColor: '#FFE8C0',
    borderRadius: 16,
    padding: 40,
    textAlign: 'center',
    marginBottom: 20,
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
    marginTop: 40,
    marginBottom: 40,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    lineHeight: 1.2,
    marginLeft: 4,
  },
  
  // Bullet point styles
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
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
  
  // Power tip styles
  powerTip: {
    backgroundColor: '#FFE8C0',
    borderRadius: 16,
    padding: 24,
    marginTop: 40,
    marginBottom: 20,
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
    marginTop: 60,
    color: '#666666',
    fontSize: 16,
    fontWeight: 'normal',
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
})

const formatBulletPoints = (text: string): React.ReactNode[] => {
  if (!text) return []

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  return lines.map((line, index) => {
    const bulletPatterns = [/^[-•*]\s*/, /^\d+\.\s*/, /^[a-zA-Z]\.\s*/]
    let cleanLine = line
    
    for (const pattern of bulletPatterns) {
      if (pattern.test(line)) {
        cleanLine = line.replace(pattern, '').trim()
        break
      }
    }
    
    return (
      <View key={index} style={styles.bulletPoint}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.bulletText}>{cleanLine}</Text>
      </View>
    )
  })
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
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>Diet Recommendations</Text>
          </View>
          <View style={styles.sectionContent}>
            {formatBulletPoints(reportData.diet_recommendations)}
          </View>
        </View>

        {/* Supplement Suggestions */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>Supplement Suggestions</Text>
          </View>
          <View style={styles.sectionContent}>
            {formatBulletPoints(reportData.supplement_suggestions)}
          </View>
        </View>

        {/* Lifestyle Changes */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>Lifestyle Changes</Text>
          </View>
          <View style={styles.sectionContent}>
            {formatBulletPoints(reportData.lifestyle_changes)}
          </View>
        </View>

        {/* Bowel Trends */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>Bowel trends</Text>
          </View>
          <View style={styles.sectionContent}>
            {formatBulletPoints(reportData.bowel_trends)}
          </View>
        </View>

        {/* Goal Reminders */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>Goal reminder</Text>
          </View>
          <View style={styles.sectionContent}>
            {formatBulletPoints(reportData.goal_reminders)}
          </View>
        </View>

        {/* Symptom Patterns */}
        <View style={styles.section}>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>Symptom patterns</Text>
          </View>
          <View style={styles.sectionContent}>
            {formatBulletPoints(reportData.symptom_patterns_analysis)}
          </View>
        </View>

        {/* AI Tip of the Week */}
        {reportData.ai_tip_of_week && (
          <View style={styles.powerTip}>
            <Text style={styles.powerTipTitle}>AI Tip of the Week</Text>
            <Text style={styles.powerTipContent}>{reportData.ai_tip_of_week}</Text>
          </View>
        )}

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