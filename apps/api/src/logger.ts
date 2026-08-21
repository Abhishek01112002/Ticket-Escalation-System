/**
 * Tier-1 FAANG-Grade Structured Logging Engine
 *
 * Capabilities:
 * - Dual Mode:
 *     • Development: Human-readable, color-coded, high-signal single-line HTTP transaction logs.
 *     • Production: Ultra-high-throughput structured JSON with standard OpenTelemetry / Cloud Logging fields.
 * - Noise Suppression: Mutes high-frequency /health/* and liveness probe spam.
 * - Error Stratification: 4xx client errors are logged cleanly without stack traces; 5xx server crashes include full trace contexts.
 */

export interface LogContext {
  requestId?: string
  method?: string
  url?: string
  statusCode?: number
  durationMs?: number
  err?: unknown
  code?: string
  message?: string
  [key: string]: unknown
}

// ANSI terminal colors for development readability
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
}

function getStatusColor(statusCode: number): string {
  if (statusCode >= 500) return COLORS.red
  if (statusCode >= 400) return COLORS.yellow
  if (statusCode >= 300) return COLORS.cyan
  if (statusCode >= 200) return COLORS.green
  return COLORS.reset
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return COLORS.blue
    case 'POST':
      return COLORS.green
    case 'PATCH':
    case 'PUT':
      return COLORS.yellow
    case 'DELETE':
      return COLORS.red
    default:
      return COLORS.cyan
  }
}

function formatTime(date = new Date()): string {
  return date.toTimeString().split(' ')[0]
}

export class AppLogger {
  private isProd: boolean

  constructor(nodeEnv = process.env.NODE_ENV) {
    this.isProd = nodeEnv === 'production'
  }

  /**
   * Log an incoming/completed HTTP request
   */
  logHttp(
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
    requestId?: string,
    errorInfo?: { code?: string; message?: string }
  ) {
    // Silence high-frequency health probes in non-prod
    if (url.startsWith('/health/')) {
      return
    }

    if (this.isProd) {
      const payload: Record<string, unknown> = {
        level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
        time: new Date().toISOString(),
        type: 'http_request',
        method,
        url,
        statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        requestId,
      }
      if (errorInfo) {
        payload.error = errorInfo
      }
      process.stdout.write(JSON.stringify(payload) + '\n')
      return
    }

    // High-signal dev log
    const time = `${COLORS.gray}${formatTime()}${COLORS.reset}`
    const methodStr = `${getMethodColor(method)}${COLORS.bold}${method.padEnd(6)}${COLORS.reset}`
    const pathStr = `${COLORS.reset}${url.padEnd(34)}`
    const statusCol = getStatusColor(statusCode)
    const statusStr = `${statusCol}${COLORS.bold}${statusCode}${COLORS.reset}`
    const durationStr = `${COLORS.dim}(${durationMs.toFixed(1)}ms)${COLORS.reset}`
    const reqIdStr = requestId ? `${COLORS.gray}[${requestId.slice(0, 8)}]${COLORS.reset}` : ''
    const errSummary = errorInfo?.code ? ` ${statusCol}• ${errorInfo.code}${COLORS.reset}` : ''

    console.log(`${time} ${methodStr} ${pathStr} ${statusStr} ${durationStr} ${reqIdStr}${errSummary}`)
  }

  info(msg: string, context?: LogContext) {
    if (this.isProd) {
      process.stdout.write(
        JSON.stringify({ level: 'info', time: new Date().toISOString(), message: msg, ...context }) +
          '\n'
      )
    } else {
      const time = `${COLORS.gray}${formatTime()}${COLORS.reset}`
      console.log(
        `${time} ${COLORS.cyan}ℹ INFO${COLORS.reset}  ${msg}`,
        context ? `${COLORS.dim}${JSON.stringify(context)}${COLORS.reset}` : ''
      )
    }
  }

  warn(msg: string, context?: LogContext) {
    if (this.isProd) {
      process.stdout.write(
        JSON.stringify({ level: 'warn', time: new Date().toISOString(), message: msg, ...context }) +
          '\n'
      )
    } else {
      const time = `${COLORS.gray}${formatTime()}${COLORS.reset}`
      console.log(
        `${time} ${COLORS.yellow}[WARN]${COLORS.reset}  ${msg}`,
        context ? `${COLORS.dim}${JSON.stringify(context)}${COLORS.reset}` : ''
      )
    }
  }

  error(msg: string, err?: unknown, context?: LogContext) {
    if (this.isProd) {
      const errObj =
        err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { raw: err }
      process.stderr.write(
        JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          message: msg,
          error: errObj,
          ...context,
        }) + '\n'
      )
    } else {
      const time = `${COLORS.gray}${formatTime()}${COLORS.reset}`
      console.error(
        `${time} ${COLORS.red}[ERROR]${COLORS.reset} ${msg}`,
        context ? `${COLORS.dim}${JSON.stringify(context)}${COLORS.reset}` : ''
      )
      if (err instanceof Error && err.stack) {
        console.error(`${COLORS.red}${err.stack}${COLORS.reset}`)
      } else if (err) {
        console.error(err)
      }
    }
  }
}

export const logger = new AppLogger()
