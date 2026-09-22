import {ready,json,safely,sameOrigin,session,receipt,HttpError} from '@/lib/server';
export async function POST(request:Request){return safely(async()=>{
 sameOrigin(request);const d=await ready();const g=await session(request);if(!g)throw new HttpError(401,'Please find your registration again.');
 // One reserved pair per guest. A single conditional update makes repeated and concurrent claims idempotent.
 await d.prepare("UPDATE reward_pairs SET issued_at=? WHERE id=? AND issued_at IS NULL AND EXISTS(SELECT 1 FROM guests WHERE id=? AND pair_id=reward_pairs.id) AND EXISTS(SELECT 1 FROM settings WHERE key='claims_open' AND value='true')").bind(new Date().toISOString(),g.pair_id,g.id).run();
 const rewards=await receipt(g);if(!rewards)throw new HttpError(409,'Claims are paused for now. Your credits are reserved; please wait for Jia to open them.');
 return json({name:g.name,rewards});
});}
