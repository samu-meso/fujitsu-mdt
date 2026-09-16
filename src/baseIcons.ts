import type {EmergencyBase} from './emergencyBases'

const paths:Record<EmergencyBase['category'],string>={
  fire:'M12 3c1 5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-4 3-6 0 3 2 3 2 3s2-3 0-7Z',
  'red-cross':'M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z',
  'green-cross':'M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z',
  hospital:'M5 21V5h14v16M3 21h18M10 21v-5h4v5M12 7v5M9.5 9.5h5',
  hq:'M4 21V9l8-6 8 6v12M2 21h20M9 21v-7h6v7M9 9h6',
}

export function baseIconSvg(category:EmergencyBase['category']){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[category]}"/></svg>`
}
