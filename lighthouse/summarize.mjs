// Reads lighthouse/reports/<profile>/*.json and prints the median per page/category plus LCP, CLS, TBT.
// Writes lighthouse/SUMMARY.md so the numbers are versioned next to the raw HTML/JSON reports.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = 'lighthouse/reports'
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const rows = []
let meta
for (const profile of ['mobile', 'desktop']) {
  const dir = join(root, profile)
  if (!existsSync(dir)) continue
  const runs = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('manifest')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  const byPage = Object.groupBy(runs, (r) => new URL(r.finalDisplayedUrl ?? r.finalUrl).pathname)
  for (const [page, rs] of Object.entries(byPage)) {
    meta ??= { lighthouse: rs[0].lighthouseVersion, chrome: rs[0].environment?.hostUserAgent, benchmark: rs[0].environment?.benchmarkIndex }
    const cat = (k) => Math.round(median(rs.map((r) => r.categories[k].score)) * 100)
    const num = (k) => median(rs.map((r) => r.audits[k].numericValue))
    rows.push({ profile, page, runs: rs.length, perf: cat('performance'), a11y: cat('accessibility'), bp: cat('best-practices'), seo: cat('seo'), lcp: `${(num('largest-contentful-paint') / 1000).toFixed(2)} s`, cls: num('cumulative-layout-shift').toFixed(3), tbt: `${Math.round(num('total-blocking-time'))} ms` })
  }
}
const header = '| Perfil | Página | Execuções | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
const table = rows.map((r) => `| ${r.profile} | \`${r.page}\` | ${r.runs} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`).join('\n')
const md = `# Lighthouse — medianas\n\nGerado por \`npm run audit:summary\` em ${new Date().toISOString()}.\n\n${header}\n${table}\n\n- Lighthouse ${meta?.lighthouse ?? '?'} · ${meta?.chrome ?? '?'} · benchmarkIndex ${meta?.benchmark ?? '?'}\n- Node ${process.version} · ${process.platform}\n`
writeFileSync('lighthouse/SUMMARY.md', md)
console.log(md)
