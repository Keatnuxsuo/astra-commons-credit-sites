'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, ArrowLeft, Check, Copy, RotateCcw, LoaderCircle, Move, Pause, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Galaxy from './galaxy';
import AstraSpiral from '@/components/astra-spiral';
import Ignition from './ignition';

type Reward = {apiCode:string;codexUrl:string;issuedAt:string};
type State = 'arrival'|'sky'|'rewards';

class ApiError extends Error { constructor(message:string,public status:number){super(message);} }

async function api(path:string,init?:RequestInit){const r=await fetch(path,{...init,headers:{'Content-Type':'application/json',...init?.headers}});const data=await r.json() as {error?:string;open:boolean;name:string;rewards:Reward|null};if(!r.ok)throw new ApiError(data.error||'Something went wrong. Please try again.',r.status);return data;}
export default function Experience(){
 const [stage,setStage]=useState<State>('arrival'),[open,setOpen]=useState<boolean|null>(null),[statusError,setStatusError]=useState(false),[modal,setModal]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[guest,setGuest]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[charge,setCharge]=useState(0),[launching,setLaunching]=useState(false),[ignitionKey,setIgnitionKey]=useState(0),[completed,setCompleted]=useState(false),[matched,setMatched]=useState(false),[rewards,setRewards]=useState<Reward|null>(null),[copied,setCopied]=useState(''),[motion,setMotion]=useState(false),[resetView,setResetView]=useState(0);
 const heading=useRef<HTMLHeadingElement>(null);
 const continueButton=useRef<HTMLButtonElement>(null),confirmation=useRef<HTMLParagraphElement>(null);
 const [sparkContainer,setSparkContainer]=useState<HTMLDivElement|null>(null);
 const claiming=useRef(false);
 const ignite=useCallback(()=>setLaunching(true),[]);
 const refresh=useCallback(async()=>{try{const s=await api('/api/status');setOpen(s.open);setStatusError(false);}catch{setStatusError(true);}},[]);
 useEffect(()=>{void refresh();void api('/api/session').then(s=>{if(s.name){setGuest(s.name);setMatched(true);if(s.rewards){setRewards(s.rewards);setStage('rewards');}}}).catch(()=>{});const timer=setInterval(refresh,30000);const preference=window.matchMedia('(prefers-reduced-motion: reduce)');const syncMotion=()=>setMotion(!preference.matches);syncMotion();preference.addEventListener('change',syncMotion);return()=>{clearInterval(timer);preference.removeEventListener('change',syncMotion);};},[refresh]);
 useEffect(()=>{if(stage!=='arrival'){heading.current?.focus();window.scrollTo({top:0,behavior:'instant'});}},[stage]);
 const explore=useCallback(()=>{setCompleted(false);setCharge(0);setLaunching(false);setIgnitionKey(v=>v+1);setError('');setStage('sky');},[]);
 const openRegistration=useCallback(()=>{setCompleted(true);setCharge(0);setLaunching(false);setError('');setModal(true);},[]);
 useEffect(()=>{
  const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,opts:unknown)=>unknown}}).modelContext;
  if(!context?.registerTool)return;const lifecycle=new AbortController();
  const tool={name:'start_constellation_demo',title:'Explore Astra',description:'Start the visible galaxy interaction. Completing it opens the registration form. This tool does not submit registration or issue credits.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('No inputs are accepted.');explore();await new Promise<void>(r=>requestAnimationFrame(()=>r()));return{stage:'sky',registrationStepFollows:true,creditsIssued:false};}};
  try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  return()=>lifecycle.abort();
 },[explore]);
 useEffect(()=>{if(!launching||stage!=='sky')return;const timer=setTimeout(openRegistration,motion?1250:0);return()=>clearTimeout(timer);},[launching,stage,motion,openRegistration]);
 useEffect(()=>{if(modal&&matched&&!busy)confirmation.current?.focus();},[modal,matched,busy]);
 async function unlock(identity?:{name:string;email:string}){
  if(claiming.current)return;claiming.current=true;setBusy(true);setError('');
  try{
   let issued:Reward|null=null;
   if(identity){const r=await api('/api/check-in',{method:'POST',body:JSON.stringify(identity)});setGuest(r.name);setMatched(true);issued=r.rewards;}
   if(!issued){const r=await api('/api/claim',{method:'POST',body:'{}'});setGuest(r.name);issued=r.rewards;}
   if(!issued)throw new Error('Your credits are not ready yet. Please try again.');
   setRewards(issued);setModal(false);setCharge(0);setStage('rewards');
  }catch(e){
   if(e instanceof ApiError&&e.status===409){setOpen(false);setError('');}
   else{if(e instanceof ApiError&&e.status===401){setMatched(false);setGuest('');}setError((e as Error).message);}
  }finally{setBusy(false);claiming.current=false;}
 }
 function verify(e:FormEvent){e.preventDefault();void unlock({name,email});}
 async function copy(value:string,kind:string){try{await navigator.clipboard.writeText(value);setCopied(kind);setTimeout(()=>setCopied(''),2000);}catch{setError('Copy isn’t available in this browser. Select and copy the code below.');}}
 async function leave(){setBusy(true);try{await api('/api/session',{method:'DELETE'});setStage('arrival');setRewards(null);setCharge(0);setLaunching(false);setIgnitionKey(v=>v+1);setGuest('');setMatched(false);setCompleted(false);setName('');setEmail('');setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className={`universe immersive stage-${stage} ${motion?'motion-on':''} ${launching?'is-launching':''}`}>
  <Galaxy stage={stage} charge={charge} launching={launching} motion={motion&&!modal} resetView={resetView} labelsTarget={sparkContainer}>{completed?<div className="ignition"><button ref={continueButton} className="core-touch core-continue" onClick={openRegistration} aria-label="Continue to registration"><span className="core-complete-mark"><AstraSpiral size={30}/></span></button><span className="core-caption">Continue</span></div>:<Ignition key={ignitionKey} disabled={launching||busy} onCharge={setCharge} onComplete={ignite}/>}</Galaxy>
  <div className="scene-vignette" aria-hidden="true"/><div className="launch-bloom" aria-hidden="true"/>
  <header className="site-header"><a className="wordmark" href="/">Astra Commons<span>PERTH</span></a><nav><a href="/guide">Redemption guide <ArrowUpRight size={15}/></a><button className="motion-control" onClick={()=>setMotion(!motion)} aria-label={motion?'Pause animation':'Enable animation'} aria-pressed={!motion}>{motion?<Pause size={15}/>:<Play size={15}/>}<span>{motion?'Pause':'Play'}</span></button></nav></header>
  {stage==='arrival'&&<section className="arrival-world" aria-label="Astra Commons credit experience">
   <div className="arrival-copy"><p className="eyebrow">PERTH · 19 SEPTEMBER 2026</p><h1>Astra<br/> Commons<span className="title-period">.</span></h1></div>
   <div className="arrival-dock"><div className="dock-intro"><div className="credit-summary"><span><strong>$50</strong> API</span><span><strong>2,500</strong> Codex credits</span></div><span className="dock-currency">USD · Codex credits ≈ US$100</span></div><div className="dock-actions"><button className="pill primary enter-button" onClick={explore}>Explore Astra <AstraSpiral size={18}/></button></div>{statusError&&<div className="availability" role="status">Connection interrupted. <button className="text-link" onClick={refresh}>Retry</button></div>}</div>
   <div className="world-instruction"><Move size={14}/><span>Drag to rotate · Scroll to move closer</span><button className="replay-scene" onClick={()=>setResetView(v=>v+1)} aria-label="Replay Astra formation"><RotateCcw size={15}/></button></div>
  </section>}
  {stage==='sky'&&<section className="game-world">
   <div className="game-top"><button className="text-link" onClick={()=>{setCharge(0);setStage('arrival');}} disabled={launching||busy}><ArrowLeft size={15}/> Back</button><button className="text-link" onClick={()=>{setResetView(v=>v+1);setCompleted(false);setCharge(0);setIgnitionKey(v=>v+1);}} disabled={launching||busy}><RotateCcw size={14}/> Replay</button></div>
   <div className="game-heading"><h1 ref={heading} tabIndex={-1}>{launching||completed?'You woke Astra.':'Wake Astra.'}</h1>{!launching&&!completed&&<p>Drag to explore.</p>}</div>
   <div className="game-space" ref={setSparkContainer}/>
   <div className="ignition-dock"><p className="sr-only" aria-live="polite">{launching?'Astra is awake.':completed?'Registration is ready.':''}</p><button className="text-link" onClick={openRegistration} disabled={launching||busy}>{completed?'Continue to registration':'Skip animation'} <ArrowUpRight size={15}/></button>{error&&<p role="alert" className="error-message">{error}</p>}</div>
  </section>}
  {stage==='rewards'&&rewards&&<section className="reward-section">
   <div className="reward-heading"><AstraSpiral className="reward-spiral" size={36}/><h1 ref={heading} tabIndex={-1}>Your credits.</h1></div>
   <div className="rewards-grid"><article className="reward-card"><h2>OpenAI API</h2><div className="reward-value">$50<span>USD</span></div><label className="code-label">Your API code</label><div className="code-box"><code>{rewards.apiCode}</code><button aria-label="Copy API code" onClick={()=>copy(rewards.apiCode,'api')}>{copied==='api'?<Check size={19}/>:<Copy size={19}/>}</button></div>{<a className="pill primary" href="https://platform.openai.com/settings/organization/billing/promotions" target="_blank" rel="noreferrer">Redeem API credit <ArrowUpRight size={17}/></a>}<a className="card-guide" href="/guide#api">How to redeem API credit <ArrowUpRight size={14}/></a></article>
   <article className="reward-card"><h2>Codex</h2><div className="reward-value">2,500<span>CREDITS</span></div><p>About US$100 to use in Codex. Separate from API credits.</p><div className="codex-instruction">Sign in to your personal ChatGPT / Codex account before opening your link.</div>{<><a className="pill primary" href={rewards.codexUrl} target="_blank" rel="noreferrer">Redeem Codex credits <ArrowUpRight size={17}/></a><button className="copy-link" onClick={()=>copy(rewards.codexUrl,'codex')}>{copied==='codex'?<Check size={14}/>:<Copy size={14}/>} {copied==='codex'?'Link copied':'Copy my redemption link'}</button></>}<a className="card-guide" href="/guide#codex">How to redeem Codex credits <ArrowUpRight size={14}/></a></article></div>
   <div className="receipt-note"><p>Redeem on OpenAI to add these credits to your accounts.</p>{error&&<p role="alert" className="error-message">{error}</p>}<button className="text-link" onClick={leave} disabled={busy}><RotateCcw size={14}/>Done · clear this device</button></div>
  </section>}
  <footer className="site-footer"><a href="https://openai.com/index/gpt-6-astra/" target="_blank" rel="noreferrer">Celebrating GPT-6 Astra <ArrowUpRight size={12}/></a><a href="/organizer">Organizer</a><span>Bloom, Curtin · 10 AM–2 PM</span></footer>
  <Dialog open={modal} onOpenChange={v=>{if(busy)return;setModal(v);setError('');}}><DialogContent className="registration-dialog" showCloseButton={!busy} onCloseAutoFocus={e=>{e.preventDefault();if(stage==='sky')continueButton.current?.focus();else heading.current?.focus();}}>
   <AstraSpiral className="registration-spiral" size={32}/>
   <DialogTitle>{matched?`${guest.split(' ')[0]}, you’re on the list.`:'Find your registration.'}</DialogTitle>
   <DialogDescription className={matched?'sr-only':undefined}>{matched?'Registration matched.':'Use your registered name and email.'}</DialogDescription>
   {matched?<div className="registration-confirmed"><p ref={confirmation} tabIndex={-1} role="status">{open===true?'Credits available.':open===false?'Claims are paused.':'Checking availability…'}</p>{error&&<p className="error-message" role="alert">{error}</p>}<button className="pill primary" disabled={busy||open!==true} onClick={()=>void unlock()}>{busy?<><LoaderCircle className="spin" size={18}/> Revealing…</>:<>Reveal my credits <ArrowUpRight size={18}/></>}</button><button className="text-link quiet" disabled={busy} onClick={()=>{setMatched(false);setError('');}}>Use different registration details</button></div>:
   <form onSubmit={verify} className="registration-form"><label htmlFor="guest-name">Full name</label><input id="guest-name" autoComplete="name" required minLength={2} maxLength={160} disabled={busy} value={name} onChange={e=>setName(e.target.value)} placeholder="Your registered name"/><label htmlFor="guest-email">Email address</label><input id="guest-email" type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>{error&&<p className="error-message" role="alert">{error}</p>}<button className="pill primary" disabled={busy} type="submit">{busy?<><LoaderCircle className="spin" size={18}/> Finding your credits…</>:<>Find my registration <ArrowUpRight size={18}/></>}</button></form>}
   <p className="fine">Used to match your registration and record your claim.</p><p className="walk-in-note">Need help? Find Jia at the event.</p>
  </DialogContent></Dialog>
 </main>;
}
