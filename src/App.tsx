import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

  // Scrollen: Ein neuer Befehl rutscht an den oberen Rand ("anchor"), die Antwort baut sich darunter auf.
  // Kurze Antworten auf Rückfragen (j/n) hängen sich unten an ("follow").
  const scrollMode = useRef<'anchor' | 'follow' | 'none'>('none');
  const anchorId = useRef<number | null>(null);
  const [anchored, setAnchored] = useState(false);
  useLayoutEffect(() => {
    const el = termRef.current;
    if (!el) return;
    if (scrollMode.current === 'follow') {
      el.scrollTop = el.scrollHeight;
    } else if (scrollMode.current === 'anchor' && anchorId.current !== null) {
      const target = el.querySelector<HTMLElement>(`[data-lid="${anchorId.current}"]`);
      anchorId.current = null;
      if (target) el.scrollTo({ top: target.offsetTop - 10, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [lines]);

  /** Gibt ein Ergebnis aus: Spinner, dann Zeilen nacheinander. Ohne animate: alles auf einmal. */
  const show = useCallback(
    async (out: Out, my: number, animate = true) => {
      if (!animate) {
        setLines(ls => [...ls, ...(out.lines as L[]).map(([node, cls]) => ({ id: nextId++, node, cls }))]);
        return;
      }
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
    async (out: Out, my: number, animate = true) => {
      pending.current = out.pending;
      if (out.action === 'clear') {
        setLines([]);
        setAnchored(false);
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
      await show(out, my, animate);
    },
    [show],
  );

  const run = useCallback(
    async (cmd: string, echo = true) => {
      const my = ++runId.current;
      // Antwort auf eine Rückfrage: unten weiterschreiben; neuer Befehl: nach oben holen
      const isReply = !!pending.current && cmd.trim().length <= 12;
      scrollMode.current = isReply ? 'follow' : 'anchor';
      if (echo) {
        const id = append(<><span className="pr">&gt;</span> <span className="cmdtxt">{cmd}</span></>, 'in');
        if (!isReply) {
          anchorId.current = id;
          setAnchored(true);
        }
      }
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

  // Start: Kopf und Wochenansicht stehen sofort da, ohne Animation
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void navigator.storage?.persist?.();
    (async () => {
      const [snap, out] = await Promise.all([snapshot(), exec('woche')]);
      pending.current = out.pending;
      scrollMode.current = 'none';
      setLines([
        {
          id: nextId++,
          cls: 'boxln',
          node: (
            <div className="box">
              <div><span className="acc">✻</span> <b className="logo">leute</b> <span className="dim">v0.1</span></div>
              <div className="dim">Gedächtnis für deine Menschen</div>
              <div className="dim">{snap.persons.length} Menschen, {snap.moments.length} Notizen, alles auf diesem Gerät</div>
            </div>
          ),
        },
        ...(out.lines as L[]).map(([node, cls]) => ({ id: nextId++, node, cls })),
      ]);
    })();
  }, []);

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
    scrollMode.current = 'anchor';
    anchorId.current = append(<><span className="pr">&gt;</span> <span className="cmdtxt">import {f.name}</span></>, 'in');
    setAnchored(true);
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
            <div key={l.id} data-lid={l.id} className={`ln ${l.cls}`}>
              {l.node}
            </div>
          ))}
          {/* Platz unter der Ausgabe, damit ein neuer Befehl ganz nach oben rutschen kann */}
          {anchored && <div className="spacer" aria-hidden="true" />}
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
