# Astra Commons Credit Sites

An interactive event credit-redemption site built with React, Three.js, Vinext, Cloudflare Workers and D1. Visitors explore the Astra galaxy, hold the core to ignite it, then enter their registration details to reveal their assigned API and Codex credits.

This is a source-only sharing copy. It contains no attendee CSVs, real credit codes, production database, runtime secrets, or original Site project ID. Its Git history starts with this sanitized snapshot.

## Run locally

Requires Node.js 22.13 or newer (Node 24 recommended) and Python 3 for integration checks.

```sh
npm ci
node scripts/create-demo-env.mjs
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_mushy_medusa.sql
npm run dev
```

Open http://localhost:5173. The generated `.dev.vars` contains 65 fictional guests such as **Test Builder 1 / builder1@example.test** and deliberately fake credit codes. The generator refuses to overwrite an existing environment file. Do not redeem the demo links.

The development server provides a local organizer identity (`seedy@sites.test`). Use `/organizer` to control claims. **Claims start paused**; enable “Open credit claims” to test the full reveal flow. Pausing stops new issuance while allowing retrieval of already-issued pairs.

## Checks

```sh
node --test tests/roster-patch.mjs
npx tsc --noEmit
npm run build
# With the local development server running and synthetic fixtures loaded:
python3 tests/claim-flow.py
```

The integration check verifies name/email matching, access controls, concurrent claims, recovery, CSV-export privacy and rate limiting. It issues two fake pairs and leaves local claims paused.

## Set up another event

- Replace the event name, date, venue and support contact in `app/experience.tsx`, `app/guide/page.tsx` and `app/layout.tsx` as appropriate.
- Supply your own `ORGANIZER_EMAIL` and private inventory through your hosting provider's runtime secrets. `.env.example` lists the supported keys; it contains no live values.
- The initial seed is one JSON object with `guests` (`id`, `name`, `email`) and `rewards` (`apiCode`, `codexUrl`) arrays. The arrays must have equal length; each guest receives the corresponding pair. Names and emails, guest IDs, API codes and Codex URLs must meet the validation in `lib/server.ts`.
- Use `EVENT_SEED_JSON` or split the same JSON string in order across `EVENT_SEED_1` through `EVENT_SEED_4`. Import happens once. Changing seed secrets does not replace existing database records.
- Existing roster changes use the validated, transactional `EVENT_ROSTER_PATCH` mechanism in `lib/roster-patch.ts`. It requires paused claims, preserves issued pairs and archives removed reservations. Review changes against current database state before applying them.
- Walk-ins are handled manually by the organizer; there is no public walk-in allocation form. Record manual handovers separately to avoid distributing the same pair twice.
- The displayed values are US$50 API credit and 2,500 Codex credits (approximately US$100). Adjust these for your own inventory.

Keep registration exports, real codes, seeds and databases out of Git. CSVs, spreadsheets, environment files, local Worker state and common database files are ignored. Do not place private data in `public/` or source files.

## Hosting and authentication

`.openai/hosting.json` declares only the logical `DB` binding. Register a **new** Site for your event and use its own project ID and runtime secrets. Do not connect this copy to the original event's deployment or database.

The organizer login depends on Sites' authenticated gateway and its trusted identity headers. Deploying on generic hosting requires implementing a trusted authentication boundary first; accepting those headers directly from the public internet is not equivalent authentication. Organizer access fails closed when `ORGANIZER_EMAIL` is unset. The local mock identity is development-only.

Drizzle migrations define the database schema. Apply migrations before serving requests. Database inserts and claim issuance use transactional/conditional D1 queries. No attendee data or real credit inventory is included in schema migrations.

## Behavior and privacy

- Registration checks the supplied name and email against the approved list. It does not verify inbox ownership or send email.
- A seven-day HttpOnly, SameSite session cookie permits recovery of the same assigned pair.
- “Issued” means the site revealed a pair; it does not confirm redemption with OpenAI.
- The organizer dashboard exports attendee status without credit codes or redemption links.
- The WebMCP tool `start_constellation_demo` starts the visual interaction only; it never submits registration or issues credits.

## Assets and third-party notices

The project includes supplied OpenAI Sans fonts, Astra artwork and redemption-guide screenshots. These retain their original owners' rights; this repository does not grant additional rights to those assets. Existing third-party notices are preserved in `build/` and `vendor/`.
