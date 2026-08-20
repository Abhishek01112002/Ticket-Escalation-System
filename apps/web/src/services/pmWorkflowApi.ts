import { getPmRequest } from './pmRequestApi'
import { getAuthHeaders } from './devAuth'
const headers = (): Record<string,string> => ({ ...getAuthHeaders(), 'Content-Type':'application/json' })
async function mutate(path:string,body:{expectedVersion:number;assigneeUserId?:string}) { const key=crypto.randomUUID(); const response=await fetch(path,{method:'POST',headers:{...headers(),'Idempotency-Key':key},body:JSON.stringify(body)}); if(!response.ok){const data=await response.json().catch(()=>null); const error=new Error(data?.error?.message??'Request failed.') as Error & {status?:number};error.status=response.status;throw error} return (await response.json()).request }
export const assignRequest=(id:string,assigneeUserId:string,expectedVersion:number)=>mutate(`/v1/pm/requests/${encodeURIComponent(id)}/assignments`,{assigneeUserId,expectedVersion})
export const acknowledgeRequest=(id:string,expectedVersion:number)=>mutate(`/v1/requests/${encodeURIComponent(id)}/acknowledge`,{expectedVersion})
export const startWorkRequest=(id:string,expectedVersion:number)=>mutate(`/v1/requests/${encodeURIComponent(id)}/start-work`,{expectedVersion})
export const resolveRequest=(id:string,expectedVersion:number)=>mutate(`/v1/requests/${encodeURIComponent(id)}/resolve`,{expectedVersion})
export async function listTeamMembers(){const response=await fetch('/v1/pm/team-members',{headers:headers()});if(!response.ok)throw new Error('Unable to load internal team members.');return (await response.json()).teamMembers as Array<{id:string;name:string;email:string}>}
export { getPmRequest }
