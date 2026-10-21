import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as newsSources from '../scripts/team-context-sources.mjs'

describe('retired ESPN RSS on an affiliate-supported site', () => {
  it('has no RSS parser, URL export, or RSS network endpoint in the context collector', () => {
    expect(newsSources).not.toHaveProperty('ESPN_RSS_URL')
    expect(newsSources).not.toHaveProperty('ESPN_TERMS_URL')
    expect(newsSources).not.toHaveProperty('parseEspnRss')
    for (const file of ['scripts/team-context-sources.mjs', 'scripts/update-team-context.mjs']) {
      const code = readFileSync(file, 'utf8')
      expect(code).not.toMatch(/https?:\/\/(?:www\.)?espn\.com\/espn\/(?:rss|news\/story\?page=rssinfo)/i)
      expect(code).not.toMatch(/parseEspnRss|teamEspn|espnFetchedAt/)
    }
  })
  it('does not distribute old global or team RSS articles in the checked-in context data', () => {
    const data = JSON.parse(readFileSync('public/team-context.json', 'utf8'))
    expect(data.globalNews ?? []).toEqual([])
    expect(data).not.toHaveProperty('espnFetchedAt')
    for (const team of Object.values(data.teams) as Array<{ news?: unknown[]; gdeltNews?: unknown[] }>) {
      for (const item of [...(team.news ?? []), ...(team.gdeltNews ?? [])]) {
        expect(newsSources.isPermittedNewsItem(item)).toBe(true)
      }
    }
  })
})
