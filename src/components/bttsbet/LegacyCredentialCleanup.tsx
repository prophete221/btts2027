'use client'

import { useEffect } from 'react'

/** Retire the obsolete plaintext credential store; never inspect its contents. */
export default function LegacyCredentialCleanup() {
  useEffect(() => {
    try {
      localStorage.removeItem('bttsbet_users')
      localStorage.removeItem('bttsbet_user')
    } catch {
      // Storage may be blocked; the application must still render normally.
    }
  }, [])
  return null
}
