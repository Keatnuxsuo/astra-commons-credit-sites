import {ready,claimsOpen,json,safely} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(){return safely(async()=>{await ready();return json({open:await claimsOpen()});});}
