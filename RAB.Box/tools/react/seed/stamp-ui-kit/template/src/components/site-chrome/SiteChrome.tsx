import { handlePointerDown, handlePointerMove, handlePointerUp, handleKeyDown } from './js/rabbit-drag.ts';
import { handleChange } from './js/rabbit-model.ts';
import type { SiteChromeProps } from './SiteChrome.types.ts';
import { RailCanvas } from './RailCanvas.tsx';
import './css/site-chrome.css';
import { handleMouseMove, handleMouseLeave } from './js/rabbit-pointer.ts';

// Site Chrome â€” structure only. Skin rides the atoms stacked in the markup
// (container-* to hold, row-*/button-* to respond); this file never paints.

const leftRail = {
  corner: { at: 'start' as const, color: 'var(--color-primary-rgb)', length: 0.15 },
  tubes: [
    { color: 'var(--color-primary-rgb)', top: 0.19, height: 0.22 },
    { color: 'var(--color-secondary-rgb)', top: 0.48, height: 0.34 },
  ],
  leds: [
    { color: 'var(--color-tertiary-rgb)', top: 0.44, can_blink: true },
    { color: 'var(--color-quaternary-rgb)', top: 0.87 },
  ],
  joints: [0.17, 0.43, 0.84],
};

const rightRail = {
  corner: { at: 'end' as const, color: 'var(--color-secondary-rgb)', length: 0.15 },
  tubes: [
    { color: 'var(--color-secondary-rgb)', top: 0.14, height: 0.3 },
    { color: 'var(--color-primary-rgb)', top: 0.53, height: 0.24 },
  ],
  leds: [
    { color: 'var(--color-quaternary-rgb)', top: 0.48, can_blink: true },
    { color: 'var(--color-tertiary-rgb)', top: 0.81 },
  ],
  joints: [0.12, 0.47, 0.79],
};

const topRail = {
  corner: { at: 'start' as const, color: 'var(--color-primary-rgb)', length: 0.12 },
  tubes: [
    { color: 'var(--color-primary-rgb)', top: 0.08, height: 0.16 },
    { color: 'var(--color-secondary-rgb)', top: 0.69, height: 0.2 },
  ],
  leds: [
    { color: 'var(--color-tertiary-rgb)', top: 0.31, can_blink: true },
    { color: 'var(--color-quaternary-rgb)', top: 0.61 },
  ],
  joints: [0.27, 0.64, 0.92],
};

const bottomRail = {
  corner: { at: 'end' as const, color: 'var(--color-secondary-rgb)', length: 0.12 },
  tubes: [
    { color: 'var(--color-primary-rgb)', top: 0.13, height: 0.25 },
    { color: 'var(--color-secondary-rgb)', top: 0.56, height: 0.28 },
  ],
  leds: [
    { color: 'var(--color-quaternary-rgb)', top: 0.45, can_blink: true },
    { color: 'var(--color-tertiary-rgb)', top: 0.89 },
  ],
  joints: [0.1, 0.42, 0.87],
};

export const SiteChrome = ({ header, children, can_move = true }: SiteChromeProps) => (
  <section className="site-chrome container-machine" data-cols="1" onChange={handleChange}
    onMouseMoveCapture={handleMouseMove} onMouseLeave={handleMouseLeave}>
    <div
      className="site-chrome__rail site-chrome__rail--left container-cell container-cell--inset"
      aria-hidden="true"
    >
      <RailCanvas side="left" {...leftRail} />
    </div>
    <div
      className="site-chrome__rail site-chrome__rail--right container-cell container-cell--inset"
      aria-hidden="true"
    >
      <RailCanvas side="right" {...rightRail} />
    </div>
    <div
      className="site-chrome__rail site-chrome__rail--top container-cell container-cell--inset"
      aria-hidden="true"
    >
      <RailCanvas side="top" {...topRail} />
    </div>
    <div
      className="site-chrome__rail site-chrome__rail--bottom container-cell container-cell--inset"
      aria-hidden="true"
    >
      <RailCanvas side="bottom" {...bottomRail} />
    </div>
    <span
      className="site-chrome__arc site-chrome__arc--top-left container-neon-corner container-neon-corner--top-left"
      aria-hidden="true"
    />
    <span
      className="site-chrome__arc site-chrome__arc--top-right container-neon-corner container-neon-corner--secondary container-neon-corner--top-right"
      aria-hidden="true"
    />
    <span
      className="site-chrome__arc site-chrome__arc--bottom-left container-neon-corner container-neon-corner--bottom-left"
      aria-hidden="true"
    />
    <span
      className="site-chrome__arc site-chrome__arc--bottom-right container-neon-corner container-neon-corner--secondary container-neon-corner--bottom-right"
      aria-hidden="true"
    />
    <div className="site-chrome__inner container-cell container-cell--inset" data-grid="header-main" data-gap={header ? "control" : undefined}>
      <header
        className="site-chrome__header container-metal"
        hidden={!header}
        data-area="header"
        data-grid="side-left"
      >
        {header}
      </header>
      <main className="site-chrome__main scroll" data-area="main" data-rows="1">
        <div className="site-chrome__mascot" data-id="rabbit-mascot" hidden>
          <button type="button" hidden={!can_move} className="site-chrome__mascot-handle action-nav"
            aria-label="Move rabbit. Drag or use arrow keys." title="Drag rab · arrow keys also move"
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
            onLostPointerCapture={handlePointerUp} onKeyDown={handleKeyDown}>
            ⠿ RAB
          </button>
          <iframe
            className="site-chrome__background"
            data-id="rabbit-background"
            src="/interactive/rab-3d/rabbit.html?embed=background&model=rabbit"
            title="Rabbit animation"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
        {children}
      </main>
    </div>
  </section>
);
