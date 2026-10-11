import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { exec, importList, type Out, type Pending } from './shell/commands';
import { RunContext, type L } from './shell/ui';
import { parseVcards } from './lib/vcard';
import { snapshot } from './lib/db';

interface Line {
  id: number;
  node: ReactNode;
  cls: string;
}

const SPIN = '✻✽✶✳✢✳✶✽';
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise(r => setTimeout(r, reduce ? 0 : ms));

// Web Speech API (Safari/Chrome mit Präfix)
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {};
const SpeechRec = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Rec) | undefined;

let nextId = 1;

export default function App() {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const pending = useRef<Pending | undefined>(undefined);
  const runId = useRef(0);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<Rec | null>(null);
  const history = useRef<string[]>([]);
  const histPos = useRef(-1);

  const append = useCallback((node: ReactNode, cls: string) => {
    const id = nextId++;
    setLines(ls => [...ls, { id, node, cls }]);
    return id;
  }, []);

  const replace = useCallback((id: number, node: ReactNode) => {
    setLines(ls => ls.map(l => (l.id === id ? { ...l, node } : l)));
  }, []);

  const remove = useCallback((id: number) => setLines(ls => ls.filter(l => l.id !== id)), []);

  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  /** Gibt ein Ergebnis aus: Spinner, dann Zeilen nacheinander. */
  const show = useCallback(
    async (out: Out, my: number) => {
      if (out.spin && !reduce) {
        const sid = append('', 'spin');
        const t0 = Date.now();
        let i = 0;
        const dur = 450 + Math.random() * 450;
        while (Date.now() - t0 < dur && runId.current === my) {
          replace(sid, <><span className="acc">{SPIN[i++ % SPIN.length]}</span> {out.spin} <span className="dim">({Math.floor((Date.now() - t0) / 1000) + 1}s)</span></>);
          await wait(90);
        }
        remove(sid);
      }
      const delay = out.lines.length > 40 ? 4 : 22;
      for (const [node, cls] of out.lines as L[]) {
        append(node, cls);
        // neuer Befehl: Rest ohne Pause ausgeben
        if (runId.current === my) await wait(delay + Math.random() * 18);
      }
    },
    [append, replace, remove],
  );

  const handle = useCallback(
    async (out: Out, my: number) => {
      pending.current = out.pending;
      if (out.action === 'clear') {
        setLines([]);
        return;
      }
      if (out.action === 'pickFile') fileRef.current?.click();
      if (out.action && typeof out.action === 'object') {
        if ('open' in out.action) {
          if (out.action.open.startsWith('http')) window.open(out.action.open, '_blank', 'noopener');
          else window.location.href = out.action.open;
        }
        if ('download' in out.action) {
          const url = URL.createObjectURL(new Blob([out.action.download], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = out.action.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
      }
      if (out.fill !== undefined) {
        setInput(out.fill);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      await show(out, my);
    },
    [show],
  );

  const run = useCallback(
    async (cmd: string, echo = true) => {
      const my = ++runId.current;
      if (echo) append(<><span className="pr">&gt;</span> <span className="cmdtxt">{cmd}</span></>, 'in');
      if (cmd.trim()) {
        history.current.unshift(cmd);
        histPos.current = -1;
      }
      try {
        const out = await exec(cmd, pending.current);
        await handle(out, my);
      } catch (e) {
        append(<><span className="acc">!</span> Fehler: {(e as Error).message}</>, '');
      }
    },
    [append, handle],
  );

  // Antippbare Befehle: "neu " o. Ä. landen im Eingabefeld statt ausgeführt zu werden
  const tap = useCallback(
    (cmd: string) => {
      if (cmd.endsWith(' ')) {
        setInput(cmd);
        inputRef.current?.focus();
        return;
      }
      void run(cmd);
    },
    [run],
  );

  // Start: Kopf, dann "woche" wie getippt
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void navigator.storage?.persist?.();
    (async () => {
      const snap = await snapshot();
      append(
        <div className="box">
          <div><span className="acc">✻</span> <b className="logo">leute</b> <span className="dim">v0.1</span></div>
          <div className="dim">Gedächtnis für deine Menschen</div>
          <div className="dim">{snap.persons.length} Menschen, {snap.moments.length} Notizen, alles auf diesem Gerät</div>
        </div>,
        'boxln',
      );
      await wait(250);
      const my = ++runId.current;
      const id = append(<><span className="pr">&gt;</span> <span className="cmdtxt" /></>, 'in');
      let typed = '';
      for (const ch of 'woche') {
        typed += ch;
        replace(id, <><span className="pr">&gt;</span> <span className="cmdtxt">{typed}</span><span className="cur" /></>);
        await wait(45 + Math.random() * 50);
      }
      replace(id, <><span className="pr">&gt;</span> <span className="cmdtxt">woche</span></>);
      await handle(await exec('woche'), my);
    })();
  }, [append, replace, handle]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input;
    setInput('');
    void run(v);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && history.current.length) {
      e.preventDefault();
      histPos.current = Math.min(histPos.current + 1, history.current.length - 1);
      setInput(history.current[histPos.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      histPos.current = Math.max(histPos.current - 1, -1);
      setInput(histPos.current < 0 ? '' : history.current[histPos.current]);
    } else if (e.key === 'Escape') {
      runId.current++;
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    const my = ++runId.current;
    await handle(importList(parseVcards(text)), my);
  };

  const mic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!SpeechRec) {
      append(<span className="dim">  Diktieren: tippe ins Feld und nutze das Mikrofon der Tastatur.</span>, '');
      inputRef.current?.focus();
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input.trimEnd() + ' ' : '';
    rec.onresult = ev => {
      let t = '';
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      setInput(base + t);
    };
    rec.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    rec.onerror = () => {
      setListening(false);
      append(<span className="dim">  Kein Mikrofon-Zugriff. Nutze das Mikrofon der Tastatur.</span>, '');
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <RunContext.Provider value={tap}>
      <main className="app">
        <div className="term" ref={termRef} aria-live="polite">
          {lines.map(l => (
            <div key={l.id} className={`ln ${l.cls}`}>
              {l.node}
            </div>
          ))}
        </div>
        <div className="dock">
          <form className="prompt" onSubmit={submit} autoComplete="off">
            <span className="pr">&gt;</span>
            <input
              id="cmd"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Wen hast du getroffen?"
              aria-label="Befehl oder Notiz"
              autoCapitalize="none"
              enterKeyHint="send"
            />
            <button type="button" className={`rec ${listening ? 'on' : ''}`} onClick={mic} aria-label="Diktieren">
              {listening ? '■ STOP' : '● REC'}
            </button>
          </form>
          <div className="hint">
            <button type="button" className="c" onClick={() => tap('woche')}><b>woche</b></button>
            <button type="button" className="c" onClick={() => tap('leute')}><b>leute</b></button>
            <button type="button" className="c" onClick={() => tap('hilfe')}><b>?</b> hilfe</button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" hidden onChange={onFile} />
      </main>
    </RunContext.Provider>
  );
}
