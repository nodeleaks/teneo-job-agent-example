import WebSocket from 'ws'
import { ethers } from 'ethers'
import { EventEmitter } from 'events'
import { TeneoTask, TeneoAgentConfig, AgentResponse } from './types'

const RECONNECT_DELAY_MS = 5000
const PING_INTERVAL_MS = 30000
const MAX_RECONNECT_ATTEMPTS = 10

/**
 * TeneoClient
 *
 * Handles the full Teneo Protocol WebSocket lifecycle:
 *  - Ethereum wallet authentication (SIWE-style)
 *  - Room management (joining agent room)
 *  - Inbound task parsing and routing
 *  - Outbound response streaming
 *  - Auto-reconnect with exponential backoff
 *  - Heartbeat / ping-pong
 */
export class TeneoClient extends EventEmitter {
  private ws: WebSocket | null = null
  private wallet: ethers.Wallet
  private config: TeneoAgentConfig
  private wsUrl: string
  private reconnectAttempts = 0
  private pingTimer: NodeJS.Timer | null = null
  private isConnected = false
  private agentRoomId: string

  constructor(config: TeneoAgentConfig) {
    super()
    this.config = config

    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) throw new Error('PRIVATE_KEY not set in environment')

    this.wallet = new ethers.Wallet(
      privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
    )

    this.wsUrl =
      process.env.TENEO_WS_URL ||
      'wss://backend.developer.chatroom.teneo-protocol.ai'

    // Agent room ID derived from agent name (Teneo convention)
    this.agentRoomId = config.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  // ─────────────────────────────────────────────
  // Connection Management
  // ─────────────────────────────────────────────

  async connect(): Promise<void> {
    console.log(`[TeneoClient] Connecting as "${this.config.name}"...`)
    console.log(`[TeneoClient] Wallet: ${this.wallet.address}`)

    try {
      await this.openWebSocket()
    } catch (err) {
      console.error('[TeneoClient] Initial connection failed:', err)
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // stop auto-reconnect
    if (this.pingTimer) clearInterval(this.pingTimer as NodeJS.Timeout)
    if (this.ws) {
      this.ws.close(1000, 'Agent shutting down')
      this.ws = null
    }
    this.isConnected = false
    console.log('[TeneoClient] Disconnected.')
  }

  private async openWebSocket(): Promise<void> {
    const authToken = await this.signAuthToken()

    const wsUrl = `${this.wsUrl}/ws?token=${encodeURIComponent(authToken)}&agent=true`
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': `JobMarketAgent/${this.config.version}`,
      },
    })

    this.ws.on('open', () => this.onOpen())
    this.ws.on('message', (data) => this.onMessage(data))
    this.ws.on('close', (code, reason) => this.onClose(code, reason.toString()))
    this.ws.on('error', (err) => this.onError(err))
    this.ws.on('pong', () => this.onPong())
  }

  // ─────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────

  private async signAuthToken(): Promise<string> {
    const timestamp = Date.now()
    const nonce = Math.floor(Math.random() * 1000000)

    // Sign-in-with-Ethereum style message
    const message =
      `Teneo Protocol Agent Authentication\n` +
      `Agent: ${this.config.name}\n` +
      `Address: ${this.wallet.address}\n` +
      `Timestamp: ${timestamp}\n` +
      `Nonce: ${nonce}`

    const signature = await this.wallet.signMessage(message)

    const payload = {
      address: this.wallet.address,
      message,
      signature,
      agentName: this.config.name,
      agentVersion: this.config.version,
      nftTokenId: this.config.nftTokenId,
      timestamp,
    }

    return Buffer.from(JSON.stringify(payload)).toString('base64')
  }

  // ─────────────────────────────────────────────
  // WebSocket Event Handlers
  // ─────────────────────────────────────────────

  private onOpen(): void {
    console.log('[TeneoClient] ✅ WebSocket connected')
    this.isConnected = true
    this.reconnectAttempts = 0

    // Join agent room
    this.sendRaw({
      type: 'join_room',
      roomId: this.agentRoomId,
      agentMetadata: this.buildAgentMetadata(),
    })

    // Start heartbeat
    this.startPing()
    this.emit('connected')
  }

  private onMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString())

      switch (message.type) {
        case 'task':
          this.handleIncomingTask(message)
          break
        case 'room_joined':
          console.log(`[TeneoClient] Joined room: ${message.roomId}`)
          this.emit('room_joined', message.roomId)
          break
        case 'ping':
          this.sendRaw({ type: 'pong', timestamp: Date.now() })
          break
        case 'error':
          console.error('[TeneoClient] Server error:', message.message)
          this.emit('server_error', message)
          break
        default:
        // ignore unknown message types
      }
    } catch (err) {
      console.warn('[TeneoClient] Failed to parse message:', err)
    }
  }

  private onClose(code: number, reason: string): void {
    this.isConnected = false
    if (this.pingTimer) clearInterval(this.pingTimer as NodeJS.Timeout)

    console.log(`[TeneoClient] Connection closed: ${code} ${reason}`)
    this.emit('disconnected', { code, reason })

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.scheduleReconnect()
    } else {
      console.error('[TeneoClient] Max reconnect attempts reached. Giving up.')
      this.emit('fatal_error', 'Max reconnect attempts reached')
    }
  }

  private onError(err: Error): void {
    console.error('[TeneoClient] WebSocket error:', err.message)
    this.emit('error', err)
  }

  private onPong(): void {
    // Connection alive confirmation
  }

  // ─────────────────────────────────────────────
  // Task Handling
  // ─────────────────────────────────────────────

  private handleIncomingTask(message: Record<string, unknown>): void {
    const raw = String(message.content || '')
    const task: TeneoTask = {
      id: String(message.taskId || message.id || this.generateId()),
      roomId: String(message.roomId || this.agentRoomId),
      userId: String(message.userId || 'unknown'),
      command: this.parseCommand(raw),
      args: this.parseArgs(raw),
      rawMessage: raw,
      timestamp: Date.now(),
      paymentHeader: message.paymentHeader as string | undefined,
    }

    console.log(`[TeneoClient] 📩 Task ${task.id}: ${task.command}`)
    this.emit('task', task)
  }

  private parseCommand(raw: string): string {
    const trimmed = raw.trim()
    if (trimmed.startsWith('/')) {
      return trimmed.split(/\s+/)[0].toLowerCase()
    }
    // Treat natural language as /advice
    return '/advice'
  }

  private parseArgs(raw: string): string[] {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('/')) return [trimmed]

    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || []
    return parts.slice(1).map((p) => p.replace(/^"|"$/g, ''))
  }

  // ─────────────────────────────────────────────
  // Response Sending
  // ─────────────────────────────────────────────

  sendResponse(response: AgentResponse): void {
    this.sendRaw({
      type: 'task_response',
      taskId: response.taskId,
      content: response.content,
      metadata: response.metadata || {},
    })
  }

  sendStreamChunk(taskId: string, chunk: string, done = false): void {
    this.sendRaw({
      type: done ? 'stream_end' : 'stream_chunk',
      taskId,
      content: chunk,
    })
  }

  private sendRaw(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[TeneoClient] Cannot send — WebSocket not open')
      return
    }
    this.ws.send(JSON.stringify(payload))
  }

  // ─────────────────────────────────────────────
  // Heartbeat
  // ─────────────────────────────────────────────

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
        this.sendRaw({ type: 'heartbeat', timestamp: Date.now() })
      }
    }, PING_INTERVAL_MS)
  }

  // ─────────────────────────────────────────────
  // Reconnection
  // ─────────────────────────────────────────────

  private scheduleReconnect(): void {
    this.reconnectAttempts++
    const delay = RECONNECT_DELAY_MS * Math.pow(1.5, this.reconnectAttempts - 1)
    console.log(
      `[TeneoClient] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    )

    setTimeout(async () => {
      try {
        await this.openWebSocket()
      } catch (err) {
        console.error('[TeneoClient] Reconnect failed:', err)
        this.scheduleReconnect()
      }
    }, delay)
  }

  // ─────────────────────────────────────────────
  // Agent Registration / Metadata
  // ─────────────────────────────────────────────

  private buildAgentMetadata(): Record<string, unknown> {
    return {
      name: this.config.name,
      version: this.config.version,
      description: this.config.description,
      ownerAddress: this.config.ownerAddress,
      nftTokenId: this.config.nftTokenId,
      pricing: {
        pricePerUnit: this.config.pricePerTask,
        currency: 'USDC',
        priceType: 'per_request',
      },
      commands: this.config.commands,
      capabilities: ['job_search', 'salary_data', 'market_analysis', 'cv_matching'],
      category: 'career',
    }
  }

  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  // ─────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────

  get walletAddress(): string {
    return this.wallet.address
  }

  get roomId(): string {
    return this.agentRoomId
  }
}
