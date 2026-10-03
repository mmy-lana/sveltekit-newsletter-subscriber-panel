# Newsletter Distribution & Subscriber Panel

An editorial-first publication and subscriber management system built with **SvelteKit 3**,
**Svelte 5 runes**, **Tailwind CSS v4** and strict TypeScript. The public site reads like a
minimalist newsletter; the panel behind it is a dense monochrome workspace for managing
subscribers, authoring issues, and running asynchronous dispatch campaigns.

## Features

- **Public archive & article reader** — serif editorial typesetting, sanitised markdown
  rendering, subscribe flow with double opt-in semantics.
- **Subscriber directory** — search, status/tier/tag filters, sortable columns, pagination,
  row and bulk actions, CSV import with a per-row error report.
- **Issue authoring** — markdown editor with a live preview, audience targeting, scheduling.
- **Dispatch engine** — bounded batching, pause/resume, abortable cancellation, and delivery
  statistics reconciled from the job log.
- **Offline-first persistence** — a versioned LocalStorage adapter with shape validation,
  canonical seeding, and convergence for payloads written by older builds.
- **Mobile-first** — verified at 360, 390, 430, 768, 1024 and 1440 px with no horizontal
  overflow and 44px touch targets below the `sm` breakpoint.

## Getting started

```bash
pnpm install          # dependencies
pnpm run dev          # development server on http://localhost:5173
pnpm run build        # production build (adapter-node)
pnpm start            # serve the production build
```

## Verification

Every change is verified automatically; the suite never touches an interactive browser — it
launches a disposable, headless Chromium with its own throwaway profile.

```bash
pnpm run verify         # everything below, in order
pnpm run check          # svelte-check (0 errors, 0 warnings)
pnpm run build          # production build
pnpm run verify:logic   # deterministic domain + rune-store suite (Node)
pnpm run verify:logic:chrome   # the same suite executed inside headless Chrome
pnpm run verify:components    # SSR render assertions for all 39 primitives/components
pnpm run verify:components:chrome  # token, touch-target and layout measurements in Chrome
pnpm run verify:e2e      # full operator journeys against the built app
```

Artifacts (screenshots, generated gallery and suite bundles) land in `verify-artifacts/`,
which is git-ignored.

## Architecture

| Layer | Location | Responsibility |
| :--- | :--- | :--- |
| Types | `src/lib/types` | Serializable domain and presentation contracts |
| Utils | `src/lib/utils` | Pure validators, CSV, markdown, metrics, formatting |
| Storage | `src/lib/storage` | Versioned LocalStorage adapter and seed fixtures |
| State | `src/lib/state` | Svelte 5 rune stores and the dispatch engine |
| UI | `src/lib/components/ui` | Accessible primitives (button, modal, inputs, toasts) |
| Panel | `src/lib/components/panel` | Admin domain components |
| Editorial | `src/lib/components/editorial` | Public reader components |
| Routes | `src/routes` | Screens: archive, article, dashboard, directory, issues, editor |

### Notes on the toolchain

- `#lib` is the SvelteKit 3 package-import alias (declared in `package.json`); configuration
  lives on the `sveltekit()` Vite plugin because `svelte.config.js` is no longer read.
- Stores are seeded with the bundled fixtures so the server render and the first client render
  match; `hydrate()` merges persisted data after mount, avoiding hydration mismatches.
- `issueStore.updateIssue` always re-derives `contentHtml` from `contentMarkdown`, so stored
  HTML can never drift from its source or carry markup injected by an older build.