'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { JourneyStage } from './galaxy-model';
import type { GalaxyController } from './galaxy-engine';

type Props = { stage: JourneyStage; charge: number; launching: boolean; motion: boolean; resetView: number; labelsTarget: HTMLDivElement | null; children: ReactNode };
export default function Galaxy(props: Props) {
  const host = useRef<HTMLDivElement>(null), core = useRef<HTMLDivElement>(null);
  const engine = useRef<GalaxyController | null>(null), latest = useRef(props); latest.current = props;
  const [renderState, setRenderState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  useEffect(() => {
    const mount = host.current; if (!mount) return;
    let cancelled = false;
    void import('./galaxy-engine').then(async ({ createGalaxy }) => {
      if (cancelled) return;
      const controller = await createGalaxy(mount, () => core.current, () => latest.current,
        () => { if (!cancelled) setRenderState('fallback'); });
      if (cancelled) { controller.dispose(); return; }
      engine.current = controller; setRenderState('ready'); controller.update();
    }).catch(() => { if (!cancelled) setRenderState('fallback'); });
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null; };
  }, []);
  useEffect(() => { engine.current?.update(); }, [props.stage, props.charge, props.launching, props.motion, props.resetView, props.labelsTarget]);
  return <div className={`galaxy-viewport scene-${renderState}`} data-scene-state={renderState}>
    <div className="galaxy-fallback" aria-hidden="true"/>
    <div className="galaxy-canvas" ref={host}/>
    {props.stage === 'sky' && props.labelsTarget && createPortal(<div className="core-layer"><div className="core-anchor" ref={core}>{props.children}</div></div>, props.labelsTarget)}
    {renderState === 'fallback' && <span className="scene-fallback-note">Still sky · your credits are still available</span>}
  </div>;
}
