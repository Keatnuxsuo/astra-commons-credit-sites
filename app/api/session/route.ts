import {ready,json,safely,session,receipt,sameOrigin,revokeSession} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){return safely(async()=>{await ready();const g=await session(request);return json(g?{name:g.name,rewards:await receipt(g)}:{name:null,rewards:null});});}
export async function DELETE(request:Request){return safely(async()=>{sameOrigin(request);await ready();await revokeSession(request);return json({ok:true},200,{'Set-Cookie':'astra_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure'});});}
