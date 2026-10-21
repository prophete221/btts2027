import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = fs.readFileSync('.github/workflows/deploy.yml', 'utf8')
const deploy = workflow.split('\n  deploy:')[1]

describe('deployment safety gates', () => {
  it('runs hard-failing tests, Python, lint, typecheck and build before any FTP operation', () => {
    const firstTransfer = deploy.indexOf('lftp -u')
    expect(firstTransfer).toBeGreaterThan(0)
    for (const command of ['run: npm test', "python3 -m unittest discover", 'run: npm run lint', 'run: npx tsc --noEmit', 'run: npm run build']) {
      expect(deploy.indexOf(command)).toBeGreaterThan(0)
      expect(deploy.indexOf(command)).toBeLessThan(firstTransfer)
      const step = deploy.split(/(?=^      - name: )/m).find(part => part.includes(command))
      expect(step).not.toContain('continue-on-error: true')
    }
    expect(deploy).toContain("github.ref == 'refs/heads/main'")
    expect(deploy).toContain("github.event_name != 'pull_request'")
  })
  it('does not replace the existing FTP transport with an unproven TLS path or a blocking preflight', () => {
    expect(deploy).not.toContain('check-ftp-tls.py --require-verified')
    expect([...deploy.matchAll(/lftp -u/g)]).toHaveLength(4)
    expect([...deploy.matchAll(/set ssl:verify no/g)]).toHaveLength(4)
    expect(deploy).not.toContain('set ftp:ssl-force yes')
    expect(deploy).toContain('"ftp://$FTP_SERVER"')
    expect(deploy).toContain('run: node scripts/submit-indexnow.mjs --submit')
  })
  it('keeps the diagnostic workflow read-only without deployment credentials', () => {
    const diagnostic = fs.readFileSync('.github/workflows/ftp-tls-diagnostic.yml', 'utf8')
    expect(diagnostic).toContain('contents: read')
    expect(diagnostic).toContain('secrets.FTP_SERVER')
    expect(diagnostic).not.toMatch(/secrets\.FTP_(?:USERNAME|PASSWORD)/)
    expect(diagnostic).not.toMatch(/lftp|mirror --|git push|secrets\.GEMINI/)
    expect(diagnostic).toContain("github.ref == 'refs/heads/fix/prediction-integrity-match-pages'")
  })
})
