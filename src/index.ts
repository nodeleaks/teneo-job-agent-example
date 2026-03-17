import 'dotenv/config'
import { TeneoClient } from './teneo-client'
import { CommandHandlers } from './command-handlers'
import { TeneoTask, TeneoAgentConfig } from './types'

// ──────────────────────────────────────────────────────────
// Agent Configuration
// ──────────────────────────────────────────────────────────

const agentConfig: TeneoAgentConfig = {
  name: process.env.AGENT_NAME || 'Job Market Intelligence',
  version: process.env.AGENT_VERSION || '1.0.0',
  description:
    'Real-time job market intelligence: search listings, analyze salary data, match your CV, and get AI-powered career advice.',
  ownerAddress: process.env.OWNER_ADDRESS || '',
  nftTokenId: process.env.NFT_TOKEN_ID
    ? parseInt(process.env.NFT_TOKEN_ID)
    : undefined,
  pricePerTask: parseFloat(process.env.PRICE_PER_TASK || '0.01'),
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '30'),
  commands: [
    {
      name: '/jobs',
      description: 'Search job listings by role, location, and filters',
      usage: '/jobs <role> [location] [remote]',
      priceUSDC: 0.001,
      examples: ['/jobs "React developer" Berlin', '/jobs "ML engineer" remote'],
    },
    {
      name: '/salary',
      description: 'Get salary estimates with percentile breakdown',
      usage: '/salary <role> [location] [years_experience]',
      priceUSDC: 0.001,
      examples: ['/salary "software engineer" London 5'],
    },
    {
      name: '/market',
      description: 'Analyze job market trends, top skills, and demand by location',
      usage: '/market <role> [location]',
      priceUSDC: 0.002,
      examples: ['/market "data scientist"', '/market "blockchain developer" NYC'],
    },
    {
      name: '/skills',
      description: 'Get skills roadmap and demand analysis for a role',
      usage: '/skills <role>',
      priceUSDC: 0.001,
      examples: ['/skills "devops engineer"'],
    },
    {
      name: '/match',
      description: 'Match your CV against job listings with gap analysis',
      usage: '/match <role> [location]\n---\nYour CV text here',
      priceUSDC: 0.003,
      examples: ['/match "backend developer" London\n---\n5yr Node.js TypeScript AWS'],
    },
    {
      name: '/advice',
      description: 'AI-powered career advice on any question',
      usage: '/advice <your question>',
      priceUSDC: 0.002,
      examples: ['/advice how to transition from frontend to ML?'],
    },
    {
      name: '/help',
      description: 'Show all available commands',
      usage: '/help',
      priceUSDC: 0.000,
      examples: ['/help'],
    },
  ],
}

// ──────────────────────────────────────────────────────────
// Rate Limiting
// ──────────────────────────────────────────────────────────

class RateLimiter {
  private counts = new Map<string, { count: number; resetAt: number }>()
  private maxPerMinute: number

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute
  }

  check(userId: string): boolean {
    if (this.maxPerMinute === 0) return true; // unlimited

    const now = Date.now()
    const entry = this.counts.get(userId)

    if (!entry || now > entry.resetAt) {
      this.counts.set(userId, { count: 1, resetAt: now + 60000 })
      return true
    }

    if (entry.count >= this.maxPerMinute) {
      return false
    }

    entry.count++
    return true
  }
}

// ──────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────

async function main() {
  // Validate required environment
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable is required')
    process.exit(1)
  }

  if (process.env.ACCEPT_EULA !== 'true') {
    console.error(
      '❌ You must accept the Teneo EULA by setting ACCEPT_EULA=true\n' +
      '   EULA: https://cdn.teneo.pro/Teneo_Agent_SDK_End_User_License_Agreement_(EULA)_v1_1_0.pdf'
    )
    process.exit(1)
  }

  console.log('')
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Job Market Intelligence Agent       ║')
  console.log('║   Powered by Teneo Protocol           ║')
  console.log('╚══════════════════════════════════════╝')
  console.log('')

  const client = new TeneoClient(agentConfig)
  const handlers = new CommandHandlers()
  const rateLimiter = new RateLimiter(agentConfig.rateLimitPerMinute)

  // ── Event Listeners ──────────────────────────

  client.on('connected', () => {
    console.log(`[Agent] ✅ Connected | Wallet: ${client.walletAddress}`)
    console.log(`[Agent] 🏠 Room: ${client.roomId}`)
    console.log(`[Agent] 💰 Price: $${agentConfig.pricePerTask} USDC per task`)
    console.log(`[Agent] 🚀 Ready to serve job market intelligence!\n`)
  })

  client.on('room_joined', (roomId: string) => {
    console.log(`[Agent] 📍 Active in room: ${roomId}`)
  })

  client.on('task', async (task: TeneoTask) => {
    // Rate limiting
    if (!rateLimiter.check(task.userId)) {
      client.sendResponse({
        taskId: task.id,
        content:
          `⏱️ Rate limit reached. You can send ${agentConfig.rateLimitPerMinute} requests per minute.\nPlease wait before sending another request.`,
      })
      return
    }

    const startTime = Date.now()
    console.log(`[Agent] 📩 Task from ${task.userId}: "${task.rawMessage.slice(0, 60)}..."`)

    try {
      // Stream "thinking" indicator
      client.sendStreamChunk(task.id, '⏳ Processing your request...\n\n')

      const result = await handlers.handle(task)
      const elapsed = Date.now() - startTime

      // Send full response
      client.sendStreamChunk(task.id, result, false)
      client.sendStreamChunk(
        task.id,
        `\n\n_⚡ Processed in ${elapsed}ms · Job Market Intelligence v${agentConfig.version}_`,
        true
      )

      console.log(`[Agent] ✅ Task ${task.id} completed in ${elapsed}ms`)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`[Agent] ❌ Task ${task.id} failed:`, error)

      client.sendResponse({
        taskId: task.id,
        content:
          `❌ Sorry, an error occurred while processing your request.\n\nError: ${error}\n\nPlease try again or use \`/help\` to see available commands.`,
      })
    }
  })

  client.on('disconnected', ({ code, reason }: { code: number; reason: string }) => {
    console.log(`[Agent] 🔌 Disconnected: ${code} ${reason}`)
  })

  client.on('fatal_error', (msg: string) => {
    console.error(`[Agent] 💀 Fatal error: ${msg}`)
    process.exit(1)
  })

  // ── Graceful Shutdown ─────────────────────────

  process.on('SIGINT', () => {
    console.log('\n[Agent] Shutting down gracefully...')
    client.disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n[Agent] SIGTERM received, shutting down...')
    client.disconnect()
    process.exit(0)
  })

  // ── Start ─────────────────────────────────────

  await client.connect()
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
