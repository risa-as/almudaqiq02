#!/usr/bin/env node
/**
 * Generate fresh values for every secret that can be rotated locally.
 *
 * Why: the Jul-2026 desktop installer shipped the real project .env (see
 * AUDIT-2026-10.md, C1), so every secret in it must be treated as public.
 *
 * Prints to the terminal ONLY — nothing is written to disk, so the output can't
 * end up in git or in an installer. Paste the values into:
 *   - Vercel → Project → Settings → Environment Variables (Production), then redeploy
 *   - your local .env (keep it out of git)
 *
 * NOT covered (rotate in their own dashboards): the Neon database password
 * (DATABASE_URL), GEMINI_API_KEY / OPENAI_API_KEY.
 *
 * Usage:  node scripts/generate-secrets.js
 */
const crypto = require('crypto')

const random = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url')

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim()
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim()
// One-line form for env vars: the license route turns literal "\n" back into newlines.
const oneLine = (pem) => pem.replace(/\r?\n/g, '\\n')

const out = [
  '# ── New secrets — generated ' + new Date().toISOString() + ' ──',
  '# JWT_SECRET / REFRESH_TOKEN_SECRET: changing them signs every user out (expected).',
  `JWT_SECRET=${random()}`,
  `REFRESH_TOKEN_SECRET=${random()}`,
  '# BRANCH_TOKEN_SECRET: every desktop must re-activate its branch afterwards.',
  `BRANCH_TOKEN_SECRET=${random()}`,
  '# CRON_SECRET: Vercel sends it automatically to /api/cron/* once set.',
  `CRON_SECRET=${random(32)}`,
  '# LICENSE_PRIVATE_KEY: re-issue offline licenses and ship the PUBLIC key below',
  '# in the offline-desktop app (separate repo) — old licenses stop verifying.',
  `LICENSE_PRIVATE_KEY="${oneLine(privatePem)}"`,
  '',
  '# Matching public key (safe to embed in the offline-desktop app):',
  publicPem,
  '',
  '# Still to rotate by hand: Neon DB password → DATABASE_URL, GEMINI_API_KEY, OPENAI_API_KEY.',
]
console.log(out.join('\n'))
