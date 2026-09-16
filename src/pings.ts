export const PING_TTL_MS = 48 * 60 * 60 * 1000

export function pingExpiresAt(createdAt:string){
  return Date.parse(createdAt) + PING_TTL_MS
}

export function isActivePing(createdAt:string,now=Date.now()){
  return pingExpiresAt(createdAt)>now
}
