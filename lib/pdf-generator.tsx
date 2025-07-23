import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Register fonts (you can add custom fonts later)
// Font.register({
//   family: 'Inter',
//   src: 'path/to/Inter-Regular.ttf'
// })

// Define styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #0D4C47',
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0D4C47',
    marginBottom: 8,
    fontFamily: 'Helvetica-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#A1A1A1',
  },
  scoreSection: {
    backgroundColor: '#F9F4EF',
    padding: 20,
    borderRadius: 8,
    marginBottom: 25,
    alignItems: 'center',
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0D4C47',
    marginBottom: 10,
    fontFamily: 'Helvetica-Bold',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#F5A623',
    marginBottom: 5,
    fontFamily: 'Helvetica-Bold',
  },
  scoreDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0D4C47',
    marginBottom: 12,
    borderLeft: '4px solid #F5A623',
    paddingLeft: 12,
    fontFamily: 'Helvetica-Bold',
  },
  sectionContent: {
    fontSize: 12,
    lineHeight: 1.6,
    color: '#2B2B2B',
    marginLeft: 16,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 8,
    marginLeft: 16,
  },
  bullet: {
    fontSize: 12,
    color: '#F5A623',
    width: 15,
    fontWeight: 'bold',
  },
  bulletText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#2B2B2B',
    flex: 1,
  },
  tipBox: {
    backgroundColor: '#A8CBA1',
    padding: 15,
    borderRadius: 8,
    marginTop: 25,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0D4C47',
    marginBottom: 8,
    fontFamily: 'Helvetica-Bold',
  },
  tipText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#0D4C47',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 10,
    color: '#A1A1A1',
    borderTop: '1px solid #E5E5E5',
    paddingTop: 15,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 10,
    bottom: 30,
    right: 40,
    color: '#A1A1A1',
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
  
  return lines.map((line, index) => (
    <View key={index} style={styles.bulletPoint}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{line.trim()}</Text>
    </View>
  ))
}

export const GutHealthReportPDF: React.FC<{ data: ReportData }> = ({ data }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const userName = data.userProfile?.firstName || 'Valued Member'

  const getScoreDescription = (score: number) => {
    if (score >= 8) return 'Excellent gut health!'
    if (score >= 6) return 'Good gut health with room for improvement'
    if (score >= 4) return 'Moderate gut health - focus areas identified'
    return 'Significant improvement opportunities'
  }

  return (
    <Document>
      {/* Page 1 - Cover & Score */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>GutRoot</Text>
          <Text style={styles.subtitle}>Personalized Gut Health Report</Text>
          <Text style={styles.subtitle}>for {userName}</Text>
          <Text style={styles.date}>Generated on {currentDate}</Text>
        </View>

        <View style={styles.scoreSection}>
          <Text style={styles.scoreTitle}>Your Digestive Health Score</Text>
          <Text style={styles.scoreValue}>{data.digestive_score}/10</Text>
          <Text style={styles.scoreDescription}>
            {getScoreDescription(data.digestive_score)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This Report</Text>
          <Text style={styles.sectionContent}>
            This personalized gut health report was generated based on your comprehensive assessment. 
            Our AI-powered analysis has identified key areas for improvement and provided evidence-based 
            recommendations tailored specifically to your unique health profile and lifestyle.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Assessment Summary</Text>
          {data.assessmentData?.age && (
            <Text style={styles.sectionContent}>Age: {data.assessmentData.age}</Text>
          )}
          {data.assessmentData?.gender && (
            <Text style={styles.sectionContent}>Gender: {data.assessmentData.gender}</Text>
          )}
          {data.assessmentData?.initialReason && (
            <Text style={styles.sectionContent}>Primary Concern: {data.assessmentData.initialReason}</Text>
          )}
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>🌟 This Week's Power Tip</Text>
          <Text style={styles.tipText}>{data.ai_tip_of_week}</Text>
        </View>

        <View style={styles.footer}>
          <Text>
            This report is for educational purposes only and should not replace professional medical advice.
            Please consult with your healthcare provider before making significant changes to your diet or lifestyle.
          </Text>
        </View>
      </Page>

      {/* Page 2 - Dietary Recommendations */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Dietary Recommendations</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personalized Nutrition Plan</Text>
          {formatBulletPoints(data.diet_recommendations)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supplement Suggestions</Text>
          {formatBulletPoints(data.supplement_suggestions)}
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber }) => `Page ${pageNumber}`} />
      </Page>

      {/* Page 3 - Lifestyle & Analysis */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Lifestyle & Health Analysis</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Lifestyle Changes</Text>
          {formatBulletPoints(data.lifestyle_changes)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bowel Health Analysis</Text>
          <Text style={styles.sectionContent}>{data.bowel_trends}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptom Pattern Insights</Text>
          <Text style={styles.sectionContent}>{data.symptom_patterns_analysis}</Text>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber }) => `Page ${pageNumber}`} />
      </Page>

      {/* Page 4 - Goals & Next Steps */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Action Plan</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Goals</Text>
          {formatBulletPoints(data.goal_reminders)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Steps</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Start with one or two recommendations that feel most manageable
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Track your progress using a food and symptom diary
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Reassess your gut health in 4-6 weeks to track improvements
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Consult with a healthcare provider if symptoms persist or worsen
            </Text>
          </View>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>📧 Stay Connected</Text>
          <Text style={styles.tipText}>
            Continue your gut health journey with GutRoot! You'll receive weekly tips, 
            progress check-ins, and new insights to support your digestive wellness.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>
            Generated by GutRoot • www.gutroot.com • For questions or support, contact us at support@gutroot.com
          </Text>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber }) => `Page ${pageNumber}`} />
      </Page>
    </Document>
  )
} 