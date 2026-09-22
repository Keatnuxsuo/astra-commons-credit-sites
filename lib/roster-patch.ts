import { normalizedEmail, normalizedName, validEmail } from './validation';

type Registration = { id: string; name: string; email: string; pairId: number };
type RosterPatch = { revision: string; expectedGuestCount: number; removed: Registration[]; added: Registration[] };

function parsePatch(serialized: string): RosterPatch {
  const patch = JSON.parse(serialized) as RosterPatch;
  if (!patch || !/^[a-zA-Z0-9-]{1,80}$/.test(patch.revision) || !Number.isInteger(patch.expectedGuestCount) || patch.expectedGuestCount < 1 || !Array.isArray(patch.removed) || !Array.isArray(patch.added)) throw new Error('Invalid roster patch');
  for (const group of [patch.removed, patch.added]) {
    if (group.length > 100 || new Set(group.map(g => g.id)).size !== group.length || new Set(group.map(g => g.email)).size !== group.length || new Set(group.map(g => g.pairId)).size !== group.length) throw new Error('Duplicate roster identities');
    for (const g of group) {
      if (typeof g.id !== 'string' || !g.id || g.id.length > 100 || typeof g.name !== 'string' || g.name.trim().length < 2 || g.name.length > 160 || typeof g.email !== 'string' || g.email !== normalizedEmail(g.email) || !validEmail(g.email) || !Number.isInteger(g.pairId) || g.pairId < 1) throw new Error('Invalid roster identity');
    }
  }
  if (patch.removed.length > patch.expectedGuestCount || patch.added.some(g => patch.removed.some(r => r.id === g.id))) throw new Error('Conflicting roster changes');
  return patch;
}

/** Owner-supplied private data patch. Issued pairs can never be released by it. */
export async function applyRosterPatch(d: D1Database, serialized?: string) {
  if (!serialized) return;
  const patch = parsePatch(serialized), marker = `roster_patch:${patch.revision}`;
  if (await d.prepare('SELECT value FROM settings WHERE key=?').bind(marker).first()) return;
  const guardKey = 'roster_patch_guard';
  const removed = JSON.stringify(patch.removed), added = JSON.stringify(patch.added);
  // Check inside the same transaction as the changes. A NULL guard violates the
  // existing NOT NULL constraint and rolls everything back if the live state drifted.
  const guard = d.prepare(`INSERT INTO settings(key,value) VALUES (?, CASE
    WHEN EXISTS(SELECT 1 FROM settings WHERE key=?) THEN 'skip'
    WHEN EXISTS(SELECT 1 FROM settings WHERE key='claims_open' AND value='false')
      AND (SELECT COUNT(*) FROM guests)=?
      AND (SELECT COUNT(*) FROM json_each(?) j JOIN guests g
        ON g.id=json_extract(j.value,'$.id') AND g.name=json_extract(j.value,'$.name')
        AND g.email=json_extract(j.value,'$.email') AND g.pair_id=json_extract(j.value,'$.pairId')
        JOIN reward_pairs r ON r.id=g.pair_id WHERE r.issued_at IS NULL)=?
      AND NOT EXISTS(SELECT 1 FROM json_each(?) j JOIN guests g
        ON g.id=json_extract(j.value,'$.id') OR g.email=json_extract(j.value,'$.email'))
      AND (SELECT COUNT(*) FROM json_each(?) j JOIN reward_pairs r ON r.id=json_extract(j.value,'$.pairId')
        WHERE r.issued_at IS NULL AND NOT EXISTS(SELECT 1 FROM guests g WHERE g.pair_id=r.id
          AND g.id NOT IN(SELECT json_extract(value,'$.id') FROM json_each(?))))=?
    THEN 'apply' ELSE NULL END) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .bind(guardKey, marker, patch.expectedGuestCount, removed, patch.removed.length, added, added, removed, patch.added.length);
  const applying = "EXISTS(SELECT 1 FROM settings WHERE key='roster_patch_guard' AND value='apply')";
  const statements = [guard,
    d.prepare(`DELETE FROM sessions WHERE guest_id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND ${applying}`).bind(removed),
    d.prepare(`DELETE FROM guests WHERE id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND ${applying}`).bind(removed),
    ...patch.added.map(g => d.prepare(`INSERT INTO guests(id,name,email,match_name,pair_id) SELECT ?,?,?,?,? WHERE ${applying}`).bind(g.id, g.name, g.email, normalizedName(g.name), g.pairId)),
    // Keep the cancelled identities and their old reservations in a private audit
    // record, without copying credit codes or publishing attendee data in source.
    d.prepare(`INSERT INTO settings(key,value) SELECT ?,? WHERE ${applying}`).bind(marker, JSON.stringify({ ...patch, appliedAt: new Date().toISOString() })),
    d.prepare('DELETE FROM settings WHERE key=?').bind(guardKey),
  ];
  await d.batch(statements);
}
