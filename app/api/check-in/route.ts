import {ready,json,safely,sameOrigin,body,rateLimit,newSession,receipt,HttpError, type Guest} from '@/lib/server';
import {parseIdentity} from '@/lib/validation';
export async function POST(request:Request){return safely(async()=>{
 sameOrigin(request);const d=await ready();let identity;try{identity=parseIdentity(await body(request));}catch{throw new HttpError(400,'Enter your full name and a valid email address.');}
 await rateLimit(request,identity.email);
 const guest=await d.prepare('SELECT id,name,email,pair_id FROM guests WHERE email=? AND match_name=?').bind(identity.email,identity.name).first<Guest>();
 if(!guest) throw new HttpError(404,'We couldn’t match those details. Use the full name and email on your registration, or find Jia for a hand.');
 return json({name:guest.name,rewards:await receipt(guest)},200,{'Set-Cookie':await newSession(guest.id,request)});
});}
