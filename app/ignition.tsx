'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

type Props = { disabled: boolean; onCharge: (value: number) => void; onComplete: () => void };

/** The reward interaction works independently of WebGL and never claims on pointer-down. */
export default function Ignition({ disabled, onCharge, onComplete }: Props) {
  const [holding, setHolding] = useState(false);
  const [charge, setCharge] = useState(0);
  const value = useRef(0), completed = useRef(false), keyboard = useRef(false);
  const callbacks = useRef({ onCharge, onComplete }); callbacks.current = { onCharge, onComplete };
  useEffect(() => {
    if (disabled || completed.current) return;
    if (!holding && value.current === 0) return;
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - previous, 50); previous = now;
      value.current = Math.max(0, Math.min(1, value.current + dt * (holding ? 1 / 2600 : -1 / 1500)));
      setCharge(value.current); callbacks.current.onCharge(value.current);
      if (value.current >= 1) { completed.current = true; setHolding(false); callbacks.current.onComplete(); }
      else if (holding || value.current > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [holding, disabled]);
  useEffect(() => {
    const release = () => { if (document.hidden) { keyboard.current = false; setHolding(false); } };
    document.addEventListener('visibilitychange', release);
    return () => document.removeEventListener('visibilitychange', release);
  }, []);
  return <div className={`ignition ${holding ? 'is-holding' : ''} ${disabled ? 'is-launching' : ''}`} style={{ '--charge': charge } as CSSProperties}>
    <button className="core-touch" disabled={disabled} aria-label="Ignite Astra. Hold Space, or press Enter to start or stop." aria-describedby="core-help"
      onPointerDown={e => { if (e.button !== 0 || disabled) return; keyboard.current = false; e.currentTarget.setPointerCapture(e.pointerId); setHolding(true); }}
      onPointerUp={() => setHolding(false)} onPointerCancel={() => setHolding(false)} onLostPointerCapture={() => { if (!keyboard.current) setHolding(false); }}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (e.repeat) return; keyboard.current = true; setHolding(current => e.key === 'Enter' ? !current : true); } }}
      onKeyUp={e => { if (e.key === ' ') { e.preventDefault(); keyboard.current = false; setHolding(false); } }}
      onBlur={() => { keyboard.current = false; setHolding(false); }}
      onClick={e => { if (e.detail === 0) { keyboard.current = true; setHolding(current => !current); } }}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="core-track" cx="50" cy="50" r="45"/><circle className="core-progress" cx="50" cy="50" r="45" pathLength="1" strokeDasharray="1" strokeDashoffset={1-charge}/></svg>
      <span className="core-cross" aria-hidden="true"/>
    </button>
    <span className="core-caption" aria-hidden="true">{disabled ? 'Here we go.' : holding ? 'Keep holding…' : charge > .02 ? 'Hold to continue' : 'Hold to ignite'}</span>
    <span id="core-help" className="sr-only">Hold the glowing core for three seconds. Releasing lets the stars settle. Keyboard: hold Space, or press Enter once to start and again to stop. You can also skip the animation below.</span>
  </div>;
}
