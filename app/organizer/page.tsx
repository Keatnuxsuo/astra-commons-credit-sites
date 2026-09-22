import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { env } from 'cloudflare:workers';
import OrganizerPanel from './panel';
export const dynamic='force-dynamic';
export default async function Organizer(){const user=await requireChatGPTUser('/organizer');if(user.email.toLowerCase()!==(env.ORGANIZER_EMAIL||'').toLowerCase())return <main className="access-message"><h1>Organizer access only.</h1><p>This account doesn’t have access to attendee records.</p><a className="pill" href="/signout-with-chatgpt?return_to=/organizer">Use a different account</a><a className="text-link" href="/">Back to the Commons</a></main>;return <OrganizerPanel/>;}
