import * as React from "react"

const MOBILE_BREAKPOINT = 768
const REQUETE = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function abonner(rappel: () => void) {
  const mql = window.matchMedia(REQUETE)
  mql.addEventListener("change", rappel)
  return () => mql.removeEventListener("change", rappel)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    abonner,
    () => window.matchMedia(REQUETE).matches,
    () => false
  )
}
