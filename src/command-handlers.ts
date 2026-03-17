import { TeneoTask, JobSearchParams } from './types'
import { JobDataService } from './job-data-service'
import { AIClient } from './ai-client'

const JOB_AGENT_SYSTEM_PROMPT = `You are Job Market Intelligence — a specialized AI agent on the Teneo Protocol network.
You help users navigate the job market with real-time data, salary insights, and career advice.

Your capabilities:
- Search and filter job listings from multiple sources
- Analyze job market trends for any role or location
- Estimate competitive salaries based on role, experience, and location
- Match job listings against a user's CV/resume
- Provide career advice and skill recommendations

Always be concise, data-driven, and actionable. Format your responses clearly.
When showing job listings or salary data, use structured formatting.
Currency amounts should always include the unit (e.g., "$120k/year").`

export class CommandHandlers {
  private jobService: JobDataService
  private ai: AIClient

  constructor() {
    this.jobService = new JobDataService()
    this.ai = new AIClient()
  }

  // ─────────────────────────────────────────────
  // Route command to appropriate handler
  // ─────────────────────────────────────────────

  async handle(task: TeneoTask): Promise<string> {
    const cmd = task.command.toLowerCase()
    const args = task.args

    console.log(`[Commands] Handling: ${cmd} | Args: ${args.join(', ')}`)

    switch (cmd) {
      case '/jobs':
      case '/search':
        return this.handleJobSearch(args)

      case '/salary':
        return this.handleSalaryQuery(args)

      case '/market':
      case '/trends':
        return this.handleMarketAnalysis(args)

      case '/match':
        return this.handleCVMatch(args, task.rawMessage)

      case '/advice':
      case '/career':
        return this.handleCareerAdvice(args, task.rawMessage)

      case '/skills':
        return this.handleSkillsQuery(args)

      case '/help':
      default:
        return this.handleHelp()
    }
  }

  // ─────────────────────────────────────────────
  // /jobs <role> [location] [remote] [seniority]
  // ─────────────────────────────────────────────

  private async handleJobSearch(args: string[]): Promise<string> {
    if (args.length === 0) {
      return '❌ Usage: `/jobs <role> [location] [remote]`\nExample: `/jobs "backend developer" London remote`'
    }

    const params: JobSearchParams = {
      keywords: [],
      limit: 5,
    }

    // Parse args: quoted phrases or single words
    let remaining = args.join(' ')
    const quoted = remaining.match(/"([^"]+)"/g)

    if (quoted) {
      params.keywords = quoted.map((q) => q.replace(/"/g, ''))
      remaining = remaining.replace(/"([^"]+)"/g, '').trim()
    } else {
      // First 2 words = role
      const words = remaining.split(' ')
      params.keywords = words.slice(0, 2)
      remaining = words.slice(2).join(' ')
    }

    if (remaining.includes('remote')) {
      params.remote = true
      remaining = remaining.replace('remote', '').trim()
    }

    if (remaining.trim()) params.location = remaining.trim()

    const jobs = await this.jobService.searchJobs(params)

    if (jobs.length === 0) {
      return '😕 No jobs found for your search. Try broader keywords or different location.'
    }

    let result = `🔍 **Job Search Results** for "${params.keywords.join(' ')}"${params.location ? ` in ${params.location}` : ''}${params.remote ? ' (Remote)' : ''}\n\n`
    result += `Found ${jobs.length} listings:\n\n`

    for (const job of jobs) {
      const salary = job.salary?.min
        ? `$${(job.salary.min / 1000).toFixed(0)}k–$${((job.salary.max || job.salary.min * 1.3) / 1000).toFixed(0)}k/yr`
        : 'Salary not listed'

      result += `**${job.title}** @ ${job.company}\n`
      result += `📍 ${job.location}${job.remote ? ' 🌐 Remote' : ''}  💰 ${salary}\n`
      result += `🏷️ ${job.seniority} · ${job.type}\n`
      result += `🔧 ${job.skills.slice(0, 5).join(', ')}\n`
      result += `🔗 ${job.url}\n\n`
    }

    return result
  }

  // ─────────────────────────────────────────────
  // /salary <role> [location] [years_exp]
  // ─────────────────────────────────────────────

  private async handleSalaryQuery(args: string[]): Promise<string> {
    if (args.length === 0) {
      return '❌ Usage: `/salary <role> [location] [years_experience]`\nExample: `/salary "software engineer" London 5`'
    }

    const roleWords: string[] = []
    let location: string | undefined
    let years: number | undefined

    for (const arg of args) {
      if (/^\d+$/.test(arg)) {
        years = parseInt(arg)
      } else if (roleWords.length >= 2) {
        location = location ? `${location} ${arg}` : arg
      } else {
        roleWords.push(arg)
      }
    }

    const role = roleWords.join(' ')
    const estimate = await this.jobService.estimateSalary(role, location, years)

    const pct = estimate.percentiles
    return (
      `💰 **Salary Estimate: ${role}**\n` +
      `📍 Location: ${estimate.location}\n` +
      (years !== undefined ? `📅 Experience: ${years} years\n` : '') +
      `\n` +
      `**Range:** $${(estimate.min / 1000).toFixed(0)}k – $${(estimate.max / 1000).toFixed(0)}k/year\n` +
      `**Median:** $${(estimate.median / 1000).toFixed(0)}k/year\n` +
      `\n` +
      `**Percentiles:**\n` +
      `  25th: $${(pct.p25 / 1000).toFixed(0)}k\n` +
      `  50th: $${(pct.p50 / 1000).toFixed(0)}k\n` +
      `  75th: $${(pct.p75 / 1000).toFixed(0)}k\n` +
      `  90th: $${(pct.p90 / 1000).toFixed(0)}k\n` +
      `\n` +
      `📊 Based on ${estimate.dataPoints} data points · Confidence: ${estimate.confidence}\n` +
      `💡 Tip: Use \`/market ${role}\` for full demand analysis`
    )
  }

  // ─────────────────────────────────────────────
  // /market <role> [location]
  // ─────────────────────────────────────────────

  private async handleMarketAnalysis(args: string[]): Promise<string> {
    if (args.length === 0) {
      return '❌ Usage: `/market <role> [location]`\nExample: `/market "data scientist" remote`'
    }

    const role = args.slice(0, 2).join(' ')
    const location = args.length > 2 ? args.slice(2).join(' ') : undefined
    const analysis = await this.jobService.analyzeMarket(role, location)

    let result =
      `📈 **Market Analysis: ${analysis.role}**\n` +
      (location ? `📍 ${location}\n` : '') +
      `\n` +
      `**Overview**\n` +
      `• Total listings: ${analysis.totalListings}\n` +
      `• Avg salary: $${(analysis.avgSalaryMin / 1000).toFixed(0)}k – $${(analysis.avgSalaryMax / 1000).toFixed(0)}k/yr\n` +
      `• Remote jobs: ${analysis.remotePercentage}%\n` +
      `• Trend: ${analysis.trend === 'growing' ? '📈 Growing' : analysis.trend === 'stable' ? '➡️ Stable' : '📉 Declining'}\n\n`

    if (analysis.topSkills.length > 0) {
      result += `**Top In-Demand Skills**\n`
      for (const s of analysis.topSkills.slice(0, 8)) {
        const bar = '█'.repeat(Math.round(s.percentage / 10))
        result += `• ${s.skill.padEnd(20)} ${bar} ${s.percentage}%\n`
      }
      result += '\n'
    }

    if (analysis.topLocations.length > 0) {
      result += `**Top Locations**\n`
      for (const loc of analysis.topLocations) {
        result += `• ${loc.location}: ${loc.count} listings (${loc.percentage}%)\n`
      }
    }

    return result
  }

  // ─────────────────────────────────────────────
  // /match <role> [location] — pastes CV in message
  // ─────────────────────────────────────────────

  private async handleCVMatch(args: string[], rawMessage: string): Promise<string> {
    // Extract CV text: everything after "---" separator
    const separator = rawMessage.indexOf('---')
    const cvText = separator !== -1 ? rawMessage.slice(separator + 3).trim() : ''

    if (!cvText) {
      return (
        '❌ Please include your CV/skills after `---` separator.\n\n' +
        'Example:\n' +
        '```\n' +
        '/match software engineer London\n' +
        '---\n' +
        '5 years experience with React, TypeScript, Node.js, AWS\n' +
        'Led team of 4, built microservices, CI/CD pipelines\n' +
        '```'
      )
    }

    const role = args.slice(0, 2).join(' ') || 'developer'
    const location = args.length > 2 ? args.slice(2).join(' ') : undefined

    const jobs = await this.jobService.searchJobs({
      keywords: [role],
      location,
      limit: 5,
    })

    const matches = await this.jobService.matchJobsToCV(cvText, jobs)

    let result = `🎯 **CV Match Results** for "${role}"\n\n`

    for (const match of matches) {
      result += `**${match.job.title}** @ ${match.job.company}\n`
      result += `Match: ${match.matchScore}% · ${match.recommendation}\n`

      if (match.matchedSkills.length > 0) {
        result += `✅ You have: ${match.matchedSkills.join(', ')}\n`
      }
      if (match.missingSkills.length > 0) {
        result += `📚 To learn: ${match.missingSkills.slice(0, 4).join(', ')}\n`
      }
      result += `🔗 ${match.job.url}\n\n`
    }

    return result
  }

  // ─────────────────────────────────────────────
  // /advice <question> — AI career advice
  // ─────────────────────────────────────────────

  private async handleCareerAdvice(args: string[], rawMessage: string): Promise<string> {
    const question = args.join(' ') || rawMessage.replace('/advice', '').replace('/career', '').trim()

    if (!question) {
      return '❌ Usage: `/advice <your career question>`\nExample: `/advice how to transition from frontend to ML engineer?`'
    }

    try {
      const response = await this.ai.complete(JOB_AGENT_SYSTEM_PROMPT, [
        { role: 'user', content: question },
      ], 800)

      return `🧠 **Career Advice**\n\n${response.content}`
    } catch (err) {
      return `🧠 **Career Advice**\n\nFor transitioning careers in tech, consider:\n1. Identify transferable skills\n2. Build portfolio projects in target area\n3. Get relevant certifications\n4. Network in target community\n\n_Tip: Connect an AI provider (Claude/OpenAI) for personalized advice._`
    }
  }

  // ─────────────────────────────────────────────
  // /skills <role> — what skills to learn
  // ─────────────────────────────────────────────

  private async handleSkillsQuery(args: string[]): Promise<string> {
    const role = args.join(' ') || 'software engineer'
    const analysis = await this.jobService.analyzeMarket(role)

    let result = `🔧 **Skills Roadmap: ${role}**\n\n`

    const essential = analysis.topSkills.slice(0, 5)
    const nice = analysis.topSkills.slice(5, 10)

    if (essential.length > 0) {
      result += `**Essential Skills** (high demand)\n`
      for (const s of essential) {
        result += `• ${s.skill} — ${s.percentage}% of listings\n`
      }
      result += '\n'
    }

    if (nice.length > 0) {
      result += `**Nice to Have** (competitive advantage)\n`
      for (const s of nice) {
        result += `• ${s.skill} — ${s.percentage}% of listings\n`
      }
      result += '\n'
    }

    result += `💡 Use \`/market ${role}\` for full analysis with salary data`
    return result
  }

  // ─────────────────────────────────────────────
  // /help
  // ─────────────────────────────────────────────

  private handleHelp(): string {
    return `
🤖 **Job Market Intelligence Agent**
_Powered by Teneo Protocol_

**Commands:**

\`/jobs <role> [location] [remote]\`
Search job listings with filters
→ \`/jobs "React developer" Berlin remote\`

\`/salary <role> [location] [years]\`
Get salary estimates with percentiles
→ \`/salary "ML engineer" "San Francisco" 4\`

\`/market <role> [location]\`
Analyze job market trends & top skills
→ \`/market "blockchain developer"\`

\`/skills <role>\`
Skills roadmap for any role
→ \`/skills "data scientist"\`

\`/match <role> [location]\`
Match your CV against listings (paste CV after ---)
→ \`/match "backend developer" London\n---\nYour CV text here...\`

\`/advice <question>\`
AI-powered career advice
→ \`/advice how to get my first dev job?\`

\`/help\`
Show this message

---
💰 Pricing: $0.001 USDC per query · Powered by x402
    `.trim()
  }
}
