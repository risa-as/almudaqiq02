/**
 * One-time script: upgrade passwords from SHA-256 to bcrypt.
 * Run BEFORE switching to the new auth system.
 *
 * Usage:
 *   npx ts-node scripts/upgrade-passwords.ts --new-password "newpass123"
 *
 * This sets all users to the same temporary password so they can log in
 * and change their own passwords. For production, generate per-user passwords.
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const args = process.argv.slice(2)
function getArg(name: string, fallback?: string): string {
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  if (fallback !== undefined) return fallback
  throw new Error(`Missing --${name}`)
}

async function main() {
  const newPassword = getArg('new-password', 'change-me-123')
  const prisma = new PrismaClient()

  const hashed = await bcrypt.hash(newPassword, 12)

  const users = await prisma.user.findMany({ select: { id: true, username: true } })
  console.log(`Upgrading ${users.length} user passwords to bcrypt...`)

  for (const u of users) {
    await prisma.user.update({ where: { id: u.id }, data: { password: hashed } })
    console.log(`  ✓ ${u.username}`)
  }

  console.log(`\nDone. All users now use bcrypt-hashed password: "${newPassword}"`)
  console.log('Notify users to change their passwords on first login.')

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
