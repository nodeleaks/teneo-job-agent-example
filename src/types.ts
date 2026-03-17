export type AIProvider = 'claude' | 'openai'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  content: string
  tokensUsed: number
}

export interface TeneoTask {
  id: string
  roomId: string
  userId: string
  command: string
  args: string[]
  rawMessage: string
  timestamp: number
  paymentHeader?: string
}

export interface TeneoAgentConfig {
  name: string
  version: string
  description: string
  commands: AgentCommand[]
  ownerAddress: string
  nftTokenId?: number
  pricePerTask: number
  rateLimitPerMinute: number
}

export interface AgentCommand {
  name: string
  description: string
  usage: string
  priceUSDC: number
  examples: string[]
}

export interface TeneoMessage {
  type: 'task' | 'ping' | 'auth' | 'stream_chunk' | 'stream_end' | 'error'
  taskId?: string
  roomId?: string
  content?: string
  metadata?: Record<string, unknown>
}

export interface AgentResponse {
  taskId: string
  content: string
  isStreaming?: boolean
  metadata?: Record<string, unknown>
}

export interface JobResponse {
  results?: Record<string, unknown>[]
}

export interface JobListing {
  id: string
  title: string
  company: string
  location: string
  salary?: SalaryRange
  description: string
  requirements: string[]
  skills: string[]
  postedDate: string
  url: string
  remote: boolean
  type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance'
  seniority: 'entry' | 'mid' | 'senior' | 'lead' | 'executive'
  source: string
}

export interface SalaryRange {
  min?: number
  max?: number
  currency: string
  period: 'annual' | 'monthly' | 'hourly'
}

export interface JobSearchParams {
  keywords: string[]
  location?: string
  remote?: boolean
  minSalary?: number
  maxSalary?: number
  seniority?: string
  jobType?: string
  limit?: number
}

export interface MarketAnalysis {
  role: string
  avgSalaryMin: number
  avgSalaryMax: number
  currency: string
  topSkills: SkillDemand[]
  topLocations: LocationDemand[]
  remotePercentage: number
  totalListings: number
  trend: 'growing' | 'stable' | 'declining'
  lastUpdated: string
}

export interface SkillDemand {
  skill: string
  count: number
  percentage: number
  avgSalaryBoost?: number
}

export interface LocationDemand {
  location: string
  count: number
  percentage: number
  avgSalary?: number
}

export interface CVMatchResult {
  job: JobListing
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  recommendation: string
}

export interface SalaryQuery {
  role: string
  location?: string
  yearsExperience?: number
  skills?: string[]
  result?: SalaryEstimate
}

export interface SalaryEstimate {
  role: string
  location: string
  min: number
  max: number
  median: number
  currency: string
  confidence: 'low' | 'medium' | 'high'
  dataPoints: number
  percentiles: {
    p25: number
    p50: number
    p75: number
    p90: number
  }
}
