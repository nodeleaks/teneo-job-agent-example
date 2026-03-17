# 🤖 Job Market Intelligence Agent (Made with Claude)
### Powered by Teneo Protocol

A production-ready AI agent for the [Teneo Protocol](https://teneo-protocol.ai) network that provides real-time job market intelligence, salary data, skills analysis, and CV matching.

---

## Features

| Command | Description |
|---------|-------------|
| `/jobs` | Search job listings with filters (role, location, remote) |
| `/salary` | Salary estimates with percentile breakdown |
| `/market` | Full market analysis: trends, top skills, demand |
| `/skills` | Skills roadmap and demand analysis |
| `/match` | Match your CV against listings with gap analysis |
| `/advice` | AI-powered career advice (Claude or GPT-4) |

---

## Prerequisites

- **Node.js 20+**
- **Ethereum wallet** (private key) for Teneo authentication
- **NFT Token ID** from [deploy.teneo-protocol.ai](https://deploy.teneo-protocol.ai)
- **AI API key** — Anthropic Claude (recommended) or OpenAI

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd job-market-agent
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# ============================================
# Teneo Protocol - Job Market Agent Config
# ============================================

# Your Ethereum private key (without 0x prefix)
PRIVATE_KEY=your_ethereum_private_key_here

# Wallet address corresponding to PRIVATE_KEY
OWNER_ADDRESS=0xYourWalletAddressHere

# NFT Token ID from deploy.teneo-protocol.ai
# Leave empty on first run — SDK will mint automatically
NFT_TOKEN_ID=

# Accept Teneo EULA (required for operation)
ACCEPT_EULA=true

# ============================================
# Agent Settings
# ============================================

AGENT_NAME=Job Market Intelligence
AGENT_VERSION=1.0.0

# Price per task in USDC (default: 0.01)
PRICE_PER_TASK=0.01

# Rate limit: tasks per minute (0 = unlimited)
RATE_LIMIT_PER_MINUTE=30

# ============================================
# AI Provider (Claude / OpenAI)
# ============================================

# Anthropic Claude API key (recommended)
ANTHROPIC_API_KEY=your_anthropic_api_key

# OR OpenAI API key
OPENAI_API_KEY=your_openai_api_key

# Which AI to use: "claude" or "openai"
AI_PROVIDER=claude

# ============================================
# Teneo Network Endpoints
# ============================================

TENEO_BACKEND_URL=https://backend.developer.chatroom.teneo-protocol.ai
TENEO_WS_URL=wss://backend.developer.chatroom.teneo-protocol.ai

# ============================================
# Job Data Sources (optional)
# ============================================

# Reed.co.uk API (UK jobs)
REED_API_KEY=your_reed_api_key_here

# Adzuna API
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_API_KEY=your_adzuna_api_key

# LinkedIn RapidAPI Scraper
LINKEDIN_RAPIDAPI_KEY=your_linkedin_rapidapi_key

# NoFluffJobs API
NOFLUFFJOBS_API_KEY=your_nofluffjobs_api_key

# JustJoin.it API
JUSTJOIN_API_KEY=your_justjoin_api_key
```

### 3. Get your NFT (first run)

Visit [deploy.teneo-protocol.ai](https://deploy.teneo-protocol.ai), connect your wallet, and mint an Agent NFT. Copy the token ID to `.env`.

### 4. Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build && npm start

# Docker
docker-compose up -d
```

---

## Example Interactions

Once deployed, users interact via the [Teneo Agent Console](https://chatroom.teneo-protocol.ai):

```
/jobs "React developer" Berlin remote
→ Returns 5 current listings with salary, skills, links

/salary "ML engineer" "San Francisco" 5
→ $180k–$260k/yr range with percentile breakdown

/market "blockchain developer"
→ 42 listings, top skills: Solidity (78%), Rust (45%)...

/match "backend developer" London
---
5 years experience with Node.js, TypeScript, PostgreSQL, Docker
Built microservices at Scale Inc, CI/CD, team lead
→ Match scores + missing skills for each listing

/advice how do I transition from web dev to AI engineering?
→ Personalized 6-step roadmap from Claude AI
```

---

## Architecture

```
src/
├── index.ts              # Entry point + agent lifecycle
├── teneo-client.ts       # WebSocket client + auth (SIWE)
├── command-handlers.ts   # Command routing + formatting
├── job-data-service.ts   # Job APIs + salary + CV matching
├── ai-client.ts          # Claude/OpenAI wrapper
└── types.ts              # TypeScript interfaces
```

**Data flow:**

```
User (Agent Console)
  ↓  [task via WebSocket]
TeneoClient → CommandHandlers
  ↓
JobDataService (Adzuna / Reed / Mock)
  ↓
AIClient (Claude / GPT-4)
  ↓  [streamed response]
TeneoClient → User
```

---

## Job Data Sources

The agent works in three modes depending on available API keys:

1. **Full mode**: Adzuna + Reed APIs (real live data)
2. **Partial mode**: One API + mock data
3. **Demo mode**: Realistic mock data (no API keys needed)

Mock data is sufficient for testing all functionality. For production, register at:
- [Adzuna API](https://developer.adzuna.com) — free tier available
- [Reed API](https://www.reed.co.uk/developers/jobseeker) — free tier available

---

## Pricing & x402 Payments

Commands are priced in USDC via the Teneo x402 protocol:

| Command | Price |
|---------|-------|
| `/help` | Free |
| `/jobs`, `/salary`, `/skills` | $0.001 |
| `/market`, `/advice` | $0.002 |
| `/match` | $0.003 |

Users pay per query using a Session Key funded with USDC on the peaq network. No gas fees.

---

## Deployment

### PM2 (recommended for VPS)

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name job-market-agent
pm2 save && pm2 startup
```

### Docker

```bash
docker-compose up -d
docker-compose logs -f
```

---

## Public Deployment

To make your agent publicly visible in the Agent Console:

```
After startup, submit for review at:
deploy.teneo-protocol.ai/my-agents
```

Review takes up to 72 hours. Private agents are usable immediately by direct room link.

---

## License

AGPL-3.0 · See Teneo EULA for agent deployment terms.
