import { useEffect, useRef } from 'react';
import type { EraThemeLayer } from '../artists/types';

// Parallax images drawn over an era's top banner. Must be placed inside a
// positioned, `isolate` banner: the layers sit behind the banner's content
// but in front of its background image.
export function EraBannerLayers({ layers }: { layers: EraThemeLayer[] }) {
  const refs = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const move = (x: number, y: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        refs.current.forEach((el, i) => {
          const depth = layers[i]?.depth ?? 0;
          if (el) el.style.translate = `${x * depth}px ${y * depth}px`;
        });
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      move((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    };
    const onLeave = () => move(0, 0);
    window.addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [layers]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none hidden md:block"
      style={{ containerType: 'size' }}
    >
      {layers.map((layer, i) => (
        <img
          key={layer.src}
          ref={el => { refs.current[i] = el; }}
          src={layer.src}
          alt=""
          draggable={false}
          className="absolute max-w-none transition-[translate] duration-700 ease-out"
          style={{
            height: `${layer.height * 100}cqh`,
            width: 'auto',
            right: `${layer.right * 100}cqh`,
            top: `${layer.top * 100}cqh`,
            transform: 'translate(50%, -50%)',
            filter: layer.aura
              ? `drop-shadow(0 0 ${layer.aura.size}px rgb(0 0 0 / ${layer.aura.intensity}))`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}
