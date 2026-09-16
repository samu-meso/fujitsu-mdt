export function displayName(user:{alias?:string|null;username?:string}|null|undefined){return user?.alias?.trim()||user?.username||'Utente'}
