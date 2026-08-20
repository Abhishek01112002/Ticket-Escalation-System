export type DevActor = 'pm' | 'internal'
export const DEV_ACTOR_KEY = 'nvara.dev.actor'
export const getDevActor = (): DevActor => (typeof window !== 'undefined' && sessionStorage.getItem(DEV_ACTOR_KEY) === 'internal' ? 'internal' : 'pm')
export const getAuthHeaders = (): Record<string,string> => import.meta.env.DEV ? { 'X-Dev-Auth-Subject': getDevActor() === 'internal' ? 'dev-internal-subject-001' : 'dev-pm-subject-001' } : {}
