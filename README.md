# Newsletter Distribution & Subscriber Panel

An editorial-first publication and audience management workspace built with SvelteKit, Svelte 5 runes, Tailwind CSS v4, and strict TypeScript. The public interface offers a minimalist reading experience, backed by an administrative studio for subscriber directory management, newsletter authoring, and simulated batch distribution campaigns.

- Live Application: https://sveltekit-newsletter-subscriber-pan-lake.vercel.app
- Repository: https://github.com/mmy-lana/sveltekit-newsletter-subscriber-panel

---

## Features

### Editorial Public Reader
- Serif-driven typography optimized for long-form reading.
- XSS-hardened markdown renderer supporting headings, blockquotes, lists, code, and protocol-sanitized links.
- Public dispatch archive with reading-time estimations, issue numbers, and bylines.
- Integrated newsletter subscription card with email normalization and double opt-in status.

### Subscriber Directory & Management
- Search, filter, and sort subscribers across status (`active`, `pending`, `unsubscribed`, `bounced`), membership tiers (`free`, `paid`, `founding`), and tags.
- Dual-mode responsive layout: dense tabular view on desktop and touch-friendly card list on mobile.
- RFC 4180-compliant CSV importer with column alias detection, UTF-8 BOM stripping, and row-level error reporting.
- CSV export protected against spreadsheet formula injection (CWE-1236).
- Protected bulk operations: status updates guard against accidental reactivation of hard bounces, and bulk deletions require explicit confirmation.

### Newsletter Authoring Studio
- Split-screen authoring environment with a live rendered preview pane.
- Metadata configuration including target audience segmentation, tags, cover image URL validation, and UTC schedule inputs.
- Unsaved changes indicator with a browser `beforeunload` guard to prevent data loss.
- Modal-guarded deletion workflows ensuring accidental clicks cannot delete content.

### Distribution Queue Engine
- Client-side asynchronous batch delivery simulation with configurable pacing.
- Real-time progress bar reflecting delivered, opened, clicked, and bounced statuses.
- Operator controls allowing in-flight runs to pause, resume, or halt safely at batch boundaries.
- Reconciled engagement telemetry accurately separating Click-Through Rate (CTR: clicks / delivered) from Click-to-Open Rate (CTOR: clicks / opens).

### Storage & Resilience
- Offline-first persistence via a versioned, schema-validating LocalStorage adapter.
- Deterministic canonical seed fixtures ensuring server-side rendering matches initial client hydration.
- Explicit persistence error handling surfacing quota exhaustion or private browsing storage blocks via toast alerts.

---

## Architecture & Tech Stack

- Framework: SvelteKit 3
- Component Model: Svelte 5 Runes (`$state`, `$derived`, `$props`, `$bindable`, `$effect`)
- Styling: Tailwind CSS v4 (`@theme` variables, zero-hover dependency for mobile)
- Language: TypeScript (strict mode)
- Deployment Target: `@sveltejs/adapter-vercel`
- Testing & Verification: Puppeteer Core (headless Chromium runner)

### Directory Overview

```text
src/
  lib/
    components/
      editorial/     # Public reader components (Header, Byline, ArchiveCard, etc.)
      panel/         # Admin features (SubscriberTable, IssueEditor, DeliveryQueue, etc.)
      ui/            # Reusable primitives (Button, Modal, ConfirmDialog, Input, etc.)
    state/           # Svelte 5 rune stores (subscriber, issue, queue, settings, toast)
    storage/         # LocalStorage adapter, schema validators, and seed fixtures
    types/           # Domain and UI TypeScript interfaces
    utils/           # Pure helpers (CSV, markdown, formatters, metrics, scroll-lock)
  routes/
    admin/           # Dashboard overview, subscriber directory, and issue management
    p/[slug]/        # Individual public article reader
    +layout.svelte   # Root shell, design tokens, hydration hooks, and toast container
    +page.svelte     # Public newsletter home and archive
scripts/
  verify/            # Multi-tier verification harness (Node SSR, logic, Chrome, E2E)
```

---

## Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- pnpm 9+ or 10+

### Installation

```bash
git clone https://github.com/mmy-lana/sveltekit-newsletter-subscriber-panel.git
cd sveltekit-newsletter-subscriber-panel
pnpm install
```

### Local Development

Start the development server:

```bash
pnpm run dev
```

Open `http://localhost:5173` to view the public site or `http://localhost:5173/admin` to access the publisher studio.

### Production Build

Compile the application for production:

```bash
pnpm run build
pnpm run preview
```

---

## Verification & Quality Assurance

The codebase includes an automated test matrix executed in Node and isolated headless Chromium instances:

```bash
pnpm run check                  # TypeScript and Svelte template type checking
pnpm run build                  # Production build compilation
pnpm run verify:logic           # Pure domain logic and rune store unit tests (Node)
pnpm run verify:logic:chrome    # Pure domain logic verification executed in Chrome
pnpm run verify:components      # SSR component markup and accessibility contract tests
pnpm run verify:components:chrome # Design token and 44px touch-target measurement in Chrome
pnpm run verify:e2e             # End-to-end multi-viewport operator scenarios in Chrome
pnpm run verify                 # Executes all checks and test suites sequentially
```

---

## License

This project is licensed under the MIT License.
