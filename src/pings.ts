export const PING_TTL_MS = 48 * 60 * 60 * 1000

export function pingExpiresAt(createdAt:string,durationHours:24|48|null=48){
  if(!Number.isFinite(Date.parse(createdAt)))return NaN
  return durationHours===null?Infinity:Date.parse(createdAt) + durationHours * 60 * 60 * 1000
}

export function isActivePing(createdAt:string,now=Date.now(),durationHours:24|48|null=48){
  return pingExpiresAt(createdAt,durationHours)>now
}
