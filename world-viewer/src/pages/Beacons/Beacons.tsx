import type { HTMLAttributes } from 'react';
export type BeaconsProps = HTMLAttributes<HTMLElement>;
export const Beacons = ({ children = "", className, ...domProps }: BeaconsProps) => {
  return <main {...domProps} className={className} data-page="Beacons" data-rab-seat="page-beacons:p1">
    {/* [rab-seat:page-beacons:p1] */}
    <h1>{"Beacons"}</h1>
    <p>{"React page Beacons."}</p>
    {children}
  </main>;
};
