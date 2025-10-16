// Chart data types for bill financial visualizations

export interface BudgetCategory {
  name: string
  value: number
  color?: string
  percentage?: number
}

export interface BudgetAllocation {
  category: string
  amount: number
  description?: string
}

export interface TimelineDataPoint {
  date: string
  amount: number
  label?: string
}

export interface ComparisonData {
  category: string
  current: number
  previous?: number
  target?: number
}

export type ChartType = 'pie' | 'bar' | 'line' | 'comparison' | 'donut'

export interface ChartData {
  type: ChartType
  title: string
  description?: string
  data: BudgetCategory[] | BudgetAllocation[] | TimelineDataPoint[] | ComparisonData[]
  total?: number
  currency?: string
  metadata?: Record<string, unknown>
}

export interface ChatMessageWithChart {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  chart?: ChartData
  sources?: Array<{
    title: string
    category: string
    relevanceScore: number
  }>
}
