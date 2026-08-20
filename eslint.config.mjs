import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint (ROADMAP W1-5). `eslint` and `eslint-config-next` were already in
 * `devDependencies` and `npm run lint` already existed — nothing had ever run
 * them, because Next 16 decoupled linting from `next build` entirely and there
 * was no config file for the CLI to find.
 *
 * `eslint-config-next` v16 ships native flat config, so no `FlatCompat` bridge.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      // Vendored design artefacts and the pre-Next static site, not app source.
      'design/**',
      'legacy/**',
      'public/**',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    // `server.js` is the Hostinger/Passenger entry point: plain CommonJS, run
    // by Node directly and never bundled. `require()` is the only thing that
    // works there.
    files: ['server.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // `react-hooks/purity` targets the React Compiler's assumptions about
    // client components re-rendering. These files are SERVER components with
    // `force-dynamic` — they render exactly once per request, and reading the
    // clock is how "is this listing's premium still active right now" is
    // answered. Scoped to the admin pages that actually need it rather than
    // switched off repo-wide, so the rule still guards every client component.
    // The panel moved under the `(panel)` route group in W3-3; the group is
    // not part of any URL but it IS part of the path this glob matches.
    files: ['app/(panel)/admin/**/page.tsx'],
    rules: { 'react-hooks/purity': 'off' },
  },
  {
    rules: {
      // The repo's own conventions, chosen so the first run is actionable
      // rather than a wall of noise everyone learns to ignore.

      // `any` is a real smell here: every DB row, form input and provider
      // result in this repo is typed.
      '@typescript-eslint/no-explicit-any': 'error',

      // An unused import is dead weight. An unused argument is often
      // deliberate — `_prev` in every `useActionState` server-action signature
      // — so leading-underscore names are exempt, as are caught errors that
      // are intentionally swallowed.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];

export default config;
