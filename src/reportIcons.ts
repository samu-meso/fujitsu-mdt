export function reportIconSvg(emergency:boolean){
  const shape=emergency
    ?'<path d="m10.3 4.2-7.6 13A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.8l-7.6-13a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none"/>'
    :'<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13M12 14v7"/>'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`
}
