// ── Nvara Media — Domain Model ──

export type Role = 'project_manager' | 'team_member'
export type InternalPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ClientUrgency = 'flexible' | 'soon' | 'time_sensitive'
export type WorkflowStatus = 'awaiting_acknowledgement' | 'acknowledged' | 'in_progress' | 'resolved'

export type ServiceDomain =
  | 'digital_marketing'
  | 'social_media_marketing'
  | 'seo'
  | 'influencer_marketing'
  | 'web_app_development'
  | 'branding_graphic_design'
  | 'video_production'
  | 'immersive_media'

export const SERVICE_DOMAIN_LABELS: Record<ServiceDomain, string> = {
  digital_marketing: 'Digital Marketing',
  social_media_marketing: 'Social Media Marketing',
  seo: 'SEO',
  influencer_marketing: 'Influencer Marketing',
  web_app_development: 'Web & App Development',
  branding_graphic_design: 'Branding & Graphic Design',
  video_production: 'Video Production',
  immersive_media: 'Immersive Media',
}

export const SERVICE_DOMAIN_DESCRIPTIONS: Record<ServiceDomain, string> = {
  digital_marketing: 'Google Ads, Meta Ads, lead generation, conversion optimisation',
  social_media_marketing: 'Content strategy, community management, paid social campaigns',
  seo: 'Organic search optimisation and visibility improvement',
  influencer_marketing: 'Influencer partnerships to expand brand reach',
  web_app_development: 'Custom websites, mobile apps, web solutions',
  branding_graphic_design: 'Visual identity, brand assets, graphic design',
  video_production: 'Corporate video, filming, editing, colour grading',
  immersive_media: '2D/3D animation, VFX, AR/VR, game development',
}

export type TimelineEventType =
  | 'request_created'
  | 'assigned'
  | 'reassigned'
  | 'acknowledged'
  | 'work_started'
  | 'resolved'
  | 'sla_breached'
  | 'escalation_triggered'

export interface User {
  id: string
  name: string
  initials: string
  role: Role
  team: string
}

export interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
}

export interface Assignment {
  assignedAt: string
  assignedBy: string
  assignee: User
  acknowledgementDeadline: string
  acknowledgedAt?: string
}

/**
 * The API-owned SLA state. It is kept with the request so operational UI can
 * describe the real server-side state without recalculating or simulating it.
 */
export interface RequestSla {
  deadlineAt: string
  status: string
  acknowledgedAt?: string
  breachedAt?: string
}

/**
 * Escalation model — internal operational escalation record.
 */
export interface Escalation {
  triggeredAt: string
  reason: string
  responsiblePerson: User
}

export interface TimelineEvent {
  id: string
  at: string
  type: TimelineEventType
  title: string
  detail: string
  actor: string
}

export interface Request {
  id: string
  version?: number
  serviceDomain: ServiceDomain
  subject: string
  description: string
  clientUrgency: ClientUrgency
  /** Internal priority — set by PM, not exposed to client */
  internalPriority: InternalPriority
  client: Client
  createdAt: string
  workflowStatus: WorkflowStatus
  assignment: Assignment
  sla?: RequestSla
  escalation?: Escalation
  timeline: TimelineEvent[]
}

export interface CreateRequestInput {
  clientName: string
  company: string
  email: string
  phone: string
  serviceDomain: ServiceDomain
  subject: string
  description: string
  clientUrgency: ClientUrgency
}

export const ACKNOWLEDGEMENT_SLA_HOURS = 24

// ── Internal Comments Thread ───────────────────────────────────────────────────

/** Author metadata for a comment — both PM and Specialist can author. */
export interface CommentAuthor {
  id: string
  name: string
  role: 'project_manager' | 'internal_team_member'
  initials: string
}

/**
 * Internal activity note on a ticket — visible only to PM and the assigned
 * Specialist. Never exposed through the public tracker or client portal.
 */
export interface RequestComment {
  id: string
  body: string
  createdAt: string
  updatedAt: string
  author: CommentAuthor
}

// ── Team Member Capacity ───────────────────────────────────────────────────────

/**
 * Extended team member with real-time active assignment count for workload
 * capacity balancing in the reassign dropdown.
 */
export interface TeamMemberCapacity {
  id: string
  name: string
  email: string
  /** Number of currently active (non-ended) ticket assignments. */
  activeAssignmentsCount: number
}

// ── Advanced Filter State ─────────────────────────────────────────────────────

export interface RequestFilters {
  /** 'me' resolves to the current authenticated user on the server */
  assigneeId: string | null
  domain:     ServiceDomain | null
  urgency:    ClientUrgency | null
  /** 'healthy' | 'near_breach' | 'breached' */
  slaStatus:  string | null
  dateFrom:   string | null
  dateTo:     string | null
}

export const DEFAULT_FILTERS: RequestFilters = {
  assigneeId: null,
  domain:     null,
  urgency:    null,
  slaStatus:  null,
  dateFrom:   null,
  dateTo:     null,
}
