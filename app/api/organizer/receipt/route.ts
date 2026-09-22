import {organizer,ready,json,safely,receipt,HttpError,type Guest} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){return safely(async()=>{await organizer();const d=await ready();const id=new URL(request.url).searchParams.get('id')||'';const g=await d.prepare('SELECT id,name,email,pair_id FROM guests WHERE id=?').bind(id).first<Guest>();if(!g)throw new HttpError(404,'Guest not found.');return json({name:g.name,rewards:await receipt(g)});});}
