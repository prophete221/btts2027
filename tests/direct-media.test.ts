import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { normalizeTeamContext } from '../src/lib/team-context'

const document = JSON.parse(readFileSync('public/team-context.json', 'utf8'))
const curated = JSON.parse(readFileSync('scripts/curated-team-media.json', 'utf8'))

describe('individually reviewed stadium photograph', () => {
  it('preserves Commons provenance, commercial licence, author and actual photo date', () => {
    const image = normalizeTeamContext(document).teams['Ipswich Town'].image
    expect(image).toMatchObject({
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Portman_Road_aerial.jpg',
      author: 'John Fielding', license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
      date: '2015-07-19', kind: 'stadium',
    })
    expect(image?.caption).toContain('sans recadrage')
    expect(curated['Ipswich Town'].sourceUrl).toBe(image?.sourceUrl)
    expect(curated['Ipswich Town'].photoDate).toBe(image?.date)
    expect(curated['Ipswich Town'].stadium).toBe('Portman Road')
    expect(existsSync(`public${image?.url}`)).toBe(true)
    const bytes = readFileSync(`public${image?.url}`)
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
  })
})
