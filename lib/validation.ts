export function normalizedName(value: string) { return value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' '); }
export function normalizedEmail(value: string) { return value.trim().toLowerCase(); }
export function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function parseIdentity(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('Enter your name and registration email.');
  const { name, email } = input as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 160 || typeof email !== 'string' || !validEmail(normalizedEmail(email))) throw new Error('Enter your full name and a valid email address.');
  return { name: normalizedName(name), email: normalizedEmail(email) };
}
export function csvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"','""') + '"';
}
