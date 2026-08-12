# PR-3 assessment + look-ahead scoping

Planning document. No code changes. Written against `origin/main` @ `23c611e`.

---

## 0. The task premise is out of date — PR-3 is already merged

The brief says "There is currently NO authentication, NO user accounts, NO roles,
NO activity_log, and NO /admin panel." That is not true of the current `main`.

```
23c611e  Merge pull request #10 (claude/phase-c-auth-admin-plan-43amfu)   <- origin/main
dcc98d6  PR-3: auth foundation, users, activity log, first-party /admin
ae86663  PR-2: cutover to MySQL, delete WordPress/JetEngine, persist leads (#9)
```

Already on `main`: `lib/auth/{session,roles,password,login}.ts`,
`lib/db/{users,activity-log}.ts`, `lib/admin/{validation,labels}.ts`,
`components/admin/{AdminTable,AdminForm,AdminNav}.tsx`, `/ingresar`,
`/cambiar-contrasena`, `/admin`, `/admin/usuarios` CRUD,
`drizzle/0001_opposite_morbius.sql` (`users`, `activity_log`),
`scripts/bootstrap-admin.ts`, and 11 test files.

**What is genuinely still open is the deployment, not the code.** ROADMAP lines
143–149 are unchecked, and all three are manual:

1. `npm run db:migrate` from a local machine (applies `drizzle/0001_*`)
2. `SESSION_SECRET` in the Hostinger env panel + redeploy
3. `npm run bootstrap-admin -- --email … --name "…"`

Until those run, `/admin` 404s in production — the layout calls `notFound()` when
`dbConfigured()` is false, and the app throws at boot without `SESSION_SECRET`.
So the panel is very likely **written but not live**. That needs confirming
before anything else is planned on top of it.

Because of this, Part 1 below is delivered as an **audit of what shipped against
what I would have specced**, not as a proposal to build it again. Part 2 —
the look-ahead — is unaffected and is the part that is genuinely undecided.

---

## Part 1 — PR-3 audit

For each question in the brief: what I would recommend, what shipped, verdict.

### 1.1 Auth mechanism

**Recommendation:** `iron-session` (sealed stateless cookie) + `scrypt` from
`node:crypto`.

Reasoning for this stack specifically:

- **Auth.js / NextAuth is the wrong shape here.** It brings an adapter, four more
  tables, a provider config surface, and a major-version upgrade treadmill — all
  to serve a login form for two people who work for the same company. Its value
  is OAuth providers and account linking. Neither is wanted.
- **No Neon/Vercel shortcuts apply.** There is no edge runtime, no Vercel KV, no
  `@vercel/postgres`. Hostinger runs one long-lived Node process behind
  Passenger. A sealed cookie needs no session store, which means no extra table
  and nothing to garbage-collect.
- **scrypt over bcrypt** because `bcrypt` is a native addon compiled against the
  Node ABI at install time. On Hostinger's *managed* Node, the platform decides
  when the runtime moves. When it does, every login 500s until someone SSHs in
  and rebuilds — and the person running this business is not a developer.
  `node:crypto` scrypt is standard library and cannot break that way.

**Shipped:** exactly this. `iron-session` over `next/headers`, scrypt with
self-describing `scrypt$N$r$p$salt$key` hashes, N=2¹⁷/r=8/p=1, `maxmem` raised
explicitly (Node's 32 MB default is below the ~134 MB that N=2¹⁷ needs, and it
degrades silently rather than erroring).

**Verdict: correct. Do not revisit.**

### 1.2 Session strategy

**Recommendation:** sealed cookie carrying the minimum (id, role, scope id,
must-change flag), 8-hour TTL, `httpOnly` + `sameSite: lax` + `secure` in
production, everything else re-read from the database per request.

**Shipped:** all of the above — see `lib/auth/session.ts`.

**Verdict: correct, with one real defect.** See §1.6.

### 1.3 Roles

**Recommendation:** `admin` + `editor` is enough. Nothing on this site justifies
more granularity today:

- There is one business, one customer, and a staff of approximately one.
- The only privilege boundary that has a real-world meaning right now is "can
  create accounts and see the audit trail" vs. "can edit content."
- Per-entity or per-field permissions would be configuration nobody will ever
  change, guarding a distinction nobody has asked for.

The one thing worth doing beyond that is **reserving the owner role values in the
MySQL enum now**, because widening an enum later is an `ALTER` against a live
table, whereas the values cost nothing to carry.

**Shipped:** `USER_ROLES = ['admin','editor','owner_admin','owner_editor']` in the
enum; `SATISFIES` in `lib/auth/roles.ts` is an explicit satisfaction map (not a
numeric ladder) that grants the owner roles nothing staff-facing;
`ASSIGNABLE_ROLES` in `lib/db/users.ts` and `STAFF_ROLES` in the form both refuse
to assign them, and the refusal is asserted twice — form and query module.

**Verdict: correct, and this is exactly the cheap insurance Part 2 asks about.**
See §2.1.

### 1.4 What `activity_log` should capture at minimum

**Recommendation** — the minimum that makes it worth having:

| Field | Why |
|---|---|
| actor id | who; `SET NULL` on user delete, so the record outlives the actor |
| entity type + entity id | what |
| action | create / update / delete / archive |
| before + after snapshots | the actual change, not just that one happened |
| timestamp | when |

Plus two rules: written **inside the same transaction** as the mutation (so a
mutation cannot ship unlogged), and **never containing a credential**.

**Shipped:** exactly that shape. Two details worth calling out as good calls:

- `entity_id` is `VARCHAR(64)`, not `INT` — a deliberate deviation from the
  educacion reference. Correct and necessary here: `listings.id` is a varchar and
  `categories`/`cities` are keyed on their slug, so an int column literally could
  not log the site's three main entities.
- `auditView()` in `lib/db/users.ts` strips `passwordHash` before anything reaches
  a snapshot, and password changes log `{}`/`{}` — the *fact* is the record.

There is already a read surface: `recentActivity()` renders the last 10 entries on
the `/admin` dashboard, admin-only.

**Verdict: correct.** One gap for PR-4: there is no full, paginated, filterable
activity view — only the dashboard's last 10. That is fine at current volume and
becomes worth building once listings CRUD starts generating traffic.

### 1.5 Smallest usable /admin CRUD surface

**Recommendation:** listings, categories, cities, and a **read-only** leads list.
That is the whole surface needed to stop touching the database by hand.

**Shipped in PR-3:** only `/admin/usuarios`, plus the dashboard. This was a
deliberate scope choice, and it was the right one — `bootstrap-admin` refuses to
run twice, so without a users screen the only way to create an editor is
hand-written SQL, and that account creation would fall outside the audit log.
Pulling users CRUD forward is also what forced `AdminTable`/`AdminForm`/
`validation.ts` into existence, which is what makes PR-4 "a field list and a
column list per entity" instead of a build.

**Verdict: correct sequencing.** The remaining CRUD is PR-4 and is genuinely
mechanical now.

### 1.6 The one defect I found

**`users.status` is never re-read after login, so suspension and demotion do not
take effect until the cookie expires (up to 8 hours).**

Both `README.md` and the PR-3 commit message state that suspending an account
"takes effect on the next request." As shipped, that is true for name and email
(which are not in the cookie) but **not** for `status` or `role`:

- `app/admin/layout.tsx` calls `requireRole(await currentUser(), ['editor'])` —
  `currentUser()` reads the sealed cookie and nothing else.
- `lib/db/users.ts` guards every function on the same cookie-derived
  `SessionUser`.
- `users.status` is only ever read on the login path (`lib/auth/login.ts:95`).

Consequences, in order of seriousness:

1. **Demoting an admin to editor leaves them with admin powers for up to 8 hours**
   — including `/admin/usuarios`, i.e. the ability to promote themselves back.
2. Suspending a compromised or departing account does not lock them out. The only
   working "revoke now" today is rotating `SESSION_SECRET`, which signs out
   everyone.

**Fix (small, belongs in PR-4):** re-read `{role, status}` from the database once
per request in the `/admin` layout and in `requireRole`'s callers — or, cheaper
and sufficient: have the layout call an existing-by-id lookup and `notFound()` on
`status === 'suspended'` or on a role that no longer satisfies `editor`. That is
one extra indexed primary-key read per admin request, on a panel with two users.
Then either make the docs match, or make the code match the docs — right now they
disagree, and the docs are the optimistic one.

### 1.7 Playbook items that do NOT fit this site — say so explicitly

The `wp-to-native-admin` playbook is written from educacion.com.py, which is a
larger build (twelve admin sections, a scraped-registry import stream, dated price
facts). These parts should **not** be copied here:

| Playbook item | Verdict for negocio | Why |
|---|---|---|
| `owner_members` join table | **Skip** | It exists so several staff of one institution can share an account set. A Paraguayan small business has one owner and one WhatsApp. A nullable `owner_user_id` on `listings` covers it; a join table is a second write path guarding nothing. |
| `scopeToOwner()` / `assertSameOwner()` in PR-3 | **Correctly skipped** | There is nothing to scope against until `listings` gains an owner column. Shipping them now would be dead code no test could meaningfully guard. |
| Price supersession / dated-fact history | **Does not apply** | negocio has no published dated facts. `premiumUntil` is a commercial state, not a claim about the world; it is overwritten, not superseded. |
| Moderation queue | **Defer — it has no source** | On educacion the queue's input was a registry importer running repeatedly. Here the seed importer is one-shot and finished. There is nothing to moderate until a claim-this-listing or owner-edit flow creates a submission stream. Building the queue first builds an empty inbox. See §2.2. |
| Bulk verify | **Premature** | ~24 listings. Bulk actions solve a problem that starts around a few hundred rows. |
| Staleness dashboard | **Trim, keep in PR-5** | The one genuinely dated thing here is `premiumUntil`. "Which premium listings expire in the next 30 days" is worth a panel section; a general per-entity freshness framework is not. |
| Freshness rule enforced across page/comparison/JSON-LD/OG | **Does not apply** | No comparison view, no dated claims to go stale. |
| Twelve admin sections | **Five** | listings, categorías, ciudades, leads (read-only), usuarios. |

What the playbook gets right for *any* scale, and which this build followed — keep
all of it: `requireRole` first statement inside the query module; hidden buttons
are UX not access control; 404 not 403; `force-dynamic` on every admin route; no
SQL outside `lib/db/`; log inside the transaction; pure validation; server
components by default; never fabricate a value for a NOT NULL column; the canary
test check.

---

## Part 2 — look-ahead scoping

### 2.1 Does PR-3's role design need to anticipate the owner portal? — Already done, no further work needed

The question is whether an "owner" role must be stubbed in now to avoid costly
rework. **It already is, and it was the right amount.** Specifically:

- The expensive change was widening the MySQL `role` enum against a live table.
  That cost is already paid — `owner_admin` and `owner_editor` are in
  `USER_ROLES` as of `drizzle/0001`.
- The cheap-to-add parts (`scopeToOwner`, `owner_user_id`, the portal routes)
  were correctly *not* built, because they are code, and code that nothing calls
  cannot be tested or trusted.
- The satisfaction map means an owner account created later cannot reach `/admin`
  even before the portal exists. A numeric ladder would have made
  `owner_admin >= editor` true and handed an owner a staff screen. This is the
  single decision that would have been genuinely expensive to unwind, and it was
  taken correctly.

**Conclusion: safe to defer the owner portal entirely. No PR-3 rework is
warranted, and none should be done "just in case."**

### 2.2 Schema decisions that get expensive once real data and real admins exist

Ranked by how expensive they get, and what I recommend doing about each.

**(a) Listing ownership: one column or a join table — decide the shape, don't
build it.**
Recommendation: when the owner portal lands, add a single nullable
`owner_user_id INT` on `listings` with an index, and no `owner_members` table.
Additive nullable columns are cheap at any size. What is *not* cheap is starting
with a join table and later collapsing it, or vice versa. Writing the intent down
now (this document) is the whole deliverable; the migration waits for PR-6.

**(b) Publication status on `listings` — the one to watch.**
There is no `status` column today; every row in `listings` is live. The moment
either an owner portal or a claim flow exists, an owner edit becomes instantly
public with no review step, and un-publishing is impossible. Adding
`status enum('draft','published') NOT NULL DEFAULT 'published'` is an `ALTER` plus
a backfill — trivial against ~24 rows, slow and risky against thousands.
**Recommendation: still defer it** (an unused column that no test can guard is its
own liability), but treat it as a tripwire: *add it in the same PR as whichever
comes first of the owner portal, a claim flow, or the listings table passing a few
hundred rows.* The trigger is row count and write-path count, not calendar time.

**(c) Leads contain real customer personal data and no policy governs them yet.**
`leads` stores name, phone, email and free-text message for every enquiry, with no
retention limit and, today, no read surface. Two decisions are owed **before**
PR-4 builds `/admin/leads`:
1. **Who may read leads — `admin` only, or `editor` too?** Recommend **admin-only
   at first.** Widening a permission later is a one-line change; narrowing it after
   someone has been using the screen is a conversation.
2. **How long are leads kept?** Even a simple "delete rows older than 24 months"
   answer is better than the current implicit "forever." Worth deciding before the
   table is large enough that the answer has consequences.

**(d) `activity_log.entity_id` as VARCHAR(64).** Already correct for this schema.
Flagging it only so nobody "fixes" it to INT later — that change would silently
make listings, categorías and ciudades unloggable.

**(e) `leads.listing_id` is deliberately not a foreign key.** Correct — a lead is
history and must outlive the listing it came from. Do not add the constraint.

### 2.3 Risks and opportunities worth knowing before committing to a direction

**Highest-value action available right now: create a second admin account.**
`bootstrap-admin` refuses to run when an active admin exists, and password reset
by email does not exist. So today the site is one forgotten password away from
needing hand-written SQL against the production database to regain admin access —
which, for a non-developer, means needing a developer. Once the panel is live,
create a second admin from `/admin/usuarios` and store both credentials in a
password manager. Five minutes; removes the single worst operational risk in the
system.

**Is a simpler stopgap (Basic Auth on `/admin`) worth it?**
No — the question is moot now. It would have been a reasonable answer *before*
PR-3, and the general principle is sound (don't build RBAC to guard a panel that
doesn't exist yet). But full RBAC is already written, tested and merged. Adding
Basic Auth on top would add a second credential to lose and would not remove a
single line of the code it was meant to avoid. Skip it.

**Auth complexity vs. maintenance burden — this is a good trade as built.**
The chosen stack has no external service, no recurring bill, no vendor outage to
inherit, no OAuth app registrations to renew, and no adapter that breaks on a
major upgrade. `iron-session` and `node:crypto` are roughly as low-maintenance as
authentication gets. The ongoing obligations are exactly two: keep
`SESSION_SECRET` safe (rotating it signs everyone out — which is also the
emergency "revoke all sessions" button, worth knowing), and apply migrations from
a local machine before merging the PR that needs them.

**Security posture of a write-capable panel on a live site — already good.**
In place: 404-not-403 for the unauthorised, one identical login error for every
failure mode, decoy hash on the unknown-email path, suspension checked after the
password, per-IP login rate limit (8 per 15 min), `force-dynamic` everywhere,
`noindex` on the panel, no credential in the audit log, no default password
anywhere. That is a stronger baseline than most small business panels ship with.

Remaining gaps, in priority order:
1. **The revocation defect in §1.6** — the only one I would call a bug.
2. **Login rate limiting is per-IP and in-memory.** It resets on every redeploy and
   does not slow an attacker rotating IPs against one known email. Adding a
   per-email counter alongside the per-IP one is cheap insurance if a staff email
   address is ever published.
3. **scrypt at N=2¹⁷ costs ~134 MB per hash.** The rate limit caps the blast
   radius, but on a small Hostinger container this is worth remembering if the
   build or runtime ever starts hitting memory limits (ROADMAP Phase C already
   tracks the OOM watch).
4. **No 2FA.** Correct call at this scale. Revisit if the panel ever gains
   accounts outside the immediate team.

**The opportunity worth naming:** `leads` is already persisting to MySQL, and the
admin shell already exists. That means ROADMAP Phase D item 1 — the monthly
"this month you got 47 WhatsApp clicks and 12 enquiries" report per business — is
now mostly a query and a page, not a project. It is described in the roadmap as
the churn-killer, and PR-4's read-only leads list gets most of the way there
almost as a side effect.

---

## Recommended next steps

1. **Confirm production state.** Have the three unchecked ROADMAP USER steps
   (migrate → `SESSION_SECRET` → bootstrap) actually been run? Everything else
   depends on the answer.
2. **Create a second admin account** as soon as the panel is live (§2.3).
3. **PR-3.1 (small):** fix the revocation defect in §1.6, and reconcile the README
   claim with the code.
4. **Decide the two leads questions in §2.3(c)** — who can read them, how long
   they are kept — *before* PR-4 builds the screen.
5. **PR-4 as already scoped:** listings, categorías, ciudades, read-only leads.
   Field list + column list + query module per entity, copying the `usuarios`
   slice exactly.
6. **Record the deferrals from §2.2 in ROADMAP** so the tripwires (publication
   status, ownership shape) are not rediscovered from scratch later.
