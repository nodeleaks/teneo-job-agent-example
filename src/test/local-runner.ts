/**
 * LOCAL TEST RUNNER
 * Tests all agent commands without connecting to Teneo network.
 */

import 'dotenv/config'
import { CommandHandlers } from '../command-handlers'
import { TeneoTask } from '../types'

const handlers = new CommandHandlers()

// ── Helper: build a fake task ──────────────────────────────

function makeTask(rawMessage: string): TeneoTask {
  const parts = rawMessage.trim().split(/\s+/)
  const command = parts[0].startsWith('/') ? parts[0] : '/advice'
  const args = parts.slice(1)

  return {
    id: `test-${Date.now()}`,
    roomId: 'test-room',
    userId: 'test-user',
    command,
    args,
    rawMessage,
    timestamp: Date.now()
  }
}

// ── Test runner ────────────────────────────────────────────

async function runTest(label: string, message: string) {
  console.log('\n' + '─'.repeat(60))
  console.log(`TEST: ${label}`)
  console.log(`INPUT: ${message}`)
  console.log('─'.repeat(60))

  const task = makeTask(message)
  const start = Date.now()

  try {
    const result = await handlers.handle(task)
    console.log(result)
    console.log(`\n✅ Done in ${Date.now() - start}ms`)
  } catch (err) {
    console.error(`❌ Error: ${err}`)
  }
}

// ── Run all tests ──────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Job Market Agent — Local Tests      ║')
  console.log('╚══════════════════════════════════════╝')

  await runTest('Help command', '/help')

  await runTest('Job search — basic', '/jobs "React developer"')

  await runTest('Job search — with location', '/jobs "backend developer" London')

  await runTest('Job search — remote', '/jobs "ML engineer" remote')

  await runTest('Salary estimate', '/salary "software engineer" London 5')

  await runTest('Salary — senior level', '/salary "data scientist" "San Francisco" 8')

  await runTest('Market analysis', '/market "blockchain developer"')

  await runTest('Skills roadmap', '/skills "devops engineer"')

  await runTest(
    'CV matching',
    '/match "backend developer" London\n---\n5 years Node.js TypeScript PostgreSQL Docker AWS Redis REST API microservices team lead'
  )

  // This one calls real AI if ANTHROPIC_API_KEY is set, otherwise shows fallback
  await runTest(
    'Career advice (AI)',
    '/advice how to transition from frontend developer to ML engineer?'
  )

  console.log('\n' + '═'.repeat(60))
  console.log('All tests complete!')
  console.log('═'.repeat(60))
}

main().catch(console.error)
