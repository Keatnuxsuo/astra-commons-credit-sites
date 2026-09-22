import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { normalizedName, normalizedEmail, validEmail } from './validation';
import { applyRosterPatch } from './roster-patch';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function json(data: unknown, status = 200, headers: Record<string,string> = {}) { return Response.json(data, {status, headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',...headers}}); }
export async function safely(work:()=>Promise<Response>) { try { return await work(); } catch(e) { if(e instanceof HttpError) return json({error:e.message},e.status); console.error('Astra request failed', e instanceof Error ? e.name : 'UnknownError'); return json({error:'We couldn’t connect just now. Please try again, or find Jia.'},503); } }
export function sameOrigin(request: Request) { const origin = request.headers.get('Origin'); if(!origin || origin !== new URL(request.url).origin) throw new HttpError(403,'Please use the form on this site.'); }
export async function body(request: Request) { if(Number(request.headers.get('content-length')||0)>2048) throw new HttpError(413,'This request is too large.'); const s=await request.text(); if(s.length>2048) throw new HttpError(413,'This request is too large.'); try{return JSON.parse(s);}catch{throw new HttpError(400,'Please check the form and try again.');} }
export async function hash(value:string) { const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''); }
export function db() { if(!env.DB) throw new HttpError(503,'Registration is being prepared. Please check back shortly.'); return env.DB; }
export async function ready() {
  const d=db();
  await initialize(d);
  await applyRosterPatch(d,env.EVENT_ROSTER_PATCH);
  return d;
}
async function initialize(d:D1Database) {
  if(await d.prepare("SELECT value FROM settings WHERE key='initialized'").first()) return d;
  const serialized = env.EVENT_SEED_JSON || [env.EVENT_SEED_1,env.EVENT_SEED_2,env.EVENT_SEED_3,env.EVENT_SEED_4].filter(Boolean).join('');
  if(!serialized) throw new HttpError(503,'Registration is being prepared. Please check back shortly.');
  const seed=JSON.parse(serialized) as {guests:{id:string;name:string;email:string}[];rewards:{apiCode:string;codexUrl:string}[]};
  if(seed.guests.length!==seed.rewards.length || seed.guests.length===0) throw new Error('Invalid inventory count');
  const emails=new Set<string>(),api=new Set<string>(),codex=new Set<string>();
  const statements:D1PreparedStatement[]=[];
  seed.guests.forEach((g,i)=>{
    const r=seed.rewards[i], email=normalizedEmail(g.email);
    if(!g.id || !g.name || !validEmail(email)|| emails.has(email)|| !/^[A-Za-z0-9]{16}$/.test(r.apiCode)|| !/^https:\/\/chatgpt\.com\/codex\/p\/[A-Za-z0-9]{16}$/.test(r.codexUrl)||api.has(r.apiCode)||codex.has(r.codexUrl)) throw new Error('Invalid import');
    emails.add(email);api.add(r.apiCode);codex.add(r.codexUrl);
    statements.push(d.prepare('INSERT OR IGNORE INTO reward_pairs(id,api_code,codex_url) VALUES(?,?,?)').bind(i+1,r.apiCode,r.codexUrl));
    statements.push(d.prepare('INSERT OR IGNORE INTO guests(id,name,email,match_name,pair_id) VALUES(?,?,?,?,?)').bind(g.id,g.name,email,normalizedName(g.name),i+1));
  });
  statements.push(d.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('claims_open','false')"));
  statements.push(d.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('initialized','1')"));
  await d.batch(statements); return d;
}
export async function claimsOpen() { return (await db().prepare("SELECT value FROM settings WHERE key='claims_open'").first<{value:string}>())?.value==='true'; }
export async function organizer() { const user=await getChatGPTUser(); if(!user || user.email.trim().toLowerCase()!==(env.ORGANIZER_EMAIL || '').toLowerCase()) throw new HttpError(403,'Organizer access is required.'); return user; }
export type Guest = {id:string;name:string;email:string;pair_id:number};
export async function session(request:Request):Promise<Guest|null> {
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('astra_session='))?.slice(14);
  if(!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db().prepare('SELECT g.id,g.name,g.email,g.pair_id FROM sessions s JOIN guests g ON g.id=s.guest_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token),Date.now()).first<Guest>();
}
export async function newSession(guestId:string,request:Request) {
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  await db().prepare('INSERT INTO sessions(token_hash,guest_id,expires_at) VALUES(?,?,?)').bind(await hash(token),guestId,Date.now()+7*86400000).run();
  return `astra_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
export async function receipt(g:Guest) {
 const r=await db().prepare('SELECT r.api_code,r.codex_url,r.issued_at FROM reward_pairs r JOIN guests current ON current.pair_id=r.id WHERE r.id=? AND current.id=? AND r.issued_at IS NOT NULL').bind(g.pair_id,g.id).first<{api_code:string;codex_url:string;issued_at:string}>();
 return r ? {apiCode:r.api_code,codexUrl:r.codex_url,issuedAt:r.issued_at} : null;
}
export async function rateLimit(request:Request,email:string) {
 const d=db(),minute=Math.floor(Date.now()/60000), ip=request.headers.get('cf-connecting-ip') || 'local';
 const keys=[{key:await hash('email:'+email)+':'+minute,limit:8},{key:await hash('ip:'+ip)+':'+minute,limit:300}];
 const results=await d.batch(keys.map(k=>d.prepare('INSERT INTO attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(k.key,Date.now()+120000)));
 if(results.some((r,i)=>Number((r.results[0] as {count:number}).count)>keys[i].limit)) throw new HttpError(429,'Too many attempts. Please wait a minute and try again.');
 await d.prepare('DELETE FROM attempts WHERE expires_at<?').bind(Date.now()).run();
 await d.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()).run();
}

export async function revokeSession(request:Request) { const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('astra_session='))?.slice(14); if(token && /^[a-f0-9]{64}$/.test(token)) await db().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run(); }
