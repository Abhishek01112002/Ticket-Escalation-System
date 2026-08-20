export class ApiError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly fields?: Record<string, string>) { super(message); }
}
