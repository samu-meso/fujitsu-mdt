const normalize=value=>value?.trim().replace(/\/$/,'')

export function isAllowedOrigin(origin){
  const configured=(process.env.APP_ORIGIN||'').split(',').map(normalize).filter(Boolean)
  const vercelHosts=[process.env.VERCEL_PROJECT_PRODUCTION_URL,process.env.VERCEL_URL]
    .map(value=>value?normalize(`https://${value}`):'').filter(Boolean)
  const allowed=new Set([...configured,...vercelHosts])
  return allowed.size===0||allowed.has(normalize(origin))
}
