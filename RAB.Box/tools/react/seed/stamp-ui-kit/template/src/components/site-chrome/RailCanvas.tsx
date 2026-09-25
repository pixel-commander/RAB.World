import { useEffect, useRef } from 'react';


export interface RailTube {
  color: string;
  top: number;
  height: number;
}

export interface RailLed {
  color: string;
  top: number;
  can_blink?: boolean;
}

export interface RailCorner {
  at?: "start" | "end";
  color: string;
  length?: number;
}

export interface RailCanvasProps {
  side?: 'left' | 'right' | 'top' | 'bottom';
  corner?: RailCorner;
  tubes?: RailTube[];
  leds?: RailLed[];
  joints?: number[];
  can_animate?: boolean;
  className?: string;
}

const round = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

export const RailCanvas = (props: RailCanvasProps) => {
  const {
    side = 'left',
    corner,
    tubes = [],
    leds = [],
    joints = [],
    can_animate = true,
    className,
  } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const parts = useRef({ tubes, leds, joints, corner, can_animate });
  parts.current = { tubes, leds, joints, corner, can_animate };

  useEffect(() => {
    const node = canvas.current;
    if (!node) return undefined;
    const ctx = node.getContext("2d");
    if (!ctx) return undefined;

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const known: { [key: string]: string } = {};
    const inkOf = (word: string) => {
      const said = String(word || "").trim();
      const token = said.startsWith("var(") ? said.slice(4, -1).trim() : said;
      if (!token.startsWith("--")) return said;
      if (!known[token]) known[token] = getComputedStyle(node).getPropertyValue(token).trim() || "255,255,255";
      return known[token];
    };
    let width = 0;
    let height = 0;
    let frame = 0;
    let born = 0;

    const forget = () => { Object.keys(known).forEach((key) => { delete known[key]; }); };
    window.addEventListener('rab-theme', forget);
    window.addEventListener('storage', forget);

    const size = () => {
      const box = node.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const horizontal = side === 'top' || side === 'bottom';
      width = horizontal ? box.height : box.width;
      height = horizontal ? box.width : box.height;
      node.width = Math.max(1, Math.round(box.width * ratio));
      node.height = Math.max(1, Math.round(box.height * ratio));
      if (side === 'top') ctx.setTransform(0, ratio, ratio, 0, 0, 0);
      else if (side === 'bottom') ctx.setTransform(0, -ratio, ratio, 0, 0, box.height * ratio);
      else ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const paint = (now: number) => {
      if (!born) born = now;
      const beat = (now - born) / 1000;
      const { tubes: rows, leds: lamps, joints: knuckles, corner: bend, can_animate: alive } = parts.current;
      const breathing = alive !== false && !still;

      ctx.clearRect(0, 0, width, height);
      if (width < 4 || height < 4) {
        frame = window.requestAnimationFrame(paint);
        return;
      }
      const horizontal = side === 'top' || side === 'bottom';
      const material = getComputedStyle(node);
      const tone = (key: string) => material.getPropertyValue(key).trim();
      const dark = tone('--surface-inset');
      const face = tone('--surface-hover');
      const rim = tone('--border-strong');
      const muted = tone('--content-muted');
      const primary = inkOf('var(--color-primary-rgb)');
      const secondary = inkOf('var(--color-secondary-rgb)');
      const plate = (x: number, y: number, w: number, h: number, radius = 3) => {
        const skin = ctx.createLinearGradient(x, 0, x + w, 0);
        skin.addColorStop(0, rim);
        skin.addColorStop(0.12, face);
        skin.addColorStop(0.7, tone('--surface-main'));
        skin.addColorStop(1, dark);
        ctx.fillStyle = skin;
        round(ctx, x, y, w, h, radius); ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 0.5; ctx.stroke();
      };
      const recess = (y: number, length: number) => {
        ctx.fillStyle = dark;
        round(ctx, 3, y, width - 6, length, 4); ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        round(ctx, 4, y + 1, width - 8, length - 2, 3); ctx.fill();
      };
      const screw = (y: number) => {
        const x = width / 2;
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rim; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.fillStyle = muted;
        ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 1.4, y + 0.7); ctx.lineTo(x + 1.4, y - 0.7); ctx.stroke();
      };
      const vents = (start: number, length: number) => {
        recess(start, length);
        for (let y = start + 5; y < start + length - 3; y += 6) {
          ctx.fillStyle = face;
          round(ctx, 5, y, width - 10, 2.6, 1); ctx.fill();
          ctx.fillStyle = rim; ctx.fillRect(6, y, width - 12, 0.5);
        }
      };
      // One molded body, interrupted by deliberate service bays.
      plate(0.5, 0.5, width - 1, height - 1, 5);
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 0.5;
      for (let y = 4; y < height; y += 3) {
        ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(width - 2, y); ctx.stroke();
      }
      screw(9); screw(height - 9);
      // Short luminous inlays seat the existing neon corners in the housing.
      if (bend?.color) {
        const length = Math.min(height * (bend.length || 0.1), 56);
        const start = bend.at === 'end' ? height - length - 20 : 20;
        ctx.fillStyle = dark;
        round(ctx, width * 0.4 - 1, start - 2, width * 0.2 + 2, length + 4, 2); ctx.fill();
        ctx.save(); ctx.shadowColor = `rgb(${inkOf(bend.color)})`; ctx.shadowBlur = 5;
        ctx.fillStyle = `rgba(${inkOf(bend.color)},.8)`;
        round(ctx, width * 0.4, start, width * 0.2, length, 1); ctx.fill(); ctx.restore();
      }
      if (side === 'bottom') {
        vents(height * 0.12, height * 0.2);
        // Two flush keycaps, with a visible pocket, beveled lip and grip groove.
        [0.74, 0.84].forEach((at, index) => {
          const y = height * at, length = Math.min(42, height * 0.065);
          recess(y - 2, length + 4);
          const ink = index ? primary : secondary;
          const key = ctx.createLinearGradient(4, 0, width - 4, 0);
          key.addColorStop(0, `rgba(${ink},.9)`);
          key.addColorStop(0.35, `rgba(${ink},.55)`);
          key.addColorStop(1, `rgba(${ink},.2)`);
          ctx.fillStyle = key;
          round(ctx, 5, y, width - 10, length, 3); ctx.fill();
          ctx.strokeStyle = `rgba(${ink},.9)`; ctx.lineWidth = 0.6; ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,.5)';
          ctx.fillRect(width * 0.43, y + length * 0.25, 1, length * 0.5);
        });
        if (height > 380) {
          ctx.save(); ctx.translate(width * 0.7, height * 0.41); ctx.rotate(Math.PI / 2);
          ctx.fillStyle = muted; ctx.font = '7px ui-monospace, monospace';
          ctx.fillText('R R A A B B I I T T  /  LAB—01', 0, 0);
          ctx.restore();
        }
      } else if (horizontal) {
        vents(height * 0.66, height * 0.13);
        [0.33, 0.56].forEach(at => {
          ctx.fillStyle = dark; ctx.fillRect(1, height * at, width - 2, 1.5);
          ctx.fillStyle = rim; ctx.fillRect(2, height * at + 1.5, width - 4, 0.5);
        });
      } else {
        // Insulated wires in recessed channels; connectors and clips explain the route.
        rows.forEach((tube, index) => {
          if (!Number.isFinite(tube.top) || !Number.isFinite(tube.height) || tube.height <= 0) return;
          const start = height * tube.top, length = height * tube.height;
          if (length < 16) return;
          recess(start, length);
          for (let wire = 0; wire < 3; wire += 1) {
            const x = width * (0.3 + wire * 0.19);
            const end = start + length - 8;
            const cable = () => {
              ctx.beginPath(); ctx.moveTo(x, start + 7);
              ctx.bezierCurveTo(x - 5, start + length * 0.28,
                width - x + (index ? -2 : 2), start + length * 0.65, x, end);
            };
            ctx.lineCap = 'round';
            cable(); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 4; ctx.stroke();
            cable(); ctx.strokeStyle = wire === 1 ? muted : `rgba(${wire ? secondary : inkOf(tube.color)},.7)`;
            ctx.lineWidth = 1.8; ctx.stroke();
            [start + 4, end - 1].forEach(y => {
              plate(x - 2, y, 4, 5, 1);
            });
          }
          const clip = start + length * 0.57;
          plate(3, clip, width - 6, 5, 1);
          ctx.fillStyle = dark; ctx.fillRect(width * 0.45, clip + 1, 2, 3);
        });
        knuckles.filter(at => at > 0.1 && at < 0.9).forEach(at => {
          const y = height * at;
          ctx.fillStyle = dark; ctx.fillRect(0, y, width, 1);
        });
      }
      lamps.forEach((led, index) => {
        const x = horizontal ? width * 0.5 : width * 0.82;
        const y = height * led.top;
        const lit = led.can_blink && breathing ? 0.72 + 0.28 * Math.sin(beat * 1.6 + index) : 1;
        ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y, 2.7, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.shadowBlur = 4; ctx.shadowColor = `rgb(${inkOf(led.color)})`;
        ctx.fillStyle = `rgba(${inkOf(led.color)},${lit})`;
        ctx.beginPath(); ctx.arc(x, y, 1.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });

      frame = window.requestAnimationFrame(paint);
    };

    size();
    frame = window.requestAnimationFrame(paint);

    const watch = new ResizeObserver(size);
    watch.observe(node);
    return () => {
      window.cancelAnimationFrame(frame);
      watch.disconnect();
      window.removeEventListener('rab-theme', forget);
      window.removeEventListener('storage', forget);
    };
  }, [side]);

  return (
    <canvas
      ref={canvas}
      className={('site-chrome__rail-canvas ' + (className || '')).trim()}
      aria-hidden="true"
    />
  );
};
