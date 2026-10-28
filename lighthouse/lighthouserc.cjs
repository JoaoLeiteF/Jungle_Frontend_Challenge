// LHCI config, versioned. Run with: npm run audit:lighthouse (builds, serves dist via `vite preview`,
// audits Início and Detalhe 3× per profile). PROFILE=mobile|desktop selects the form factor.
const profile = process.env.PROFILE === 'desktop' ? 'desktop' : 'mobile'

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local',
      url: ['http://localhost:4173/', 'http://localhost:4173/nft/emerald-ape-042'],
      numberOfRuns: 3,
      settings: {
        ...(profile === 'desktop' ? { preset: 'desktop' } : {}), // mobile = Lighthouse default (Moto G Power, slow 4G, 4× CPU)
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        // the audit runs the delivered build: mocks, images, fonts and realtime all enabled
        chromeFlags: '--headless=new --no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['warn', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:seo': ['warn', { minScore: 0.9, aggregationMethod: 'median-run' }],
      },
    },
    upload: { target: 'filesystem', outputDir: `lighthouse/reports/${profile}`, reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%.report.%%EXTENSION%%' },
  },
}
