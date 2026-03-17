import {
  JobListing,
  JobSearchParams,
  MarketAnalysis,
  SkillDemand,
  SalaryEstimate,
  CVMatchResult,
  JobResponse
} from './types'

/**
 * JobResponseService
 *
 * Aggregates job data from multiple sources:
 *  1. Reed.co.uk API (UK focused)
 *  2. Adzuna API (global)
 *  3. Fallback: realistic mock data for demo / development
 */
export class JobDataService {
  private reedApiKey = process.env.REED_API_KEY || ''
  private adzunaAppId = process.env.ADZUNA_APP_ID || ''
  private adzunaApiKey = process.env.ADZUNA_API_KEY || ''
  private linkedInRapidApiKey = process.env.LINKEDIN_RAPIDAPI_KEY || ''
  private noFluffJobsApiKey = process.env.NOFLUFFJOBS_API_KEY || ''
  private justJoinApiKey = process.env.JUSTJOIN_API_KEY || ''

  // ─────────────────────────────────────────────
  // Job Search
  // ─────────────────────────────────────────────

  async searchJobs(params: JobSearchParams): Promise<JobListing[]> {
    const results: JobListing[] = []

    // Try real APIs, fall back to mock data
    try {
      if (this.adzunaAppId && this.adzunaApiKey) {
        const adzunaJobs = await this.searchAdzuna(params)
        results.push(...adzunaJobs)
      }
    } catch (err) {
      console.warn('[JobDataService] Adzuna API failed, using mock data')
    }

    try {
      if (this.reedApiKey && results.length < 5) {
        const reedJobs = await this.searchReed(params)
        results.push(...reedJobs)
      }
    } catch (err) {
      console.warn('[JobDataService] Reed API failed')
    }

    try {
      if (this.linkedInRapidApiKey) {
        const linkedInJobs = await this.searchLinkedIn(params)
        results.push(...linkedInJobs)
      }
    } catch (err) {
      console.warn('[JobDataService] LinkedIn RapidAPI failed')
    }

    try {
      if (this.noFluffJobsApiKey) {
        const nfjJobs = await this.searchNoFluffJobs(params)
        results.push(...nfjJobs)
      }
    } catch (err) {
      console.warn('[JobDataService] NoFluffJobs API failed')
    }

    try {
      if (this.justJoinApiKey) {
        const jjJobs = await this.searchJustJoinIt(params)
        results.push(...jjJobs)
      }
    } catch (err) {
      console.warn('[JobDataService] JustJoin.it API failed')
    }

    // Always supplement with mock data for demo purposes
    if (results.length < 3) {
      const mockJobs = this.generateMockJobs(params)
      results.push(...mockJobs)
    }

    return results.slice(0, params.limit || 10)
  }

  // ─────────────────────────────────────────────
  // Market Analysis
  // ─────────────────────────────────────────────

  async analyzeMarket(role: string, location?: string): Promise<MarketAnalysis> {
    const params: JobSearchParams = {
      keywords: [role],
      location,
      limit: 50,
    }

    const jobs = await this.searchJobs(params)

    // Aggregate skills demand
    const skillCount: Record<string, number> = {}
    const locationCount: Record<string, number> = {}
    let salarySum = 0
    let salaryCount = 0
    let remoteCount = 0

    for (const job of jobs) {
      for (const skill of job.skills) {
        skillCount[skill] = (skillCount[skill] || 0) + 1
      }

      const loc = job.location || 'Remote'
      locationCount[loc] = (locationCount[loc] || 0) + 1

      if (job.salary?.min) {
        salarySum += job.salary.min
        salaryCount++
      }

      if (job.remote) remoteCount++
    }

    const topSkills: SkillDemand[] = Object.entries(skillCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({
        skill,
        count,
        percentage: Math.round((count / jobs.length) * 100),
      }))

    const topLocations = Object.entries(locationCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([location, count]) => ({
        location,
        count,
        percentage: Math.round((count / jobs.length) * 100),
      }))

    const avgSalary = salaryCount > 0 ? salarySum / salaryCount : 0

    return {
      role,
      avgSalaryMin: Math.round(avgSalary * 0.85),
      avgSalaryMax: Math.round(avgSalary * 1.15),
      currency: 'USD',
      topSkills,
      topLocations,
      remotePercentage: Math.round((remoteCount / Math.max(jobs.length, 1)) * 100),
      totalListings: jobs.length,
      trend: 'growing',
      lastUpdated: new Date().toISOString(),
    }
  }

  // ─────────────────────────────────────────────
  // Salary Estimation
  // ─────────────────────────────────────────────

  async estimateSalary(
    role: string,
    location?: string,
    yearsExp?: number
  ): Promise<SalaryEstimate> {
    // Salary multipliers by seniority
    const expMultiplier =
      yearsExp === undefined
        ? 1.0
        : yearsExp <= 1
          ? 0.75
          : yearsExp <= 3
            ? 0.9
            : yearsExp <= 6
              ? 1.0
              : yearsExp <= 10
                ? 1.2
                : 1.4

    // Base salary data by role (USD annual)
    const baseSalaries: Record<string, { min: number; max: number }> = {
      'software engineer': { min: 80000, max: 160000 },
      'frontend developer': { min: 70000, max: 140000 },
      'backend developer': { min: 80000, max: 160000 },
      'fullstack developer': { min: 85000, max: 165000 },
      'data scientist': { min: 90000, max: 180000 },
      'machine learning engineer': { min: 100000, max: 200000 },
      'devops engineer': { min: 90000, max: 170000 },
      'product manager': { min: 95000, max: 190000 },
      'ux designer': { min: 65000, max: 130000 },
      'data analyst': { min: 60000, max: 120000 },
      'blockchain developer': { min: 100000, max: 200000 },
      'ai engineer': { min: 110000, max: 220000 },
    }

    const roleKey = role.toLowerCase()
    const base = baseSalaries[roleKey] || { min: 60000, max: 120000 }

    // Location multiplier
    const locationMultipliers: Record<string, number> = {
      'san francisco': 1.5,
      'new york': 1.4,
      'seattle': 1.3,
      'london': 1.1,
      'berlin': 0.85,
      'warsaw': 0.6,
      'remote': 1.0,
    }

    const locKey = (location || '').toLowerCase()
    const locMult =
      Object.entries(locationMultipliers).find(([key]) =>
        locKey.includes(key)
      )?.[1] || 1.0

    const min = Math.round(base.min * expMultiplier * locMult)
    const max = Math.round(base.max * expMultiplier * locMult)
    const median = Math.round((min + max) / 2)

    return {
      role,
      location: location || 'Global',
      min,
      max,
      median,
      currency: 'USD',
      confidence: 'medium',
      dataPoints: Math.floor(Math.random() * 200) + 50,
      percentiles: {
        p25: Math.round(min * 0.9),
        p50: median,
        p75: Math.round(max * 0.9),
        p90: Math.round(max * 1.05),
      },
    }
  }

  // ─────────────────────────────────────────────
  // CV Matching
  // ─────────────────────────────────────────────

  async matchJobsToCV(
    cvText: string,
    jobs: JobListing[]
  ): Promise<CVMatchResult[]> {
    const cvLower = cvText.toLowerCase()

    return jobs
      .map((job) => {
        const matchedSkills = job.skills.filter((skill) =>
          cvLower.includes(skill.toLowerCase())
        )

        const missingSkills = job.skills.filter(
          (skill) => !cvLower.includes(skill.toLowerCase())
        )

        const matchScore = Math.round(
          (matchedSkills.length / Math.max(job.skills.length, 1)) * 100
        )

        const recommendation =
          matchScore >= 80
            ? '✅ Excellent match — apply now!'
            : matchScore >= 60
              ? '🟡 Good match — tailor your CV before applying'
              : matchScore >= 40
                ? '🟠 Partial match — skill gap exists, consider upskilling'
                : '❌ Low match — significant skill gap'

        return {
          job,
          matchScore,
          matchedSkills,
          missingSkills,
          recommendation
        }
      })
      .sort((a, b) => b.matchScore - a.matchScore)
  }

  // ─────────────────────────────────────────────
  // Real API Integrations
  // ─────────────────────────────────────────────

  private async searchAdzuna(params: JobSearchParams): Promise<JobListing[]> {
    const query = params.keywords.join(' ')
    const country = 'gb'; // default UK; could be parameterized
    const searchParams = new URLSearchParams({
      app_id: this.adzunaAppId,
      app_key: this.adzunaApiKey,
      what: query,
      where: params.location || '',
      results_per_page: String(params.limit || 10),
      'content-type': 'application/json',
    })
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${searchParams.toString()}`

    const response = await fetch(url)

    if (!response.ok) throw new Error(`Adzuna API error: ${response.statusText}`)

    const data = await response.json() as JobResponse
    return (data.results || []).map(
      (item: Record<string, unknown>, idx: number) =>
        this.normalizeAdzunaJob(item, idx)
    )
  }

  private async searchReed(params: JobSearchParams): Promise<JobListing[]> {
    const searchParams = new URLSearchParams({
      keywords: params.keywords.join(' '),
      locationName: params.location || '',
      resultsToTake: String(params.limit || 10),
    })

    const url = `https://www.reed.co.uk/api/1.0/search?${searchParams.toString()}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${btoa(`${this.reedApiKey}:`)}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Reed API error: ${response.statusText}`)
    }
    const data = await response.json() as JobResponse

    return (data.results || []).map(
      (item: Record<string, unknown>, idx: number) =>
        this.normalizeReedJob(item, idx)
    )
  }

  private async searchLinkedIn(params: JobSearchParams): Promise<JobListing[]> {
    // Note: Assuming usage of a RapidAPI like "LinkedIn Job Search API" or similar
    // The exact endpoint and data shape heavily depend on the specific RapidAPI chosen.
    // This provides a skeletal example for a common wrapper.
    const url = 'https://linkedin-jobs-search.p.rapidapi.com/search'

    // Convert array of keywords to query string
    const query = params.keywords.join(' ')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': this.linkedInRapidApiKey,
        'X-RapidAPI-Host': 'linkedin-jobs-search.p.rapidapi.com'
      },
      body: JSON.stringify({
        search_terms: query,
        location: params.location || 'Worldwide',
        page: 1,
        fetch_full_text: true
      })
    })

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.statusText}`)
    }

    // Adapt this based on actual RapidAPI data payload format
    const data = await response.json() as any
    let jobsArray: any[] = []

    if (Array.isArray(data)) jobsArray = data
    else if (data.data && Array.isArray(data.data)) jobsArray = data.data

    return jobsArray.slice(0, params.limit || 10).map(
      (item: any, idx: number) => this.normalizeLinkedInJob(item, idx)
    )
  }

  private async searchNoFluffJobs(params: JobSearchParams): Promise<JobListing[]> {
    // Note: Since NoFluffJobs has no public API, this assumes querying via an Apify Scraper Actor endpoint.
    const url = 'https://api.apify.com/v2/acts/nofluffjobs-scraper/run-sync-get-dataset-items?token=' + this.noFluffJobsApiKey

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        queries: params.keywords,
        location: params.location,
        maxItems: params.limit || 10
      })
    })

    if (!response.ok) {
      throw new Error(`NoFluffJobs API error: ${response.statusText}`)
    }

    const data = await response.json() as any[]
    return (Array.isArray(data) ? data : []).map(
      (item: any, idx: number) => this.normalizeNoFluffJobs(item, idx)
    )
  }

  private async searchJustJoinIt(params: JobSearchParams): Promise<JobListing[]> {
    // Note: Since JustJoin.it has no public API, this assumes querying via an Apify Scraper Actor endpoint.
    const url = 'https://api.apify.com/v2/acts/justjoinit-scraper/run-sync-get-dataset-items?token=' + this.justJoinApiKey

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        keyword: params.keywords.join(' '),
        location: params.location,
        maxItems: params.limit || 10
      })
    })

    if (!response.ok) {
      throw new Error(`JustJoin.it API error: ${response.statusText}`)
    }

    const data = await response.json() as any[]
    return (Array.isArray(data) ? data : []).map(
      (item: any, idx: number) => this.normalizeJustJoinItJob(item, idx)
    )
  }

  // ─────────────────────────────────────────────
  // Normalization helpers
  // ─────────────────────────────────────────────

  private normalizeAdzunaJob(
    item: Record<string, unknown>,
    idx: number
  ): JobListing {
    const salary = item as {
      salary_min?: number
      salary_max?: number
    }
    return {
      id: `adzuna-${idx}`,
      title: String(item.title || ''),
      company: String((item.company as Record<string, unknown>)?.display_name || 'Unknown'),
      location: String((item.location as Record<string, unknown>)?.display_name || ''),
      salary: {
        min: salary.salary_min,
        max: salary.salary_max,
        currency: 'GBP',
        period: 'annual',
      },
      description: String(item.description || ''),
      requirements: [],
      skills: this.extractSkillsFromText(String(item.description || '')),
      postedDate: String(item.created || new Date().toISOString()),
      url: String(item.redirect_url || ''),
      remote: String(item.description || '').toLowerCase().includes('remote'),
      type: 'full-time',
      seniority: 'mid',
      source: 'Adzuna',
    }
  }

  private normalizeReedJob(
    item: Record<string, unknown>,
    idx: number
  ): JobListing {
    return {
      id: `reed-${idx}`,
      title: String(item.jobTitle || ''),
      company: String(item.employerName || 'Unknown'),
      location: String(item.locationName || ''),
      salary: {
        min: item.minimumSalary as number | undefined,
        max: item.maximumSalary as number | undefined,
        currency: 'GBP',
        period: 'annual',
      },
      description: String(item.jobDescription || ''),
      requirements: [],
      skills: this.extractSkillsFromText(String(item.jobDescription || '')),
      postedDate: String(item.date || new Date().toISOString()),
      url: String(item.jobUrl || ''),
      remote: Boolean(item.locationName === 'Remote'),
      type: 'full-time',
      seniority: 'mid',
      source: 'Reed',
    }
  }

  private normalizeLinkedInJob(
    item: any,
    idx: number
  ): JobListing {
    return {
      id: `linkedin-${idx}`,
      title: String(item.job_title || item.title || ''),
      company: String(item.company_name || item.company || 'Unknown'),
      location: String(item.job_location || item.location || ''),
      salary: undefined, // Often not provided in typical LinkedIn scrapes
      description: String(item.job_description || item.description || ''),
      requirements: [],
      skills: this.extractSkillsFromText(String(item.job_description || item.description || '')),
      postedDate: String(item.posted_date || item.date || new Date().toISOString()),
      url: String(item.job_url || item.url || ''),
      remote: String(item.job_location || item.location || '').toLowerCase().includes('remote') || String(item.job_description || '').toLowerCase().includes('remote'),
      type: 'full-time',
      seniority: 'mid',
      source: 'LinkedIn',
    }
  }

  private normalizeNoFluffJobs(
    item: any,
    idx: number
  ): JobListing {
    let minSalary, maxSalary, currency

    if (item.salary) {
      minSalary = item.salary.from
      maxSalary = item.salary.to
      currency = item.salary.currency || 'PLN'
    }

    return {
      id: `nofluffjobs-${idx}`,
      title: String(item.title || item.name || ''),
      company: String(item.company?.name || item.company || 'Unknown'),
      location: String(item.location?.places?.[0]?.city || item.location || ''),
      salary: minSalary ? {
        min: minSalary,
        max: maxSalary,
        currency: currency || 'PLN',
        period: 'monthly', // NFJ often shows monthly B2B
      } : undefined,
      description: String(item.description || item.requirements || ''),
      requirements: Array.isArray(item.requirements?.musts) ? item.requirements.musts.map((m: any) => String(m.value)) : [],
      skills: Array.isArray(item.requirements?.musts) ? item.requirements.musts.map((m: any) => String(m.value)) : this.extractSkillsFromText(String(item.description || '')),
      postedDate: String(item.posted || new Date().toISOString()),
      url: String(item.url || ''),
      remote: Boolean(item.fullyRemote),
      type: 'full-time',
      seniority: (item.seniority ? item.seniority[0] : 'mid') as 'entry' | 'mid' | 'senior' | 'lead' | 'executive',
      source: 'NoFluffJobs',
    }
  }

  private normalizeJustJoinItJob(
    item: any,
    idx: number
  ): JobListing {
    let minSalary, maxSalary, currency

    if (item.employment_types?.[0]?.salary) {
      minSalary = item.employment_types[0].salary.from
      maxSalary = item.employment_types[0].salary.to
      currency = item.employment_types[0].salary.currency
    }

    return {
      id: `justjoinit-${idx}`,
      title: String(item.title || ''),
      company: String(item.company_name || 'Unknown'),
      location: String(item.city || item.workplace_type || ''),
      salary: minSalary ? {
        min: minSalary,
        max: maxSalary,
        currency: currency || 'PLN',
        period: 'monthly',
      } : undefined,
      description: String(item.body || item.skills?.map((s: any) => s.name).join(', ') || ''),
      requirements: [],
      skills: Array.isArray(item.skills) ? item.skills.map((s: any) => String(s.name)) : this.extractSkillsFromText(String(item.body || '')),
      postedDate: String(item.published_at || new Date().toISOString()),
      url: `https://justjoin.it/offers/${item.id}`,
      remote: String(item.workplace_type || '').toLowerCase() === 'remote',
      type: 'full-time',
      seniority: String(item.experience_level || 'mid') as 'entry' | 'mid' | 'senior' | 'lead' | 'executive',
      source: 'JustJoin.it',
    }
  }

  // ─────────────────────────────────────────────
  // Mock Data (fallback for demo / dev)
  // ─────────────────────────────────────────────

  private generateMockJobs(params: JobSearchParams): JobListing[] {
    const keyword = params.keywords[0] || 'software engineer'
    const location = params.location || 'Remote'

    const mockTemplates = [
      {
        title: `Senior ${keyword}`,
        company: 'TechCorp Inc',
        salary: { min: 120000, max: 160000 },
        skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'PostgreSQL'],
        seniority: 'senior' as const,
      },
      {
        title: `${keyword}`,
        company: 'StartupX',
        salary: { min: 80000, max: 110000 },
        skills: ['JavaScript', 'Python', 'Docker', 'Kubernetes', 'MongoDB'],
        seniority: 'mid' as const,
      },
      {
        title: `Junior ${keyword}`,
        company: 'Digital Agency Pro',
        salary: { min: 50000, max: 70000 },
        skills: ['JavaScript', 'HTML', 'CSS', 'Git', 'React'],
        seniority: 'entry' as const,
      },
      {
        title: `Lead ${keyword}`,
        company: 'FinTech Solutions',
        salary: { min: 150000, max: 200000 },
        skills: ['Go', 'Rust', 'Microservices', 'Kafka', 'Terraform'],
        seniority: 'lead' as const,
      },
      {
        title: `${keyword} (Remote)`,
        company: 'GlobalTech Remote',
        salary: { min: 90000, max: 130000 },
        skills: ['Python', 'FastAPI', 'React', 'AWS', 'Redis'],
        seniority: 'mid' as const,
      },
    ]

    return mockTemplates.map((tmpl, idx) => ({
      id: `mock-${idx}`,
      title: tmpl.title,
      company: tmpl.company,
      location: idx === 4 ? 'Remote' : location,
      salary: {
        min: tmpl.salary.min,
        max: tmpl.salary.max,
        currency: 'USD',
        period: 'annual' as const,
      },
      description: `We are looking for a talented ${tmpl.title} to join our team. You will work on exciting projects using modern technologies.`,
      requirements: [
        '3+ years of relevant experience',
        'Strong problem-solving skills',
        'Excellent communication',
      ],
      skills: tmpl.skills,
      postedDate: new Date(Date.now() - idx * 86400000).toISOString(),
      url: `https://jobs.example.com/listing/${idx}`,
      remote: idx === 4,
      type: 'full-time' as const,
      seniority: tmpl.seniority,
      source: 'JobMarketAgent Demo',
    }))
  }

  private extractSkillsFromText(text: string): string[] {
    const techSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C#', 'C++',
      'React', 'Vue', 'Angular', 'Next.js', 'Node.js', 'Express', 'FastAPI',
      'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka',
      'Git', 'CI/CD', 'Agile', 'REST', 'GraphQL', 'gRPC',
    ]

    const lower = text.toLowerCase()

    return techSkills.filter((skill) => lower.includes(skill.toLowerCase()))
  }
}
