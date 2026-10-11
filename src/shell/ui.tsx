// Bausteine für Terminal-Zeilen. Jede Funktion liefert [Inhalt, CSS-Klasse].

import { createContext, useContext, type ReactNode } from 'react';

export type L = [ReactNode, string];

export const RunContext = createContext<(cmd: string) => void>(() => {});

/** Antippbarer Befehl im Text */
export function C({ cmd, children, cls = '' }: { cmd: string; children: ReactNode; cls?: string }) {
  const run = useContext(RunContext);
  return (
    <button type="button" className={`c ${cls}`} onClick={() => run(cmd)}>
      {children}
    </button>
  );
}

export const row = (name: ReactNode, right: ReactNode = '', dot = '', big = false): L => [
  <>
    <span className={`dot ${dot}`}>●</span>
    <span className={`nm ${big ? 'big' : ''}`}>{name}</span>
    <span className="fill" />
    <span className="r">{right}</span>
  </>,
  'row',
];

export const sub = (n: ReactNode): L => [
  <>
    <span className="br">⎿</span>
    {n}
  </>,
  'sub',
];

export const keys = (ks: [string, string, string][]): L => [
  <>
    {ks.map(([k, label, cmd]) => (
      <C key={k + cmd} cmd={cmd} cls="kbtn">
        <span className="key">[{k}]</span> {label}
      </C>
    ))}
  </>,
  'keys',
];

export const plus = (label: string, val: ReactNode): L => [
  <>
    <span className="sign">+</span> <span className="lab">{label}</span>
    {val}
  </>,
  'diff add',
];

export const minus = (label: string, val: ReactNode): L => [
  <>
    <span className="sign">-</span> <span className="lab">{label}</span>
    {val}
  </>,
  'diff del',
];

export const gap = (): L => ['', 'gap'];
export const sec = (t: string): L => [t, 'sec'];
export const text = (n: ReactNode, cls = ''): L => [n, cls];
export const dim = (n: ReactNode): L => [<span className="dim">{n}</span>, ''];
export const ok = (n: ReactNode): L => [
  <>
    <span className="ok">✓</span> {n}
  </>,
  '',
];
export const warn = (n: ReactNode): L => [
  <>
    <span className="acc">!</span> {n}
  </>,
  '',
];
export const box = (n: ReactNode): L => [<div className="box">{n}</div>, 'boxln'];
