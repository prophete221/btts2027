// ═══════════════════════════════════════════════════════════════
// BTTSPredict — copie presse-papiers fiable (2026-10)
// ═══════════════════════════════════════════════════════════════
// Contrat : la fonction retourne true UNIQUEMENT si la valeur a
// réellement été écrite dans le presse-papiers.
// → Les UI ne doivent afficher « Code copié » que sur `true`.
// → Sur `false`, afficher le code en clair avec une consigne de
//   copie manuelle (aucun faux succès).
export async function copyTextToClipboard(value: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // 1. API Clipboard moderne (HTTPS uniquement)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Permission refusée ou contexte non sécurisé → fallback legacy
  }

  // 2. Fallback legacy — document.execCommand retourne false en cas d'échec.
  //    On vérifie SA valeur de retour au lieu de présumer du succès.
  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
