/**
 * Creates the FIRST administrator account. Run once, from a local machine.
 *
 *   export DATABASE_URL="mysql://user:pass@host:3306/db"   # tsx does NOT load .env
 *   npx tsx scripts/bootstrap-admin.ts --email vos@negocio.com.py --name "Tu Nombre"
 *
 * Three properties, each deliberate:
 *
 *  1. NO DEFAULT PASSWORD. It generates a random one and prints it exactly once.
 *     A constant in a repository is a credential in a repository, and it is on
 *     the internet within a week of the first deploy.
 *  2. The account is created with `must_change_password = true`, so that
 *     credential is worth exactly one sign-in.
 *  3. It REFUSES TO RUN if an active admin already exists. Otherwise it is a
 *     shell backdoor for minting admins that bypasses the panel's own audit log.
 *     Further accounts are created from /admin/usuarios, where they are logged.
 *
 * SESSION_SECRET is not needed here — this script never issues a session.
 */
import { createDb, createPool, databaseUrl } from '../lib/db/connection';
import { users, activityLog } from '../lib/db/schema';
import { generatePassword, hashPassword } from '../lib/auth/password';

interface Args {
  email: string;
  name: string;
}

function parseArgs(argv: string[]): Args {
  let email = '';
  let name = '';
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!value) throw new Error(`Missing value for ${flag}`);
    if (flag === '--email') email = value.trim().toLowerCase();
    else if (flag === '--name') name = value.trim();
    else throw new Error(`Unknown argument: ${flag}. Usage: bootstrap-admin.ts --email <email> --name <name>`);
  }
  if (!email || !name) {
    throw new Error('Usage: bootstrap-admin.ts --email <email> --name "<name>"');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Not a valid email: ${email}`);
  return { email, name };
}

async function main(): Promise<void> {
  const { email, name } = parseArgs(process.argv.slice(2));

  const pool = createPool(databaseUrl());
  const db = createDb(pool);

  try {
    const existing = await db.select({ id: users.id, email: users.email, role: users.role, status: users.status }).from(users);

    const activeAdmin = existing.find((u) => u.role === 'admin' && u.status === 'active');
    if (activeAdmin) {
      console.error(
        `Refusing to run: an active administrator already exists (${activeAdmin.email}).\n` +
          'Create further accounts from /admin/usuarios, where every change is written to the activity log.',
      );
      process.exitCode = 1;
      return;
    }

    if (existing.some((u) => u.email === email)) {
      console.error(`Refusing to run: an account with ${email} already exists.`);
      process.exitCode = 1;
      return;
    }

    const password = generatePassword();
    const passwordHash = await hashPassword(password);

    const id = await db.transaction(async (tx) => {
      const [res] = await tx.insert(users).values({
        email,
        name,
        passwordHash,
        role: 'admin',
        status: 'active',
        mustChangePassword: true,
      });
      await tx.insert(activityLog).values({
        // No actor: this account is its own origin.
        userId: null,
        entityType: 'user',
        entityId: String(res.insertId),
        action: 'create',
        beforeJson: null,
        afterJson: { email, name, role: 'admin', status: 'active', via: 'bootstrap-admin' },
      });
      return res.insertId;
    });

    console.log('');
    console.log('  Administrator created.');
    console.log(`    id:       ${id}`);
    console.log(`    email:    ${email}`);
    console.log(`    password: ${password}`);
    console.log('');
    console.log('  This password is shown ONCE and is not stored anywhere in plaintext.');
    console.log('  Sign in at /ingresar — you will be asked to change it immediately.');
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
