import { createElement } from 'react'
import { render, cleanup } from './react-dom-test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import LegacyCredentialCleanup from '../src/components/bttsbet/LegacyCredentialCleanup'

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })

it('removes only obsolete credentials without reading them or altering consent and VIP preferences', () => {
  localStorage.setItem('bttsbet_users', 'synthetic-obsolete-data')
  localStorage.setItem('bttsbet_user', 'synthetic-identity')
  localStorage.setItem('bttsbet_cookie_consent', 'retained')
  localStorage.setItem('bttsbet_vip_unlocked', 'retained')
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const remove = vi.spyOn(Storage.prototype, 'removeItem')
  render(createElement(LegacyCredentialCleanup))
  expect(read).not.toHaveBeenCalled()
  expect(remove.mock.calls).toEqual([['bttsbet_users'], ['bttsbet_user']])
  expect(localStorage.getItem('bttsbet_users')).toBeNull()
  expect(localStorage.getItem('bttsbet_cookie_consent')).toBe('retained')
  expect(localStorage.getItem('bttsbet_vip_unlocked')).toBe('retained')
})

it('does not crash when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
  expect(() => render(createElement(LegacyCredentialCleanup))).not.toThrow()
})
