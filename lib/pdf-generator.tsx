import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Register Inter font family using local files
Font.register({
  family: 'Inter',
  fonts: [
    { 
      src: `${process.cwd()}/public/fonts/Inter-Regular.ttf`,
      fontWeight: 'normal'
    },
    { 
      src: `${process.cwd()}/public/fonts/Inter-Bold.ttf`,
      fontWeight: 'bold'
    },
  ]
})

// Define styles matching Figma design
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#F8ECC7',
    padding: 24,
    fontFamily: 'Inter',
  },
  // Header Section - Matches Figma design
  headerSection: {
    marginBottom: 32,
    paddingTop: 16,
    alignItems: 'center',
  },
  digestiveScoreLabel: {
    fontSize: 14,
    color: '#2B2B2B',
    marginBottom: 12,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#F5A623',
    lineHeight: 1,
    fontFamily: 'Inter',
  },
  scoreMax: {
    fontSize: 20,
    color: '#F5A623',
    marginLeft: 2,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  scoreDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  dailyLogButton: {
    backgroundColor: '#F5A623',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  dailyLogText: {
    color: '#2B2B2B',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  dateText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 32,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  // Section styling - with orange line indicators
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionIndicator: {
    width: 3,
    height: 18,
    backgroundColor: '#F5A623',
    marginRight: 12,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0D4C47',
    fontFamily: 'Inter',
    flex: 1,
  },
  sectionContent: {
    fontSize: 11,
    color: '#2B2B2B',
    lineHeight: 1.6,
    marginLeft: 15,
    fontFamily: 'Inter',
  },
  // Power tip box - cream background
  powerTipContainer: {
    marginLeft: 15,
    marginTop: 12,
  },
  powerTipBox: {
    backgroundColor: '#FFC76C',
    borderRadius: 8,
    padding: 14,
  },
  powerTipTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  powerTipContent: {
    fontSize: 11,
    color: '#2B2B2B',
    lineHeight: 1.5,
    fontFamily: 'Inter',
  },
  // Bullet points
  bulletContainer: {
    marginLeft: 15,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 3,
    height: 3,
    backgroundColor: '#F5A623',
    borderRadius: 1.5,
    marginTop: 4,
    marginRight: 8,
  },
  bulletText: {
    fontSize: 11,
    color: '#2B2B2B',
    flex: 1,
    lineHeight: 1.5,
    fontFamily: 'Inter',
  },
  // Brand header for subsequent pages
  brandHeader: {
    marginBottom: 24,
    paddingBottom: 12,
    borderBottom: '1px solid #E5E5E5',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0D4C47',
    fontFamily: 'Inter',
  },
  pageTitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
    fontFamily: 'Inter',
  },
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
  assessmentData?: {
    age?: string
    gender?: string
    initialReason?: string
  }
}

const formatBulletPoints = (text: string) => {
  // Split text into bullet points based on common patterns
  const lines = text.split(/[\n•\-\*]/).filter(line => line.trim().length > 0)
  
  return (
    <View style={styles.bulletContainer}>
      {lines.map((line, index) => (
        <View key={index} style={styles.bulletPoint}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{line.trim()}</Text>
        </View>
      ))}
    </View>
  )
}

export const GutHealthReportPDF: React.FC<{ data: ReportData }> = ({ data }) => {
  // Console log the AI response data
  console.log('AI Report Data:', data)
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long',
    day: 'numeric'
  })

  const getScoreDescription = (score: number) => {
    if (score >= 8) return 'Overall excellent digestion'
    if (score >= 6) return 'Overall good digestion'
    if (score >= 4) return 'Overall moderate digestion'
    return 'Overall poor digestion'
  }

  return (
    <Document>
      {/* Main Report Page - Matching Figma Design */}
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          {/* Digestive Score */}
          <Text style={styles.digestiveScoreLabel}>Digestive score</Text>
          
          <View style={styles.scoreDisplay}>
            <Text style={styles.scoreNumber}>{data.digestive_score}</Text>
            <Text style={styles.scoreMax}>/10</Text>
          </View>
          
          <Text style={styles.scoreDescription}>
            {getScoreDescription(data.digestive_score)}
          </Text>
          
          <Text style={styles.dateText}>Week of {currentDate}</Text>
        </View>

        {/* Bowel Trends Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionTitle}>Bowel trends</Text>
          </View>
          <Text style={styles.sectionContent}>{data.bowel_trends}</Text>
        </View>

        {/* Goal Reminder Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionTitle}>Goal reminder</Text>
          </View>
          <Text style={styles.sectionContent}>{data.goal_reminders}</Text>
          
          {/* Power Tip Box */}
          <View style={styles.powerTipContainer}>
            <View style={styles.powerTipBox}>
              <Text style={styles.powerTipTitle}>This week's power tip</Text>
              <Text style={styles.powerTipContent}>{data.ai_tip_of_week}</Text>
            </View>
          </View>
        </View>

        {/* Diet Recommendations Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionTitle}>Diet recommendations</Text>
          </View>
          {formatBulletPoints(data.diet_recommendations)}
        </View>

        {/* Supplement Suggestions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionTitle}>Supplement suggestions</Text>
          </View>
          {formatBulletPoints(data.supplement_suggestions)}
        </View>

        {/* Lifestyle Changes Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionTitle}>Lifestyle changes</Text>
          </View>
          {formatBulletPoints(data.lifestyle_changes)}
        </View>

        {/* Symptom Patterns Analysis Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionTitle}>Symptom patterns analysis</Text>
          </View>
          <Text style={styles.sectionContent}>{data.symptom_patterns_analysis}</Text>
        </View>
      </Page>
    </Document>
  )
} 