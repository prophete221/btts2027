import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const authContextPath = resolve(process.cwd(), 'src/contexts/AuthContext.jsx')
const source = readFileSync(authContextPath, 'utf8')

describe('legacy AuthContext security guard', () => {
  it('does not read or write legacy browser auth values', () => {
    expect(source).not.toMatch(/localStorage\.(?:getItem|setItem)\s*\(/)
    expect(source).not.toMatch(/window\.localStorage\.(?:getItem|setItem)\s*\(/)
    expect(source).toContain("window.localStorage.removeItem('bttsbet_users')")
    expect(source).toContain("window.localStorage.removeItem('bttsbet_user')")
    expect(source).not.toContain("removeItem('cookie")
    expect(source).not.toContain("removeItem('lang")
  })

  it('uses deployment Firebase configuration without demo or local-auth fallback', () => {
    expect(source).toContain('const firebaseConfigured = Boolean(')
    expect(source).not.toMatch(/AIzaSyDemoKeyReplaceMeWithYourOwn|bttsbet-demo\.firebaseapp\.com|local_\s*\+/)
    expect(source).toMatch(/signInWithEmailAndPassword\(auth, email, password\)/)
    expect(source).toMatch(/createUserWithEmailAndPassword\(auth, email, password\)/)
    expect(source).toContain('Aucun compte local ne sera utilisé.')
  })

  it('preserves the public auth context methods', () => {
    for (const method of [
      'login',
      'register',
      'logout',
      'resetPassword',
      'loginWithGoogle',
      'updateUserData',
    ]) {
      expect(source).toMatch(new RegExp(`\\b${method}\\b`))
    }
    expect(source).toContain('isLoggedIn: !!user')
    expect(source).toContain('isVip: userProfile?.isVip === true')
  })
})
