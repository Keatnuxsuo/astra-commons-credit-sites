import { writeFileSync } from 'node:fs';

// Synthetic fixtures only. Never redeem these deliberately fake values.
const guests = Array.from({ length: 65 }, (_, i) => ({
  id: `test-${i + 1}`, name: `Test Builder ${i + 1}`, email: `builder${i + 1}@example.test`,
}));
const rewards = guests.map((_, i) => ({
  apiCode: `TEST${String(i + 1).padStart(12, '0')}`,
  codexUrl: `https://chatgpt.com/codex/p/DEMO${String(i + 1).padStart(12, '0')}`,
}));
writeFileSync(new URL('../.dev.vars', import.meta.url),
  `ORGANIZER_EMAIL=seedy@sites.test\nEVENT_SEED_JSON='${JSON.stringify({ guests, rewards })}'\n`,
  { flag: 'wx', mode: 0o600 });
console.log('Created ignored .dev.vars with 65 synthetic attendees and fake credit pairs. Existing files are never overwritten.');
