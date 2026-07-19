// app/console.jsx — the consumer shell that wraps the war diorama: fixture picker,
// replay scrubber, tap-to-inspect + Merkle proof walk, predict-along, share, and
// devnet wallet. Loaded via <x-import> (Babel, not ES modules) so it talks to the
// HUD only through window.BATTLE. Extends the war-diorama aesthetic — never dev-tools.
(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const GOLD = '#d3ab48', INK = '#e2e7dc', DIM = 'rgba(210,220,205,.55)';
  const PANEL = 'rgba(9,13,10,.94)', LINE = 'rgba(200,210,190,.16)';
  const MONO = "'IBM Plex Mono',ui-monospace,monospace", COND = "'Barlow Condensed',sans-serif";
  const B = () => window.BATTLE || {};
  // diacritic-insensitive lower-case (so "cote" matches "Côte", "arg" matches Argentina)
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // a fixture's searchable haystack: both team names, their abbreviations, competition
  function searchable(f) {
    const ab = B().abbr || ((n) => String(n || '').slice(0, 3));
    return norm(`${f.participant1} ${f.participant2} ${ab(f.participant1)} ${ab(f.participant2)} ${f.competition || ''}`);
  }

  const fmtClock = (c) => {
    if (!c) return '—';
    // stoppage relative to each phase's regulation boundary (45+n / 90+n / 105+n / 120+n)
    const sec = c.s | 0, ss = String(sec % 60).padStart(2, '0');
    const REG = { H1: [45, 2700], HT: [45, 2700], H2: [90, 5400], ET1: [105, 6300], ET2: [120, 7200] };
    let mp = REG[c.phase];
    if (!mp && c.phase === 'FT') mp = sec > 7200 ? [120, 7200] : sec > 6300 ? [105, 6300] : sec > 5400 ? [90, 5400] : null;
    if (mp && sec > mp[1]) { const ex = sec - mp[1]; return `${mp[0]}+${Math.floor(ex / 60)}:${String(ex % 60).padStart(2, '0')}`; }
    return `${Math.floor(sec / 60)}:${ss}`;
  };

  function Flag({ name, w = 22 }) {
    const h = Math.round(w * 2 / 3);
    const html = B().flag ? B().flag(name, { w, h }) : '';
    return <span aria-hidden style={{ display: 'inline-flex', flex: '0 0 auto', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }}
      dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // subscribe to the 4Hz frame feed
  function useSnap() {
    const [snap, setSnap] = useState(() => (B().getState ? B().getState() : {}));
    useEffect(() => {
      if (!B().subscribe) return;
      return B().subscribe((s) => setSnap(s));
    }, []);
    return snap;
  }

  const Btn = (props) => <button {...props} style={{ fontFamily: MONO, cursor: 'pointer', border: `1px solid ${LINE}`, background: 'rgba(8,12,9,.82)', color: INK, borderRadius: 9, WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)', ...props.style }} />;

  // ── top chrome: match chip (left) · mode+wallet+share (right) ─────────────
  function TopChrome({ onOpen, mode, wallet }) {
    const snap = useSnap();
    const id = snap.ident || {};
    const sandbox = mode === 'sandbox' || mode === 'synthetic';
    const live = mode === 'live';
    const modeLabel = sandbox ? 'SANDBOX' : live ? 'LIVE' : 'REPLAY';
    const modeColor = sandbox ? '#c9b6f0' : live ? '#7ed992' : GOLD;
    const modeBorder = sandbox ? 'rgba(155,125,232,.45)' : live ? 'rgba(126,217,146,.4)' : 'rgba(211,171,72,.4)';
    return (
      <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 8px)', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 10px', zIndex: 46, pointerEvents: 'none' }}>
        <button onClick={() => onOpen('picker')} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px 7px 8px', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: INK, border: `1px solid ${LINE}`, background: PANEL, borderRadius: 10, cursor: 'pointer', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}>
          <Flag name={id.homeNation || 'England'} w={18} />
          <span style={{ opacity: .55, fontSize: 9 }}>v</span>
          <Flag name={id.awayNation || 'Argentina'} w={18} />
          <span style={{ marginLeft: 4, color: GOLD }}>MATCHES</span>
          <span style={{ opacity: .5 }}>▾</span>
        </button>
        <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: modeColor, border: `1px solid ${modeBorder}`, background: PANEL, borderRadius: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: modeColor, animation: 'blinkDot 1.6s infinite' }} />{modeLabel}
          </span>
          {!sandbox && <Btn onClick={() => onOpen('inspect')} title="Verify this tick on-chain" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', height: 30, borderRadius: 10, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#8fc4ec' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8fc4ec" strokeWidth="2"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></svg>VERIFY
          </Btn>}
          <Btn onClick={() => onOpen('share')} title="Share this moment" style={{ width: 34, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          </Btn>
          <button onClick={() => onOpen('wallet')} title={wallet ? 'Guest ID · devnet' : 'Guest identity (devnet)'} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', height: 30, boxSizing: 'border-box', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: wallet ? '#7ed992' : DIM, border: `1px solid ${wallet ? 'rgba(126,217,146,.4)' : LINE}`, background: PANEL, borderRadius: 10, cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M16 12h2" /></svg>
            {wallet ? wallet.slice(0, 4) + '…' : ''}
          </button>
        </div>
      </div>
    );
  }

  // ── scrubber (bottom) — seek + cinematic fast-forward ─────────────────────
  const SPEEDS = [1, 2, 4, 8];
  function Scrubber() {
    const snap = useSnap();
    const [drag, setDrag] = useState(null);
    const [isDesktop, setIsDesktop] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(min-width:1024px)').matches);
    useEffect(() => { if (typeof matchMedia === 'undefined') return; const mq = matchMedia('(min-width:1024px)'); const on = () => setIsDesktop(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
    const wasPlaying = useRef(true);
    const prog = drag != null ? drag : (snap.progress || 0);
    const f = snap.frame;
    const speed = snap.speed || 1;
    const seek = (p) => { B().seekProgress && B().seekProgress(p); };
    // no timeline to scrub in the synthetic sandbox (it's a live-feel playground)
    if (snap.mode === 'sandbox' || snap.mode === 'synthetic') return null;
    // desktop: dock into the console chrome between the stats/feed columns (never over
    // the diorama or the side panels). phone: floating bar above the corner controls.
    const pos = isDesktop ? { left: 384, right: 404, bottom: 18 } : { left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 70px)' };
    const btn = { flex: '0 0 auto', width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: 'rgba(255,255,255,.05)', color: INK, cursor: 'pointer', fontFamily: MONO };
    return (
      <div style={{ position: 'fixed', ...pos, zIndex: 44, pointerEvents: 'auto' }}>
        <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: '8px 12px 9px', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => B().togglePlay && B().togglePlay()} style={{ ...btn, fontSize: 12 }}>{snap.playing === false ? '▶' : '❚❚'}</button>
            <span style={{ flex: '0 0 auto', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: INK, minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>{fmtClock(f && f.clock)}</span>
            <span style={{ flex: '0 0 auto', fontSize: 8.5, fontWeight: 700, letterSpacing: 1, color: DIM }}>{f && f.clock ? f.clock.phase : ''}</span>
            <input type="range" min="0" max="1000" value={Math.round(prog * 1000)} aria-label="Match timeline"
              onPointerDown={() => { wasPlaying.current = snap.playing !== false; B().setPaused && B().setPaused(true); }}
              onChange={(e) => { const p = +e.target.value / 1000; setDrag(p); seek(p); }}
              onPointerUp={() => { setDrag(null); if (wasPlaying.current) B().setPaused && B().setPaused(false); }}
              style={{ flex: 1, accentColor: GOLD, height: 4, cursor: 'pointer' }} />
            <button onClick={() => { const nx = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; B().setSpeed && B().setSpeed(nx); }}
              style={{ ...btn, minWidth: 34, width: 'auto', padding: '0 8px', fontSize: 11, fontWeight: 700 }}>{speed}×</button>
            {isDesktop && <button onClick={() => B().toggleSound && B().toggleSound()} aria-label="Toggle sound" style={{ ...btn, width: 'auto', padding: '0 8px', fontSize: 8.5, fontWeight: 700, color: snap.sound ? GOLD : DIM }}>{snap.sound ? 'SND' : 'MUTE'}</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── fixture picker ────────────────────────────────────────────────────────
  const SEGS = [['live', 'LIVE'], ['upcoming', 'UPCOMING'], ['played', 'FINISHED']];
  function FixturePicker({ onClose }) {
    const [all, setAll] = useState(null);
    const [seg, setSeg] = useState('played');
    const [q, setQ] = useState('');
    useEffect(() => { B().fixtures && B().fixtures().then(setAll).catch(() => setAll([])); }, []);
    const counts = { live: 0, upcoming: 0, played: 0 };
    (all || []).forEach((f) => { counts[f.status] = (counts[f.status] || 0) + 1; });
    // ordering: LIVE first, upcoming by kickoff (soonest), finished by recency (final on top)
    const ORDER = {
      live: (a, b) => (b.startTime || 0) - (a.startTime || 0),
      upcoming: (a, b) => (a.startTime || 0) - (b.startTime || 0),
      played: (a, b) => (b.startTime || 0) - (a.startTime || 0),
    };
    const nq = norm(q);
    const rows = (all || []).filter((f) => f.status === seg)
      .filter((f) => !nq || searchable(f).includes(nq))
      .sort(ORDER[seg] || ORDER.played);
    const orderNote = seg === 'upcoming' ? 'SOONEST KICKOFF FIRST' : seg === 'live' ? 'LIVE NOW' : 'MOST RECENT FIRST';
    return (
      <Sheet title="CHOOSE YOUR BATTLE" onClose={onClose}>
        <button onClick={() => { B().open(0, 'sandbox'); onClose(); }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', marginBottom: 10, borderRadius: 12, cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(155,125,232,.4)', background: 'linear-gradient(100deg, rgba(155,125,232,.14), rgba(255,255,255,.02))', color: INK }}>
          <span style={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 9, background: 'rgba(155,125,232,.16)', border: '1px solid rgba(155,125,232,.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9b6f0" strokeWidth="2" strokeLinecap="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /><path d="M9.5 6.5L21 18v3h-3L6.5 9.5" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontFamily: COND, fontSize: 15, fontWeight: 700, letterSpacing: 2, color: '#f0f3ec' }}>SANDBOX ARENA</span>
              <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: 1, color: '#c9b6f0', border: '1px solid rgba(155,125,232,.4)', borderRadius: 4, padding: '1.5px 5px' }}>WAR ROOM</span>
            </div>
            <div style={{ fontSize: 9.5, color: DIM, marginTop: 2, lineHeight: 1.4 }}>Two fictional sides on the synthetic engine — call the shots by hand.</div>
          </div>
          <span style={{ color: '#c9b6f0', opacity: .7, fontSize: 16 }}>›</span>
        </button>
        <div style={{ display: 'flex', gap: 6, padding: '2px 2px 10px' }}>
          {SEGS.map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)} style={{ flex: 1, padding: '7px 4px', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1, borderRadius: 8, cursor: 'pointer', border: `1px solid ${seg === k ? 'rgba(211,171,72,.5)' : LINE}`, background: seg === k ? 'rgba(211,171,72,.14)' : 'rgba(255,255,255,.03)', color: seg === k ? GOLD : DIM }}>
              {lbl}<span style={{ opacity: .6, marginLeft: 5 }}>{counts[k] || 0}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team or competition…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', marginBottom: 8, fontFamily: MONO, fontSize: 12, color: INK, background: 'rgba(255,255,255,.04)', border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none' }} />
        <div style={{ flex: 1, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
          {all == null && <div style={{ textAlign: 'center', color: DIM, fontSize: 11, padding: 30 }}>Loading fixtures…</div>}
          {all && rows.length === 0 && <div style={{ textAlign: 'center', color: DIM, fontSize: 11, padding: 30 }}>No {seg} fixtures.</div>}
          {rows.map((f) => (
            <button key={f.fixtureId} onClick={() => { B().open(f.fixtureId, f.status === 'played' ? 'replay' : 'live'); onClose(); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', marginBottom: 4, borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: `1px solid ${LINE}`, background: 'rgba(255,255,255,.02)', color: INK }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Flag name={f.participant1} w={22} />
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.participant1}</span>
              </div>
              <div style={{ flex: '0 0 auto', fontFamily: COND, fontSize: 15, fontWeight: 700, color: f.finalScore ? INK : DIM, letterSpacing: 1 }}>
                {f.finalScore ? `${f.finalScore[0]}–${f.finalScore[1]}` : 'vs'}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{f.participant2}</span>
                <Flag name={f.participant2} w={22} />
              </div>
            </button>
          ))}
          {rows.length > 0 && <div style={{ fontSize: 8.5, letterSpacing: 1, color: 'rgba(210,220,205,.35)', padding: '8px 4px 4px' }}>{orderNote} · {rows.length} FIXTURES · TXLINE CORPUS</div>}
        </div>
      </Sheet>
    );
  }

  // ── generic bottom sheet ──────────────────────────────────────────────────
  function Sheet({ title, onClose, children, accent }) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80 }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,3,.55)', animation: 'fadeIn .2s both' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, margin: '0 auto', width: 'min(560px, 100%)', maxHeight: '86dvh', background: PANEL, borderTop: `2px solid ${accent || GOLD}`, borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)', animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1) both', boxShadow: '0 -12px 40px rgba(0,0,0,.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px' }}>
            <div style={{ fontFamily: COND, fontSize: 18, fontWeight: 700, letterSpacing: 3, color: '#f0f3ec' }}>{title}</div>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${LINE}`, background: 'rgba(255,255,255,.05)', color: INK, cursor: 'pointer', fontFamily: MONO }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 16px calc(env(safe-area-inset-bottom) + 16px)', flex: 1 }}>{children}</div>
        </div>
      </div>
    );
  }

  // ── subject headline — the "which pixel did I tap" panel above the raw tick ──
  // Every inspect target (war-feed tap, VERIFY, or a tap on the flare / fog / trench)
  // lands in the SAME sheet + proof walk; only this header changes.
  const INSPECT_TITLE = { tick: 'INSPECT THIS TICK', frontline: 'THE FRONTLINE', fog: 'FOG OF WAR', flare: 'THREAT FLARE' };
  function SubjectHeadline({ subject, ident }) {
    if (!subject || subject.kind === 'tick') return null;
    const ha = ident.homeAbbr || 'HOME', aa = ident.awayAbbr || 'AWAY';
    if (subject.kind === 'frontline') {
      const p = subject.prob || { home: 33.3, draw: 33.4, away: 33.3 };
      const bars = [[ha, p.home, '#d3273e'], ['DRAW', p.draw, 'rgba(210,220,205,.5)'], [aa, p.away, '#7ab5e8']];
      return (
        <div style={{ padding: '4px 0 12px' }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: DIM, marginBottom: 8 }}>DE-MARGINED 1X2 · THE TRUE PROBABILITY DRIVING THE TRENCH</div>
          {bars.map(([k, v, c]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
              <span style={{ width: 42, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: INK }}>{k}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}><div style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: '100%', background: c, borderRadius: 4 }} /></div>
              <span style={{ width: 44, textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: INK }}>{v.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      );
    }
    if (subject.kind === 'fog') {
      const g = subject.gap || {};
      const fmtsec = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
      return (
        <div style={{ padding: '4px 0 12px' }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: DIM, marginBottom: 8 }}>THE MARKET WENT DARK — REAL TxLINE SUSPENSION WINDOW</div>
          <Row k="Opened at" v={g.startSec != null ? fmtsec(g.startSec) : '—'} />
          <Row k="Reopens at" v={g.endSec != null ? fmtsec(g.endSec) : '—'} />
          <Row k="Duration" v={g.durMs != null ? `${(g.durMs / 1000).toFixed(0)}s dark` : '—'} />
          <div style={{ marginTop: 8, fontSize: 9, color: DIM, lineHeight: 1.5 }}>The sparkline leaves this gap unfilled — a book that suspended around a material event, never interpolated.</div>
        </div>
      );
    }
    if (subject.kind === 'flare') {
      const nm = subject.side === 'home' ? (ident.homeName || 'HOME') : subject.side === 'away' ? (ident.awayName || 'AWAY') : 'THE MATCH';
      const evLabel = { goal: 'GOAL THREAT', penalty: 'PENALTY THREAT', corner: 'CORNER', var: 'VAR CHECK', redCard: 'RED CARD REVIEW', yellowCard: 'CAUTION' }[subject.event] || 'THREAT';
      return (
        <div style={{ padding: '4px 0 12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 10, background: 'rgba(211,171,72,.12)', border: '1px solid rgba(211,171,72,.4)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round"><path d="M12 2v6M12 22a7 7 0 007-7c0-3-2-5-3-8-1 2-2 3-4 3-1 0-2-1-2-3-2 2-4 5-4 8a7 7 0 007 7z" /></svg>
            <span style={{ fontFamily: COND, fontSize: 15, fontWeight: 700, letterSpacing: 1, color: GOLD }}>{nm} · {evLabel}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 9.5, color: DIM, lineHeight: 1.5 }}>The feed's <b style={{ color: INK }}>PossibleEvent</b> predictor lit this flare — the market's live read that something is about to happen. The raw state below is the tick it fired on.</div>
        </div>
      );
    }
    return null;
  }

  // ── inspect + Merkle proof walk ───────────────────────────────────────────
  function InspectSheet({ onClose, subject }) {
    const subj = subject || { kind: 'tick' };
    const ident = (B().getIdent && B().getIdent()) || {};
    const [phase, setPhase] = useState('loading'); // loading|state|proof|error
    const [state, setState] = useState(null);
    const [proof, setProof] = useState(null);
    const [browser, setBrowser] = useState(null); // { status:'pending'|'ok'|'error', res?, err? }
    const [err, setErr] = useState(null);
    useEffect(() => {
      const seq = subj.seq;
      const ts = subj.ts != null ? subj.ts : (B().headTs ? B().headTs() : 0);
      const load = (seq != null && B().stateAtSeq) ? B().stateAtSeq(seq) : B().stateAtTs(ts);
      load.then((st) => { setState(st); setPhase('state'); }).catch((e) => { setErr(String(e.message || e)); setPhase('error'); });
    }, []);
    const verify = async () => {
      setPhase('proof-loading');
      try {
        const p = await B().proof(state.seq, [1, 2], true);
        setProof(p); setPhase('proof');
        // fire the INDEPENDENT browser-side check in parallel (reconstructs the root
        // in-page + reads the mainnet PDA; slower, so the engine verdict shows first).
        setBrowser({ status: 'pending' });
        if (B().verifyBrowser && p && p.proof) {
          B().verifyBrowser(p.proof)
            .then((res) => setBrowser({ status: 'ok', res }))
            .catch((e) => setBrowser({ status: 'error', err: String((e && e.message) || e) }));
        } else {
          setBrowser({ status: 'error', err: 'browser verify unavailable' });
        }
      }
      catch (e) { setErr(String(e.message || e)); setPhase('error'); }
    };
    const hex = (arr) => (arr || []).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16) + '…';
    return (
      <Sheet title={INSPECT_TITLE[subj.kind] || 'INSPECT THIS TICK'} onClose={onClose} accent="#7ab5e8">
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {phase === 'loading' && <Muted>Reading market state at the frontline…</Muted>}
          {phase === 'error' && <Muted>Could not read this tick: {err}</Muted>}
          {(phase === 'state' || phase.startsWith('proof')) && state && (
            <div>
              <SubjectHeadline subject={subj} ident={ident} />
              <Row k="Fixture" v={state.fixtureId} />
              <Row k="Sequence" v={`#${state.seq}`} />
              <Row k="Match clock" v={clockLabel(state)} />
              <Row k="Action" v={state.action} />
              <Row k="Score (P1–P2)" v={scoreLabel(state)} />
              <Row k="Recorded" v={new Date(state.ts).toISOString().replace('T', ' ').slice(0, 19) + 'Z'} />
              <div style={{ marginTop: 10, fontSize: 8.5, letterSpacing: 1, color: DIM }}>THIS IS THE RAW TXLINE STATE THE DIORAMA IS DRAWING RIGHT NOW.</div>
              {phase === 'state' && (
                <button onClick={verify} style={{ marginTop: 14, width: '100%', padding: '12px', fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#0d0b05', background: GOLD, border: 'none', borderRadius: 10, cursor: 'pointer' }}>VERIFY THIS TICK ON-CHAIN →</button>
              )}
              {phase === 'proof-loading' && <Muted>Fetching Merkle proof + reading the Solana account…</Muted>}
              {phase === 'proof' && proof && <ProofWalk proof={proof} browser={browser} hex={hex} />}
            </div>
          )}
        </div>
      </Sheet>
    );
  }

  function ProofWalk({ proof, browser, hex }) {
    const oc = proof.onChain || {};
    const br = browser && browser.status === 'ok' ? browser.res : null;
    const engineOk = !!oc.verified;
    const browserOk = !!(br && br.verified);
    const bothOk = engineOk && browserOk;
    const ok = engineOk; // the diorama already drew this tick; engine is the primary verdict
    // Prefer the browser-reconstructed roots for the walk once they land (they are what
    // the viewer's own machine computed); fall back to the engine's until then.
    const computedHex = (br && br.computedRootHex) || oc.computedRootHex;
    const chainHex = (br && br.onChainRootHex) || oc.onChainRootHex;
    const subOk = br ? br.subTreeVerified : oc.subTreeVerified;
    const pda = (br && br.pda) || oc.pda || '';
    const epochDay = (br && br.epochDay) != null ? br.epochDay : oc.epochDay;
    const programId = (br && br.programId) || oc.programId || '';
    const leaves = (proof.proof && proof.proof.statsToProve) || oc.statsToProve || [];
    const steps = [
      ['①', 'THE LEAF', `${leaves.length} stat ${leaves.length === 1 ? 'leaf' : 'leaves'} — the exact numbers on screen`, leaves.map((s) => `key ${s.key} = ${s.value}`).join(' · ') || '—'],
      ['②', 'THE BRANCH', 'sibling hashes fold the leaf up the sub-tree', `${(proof.proof && proof.proof.subTreeProof ? proof.proof.subTreeProof.length : 0)} sub-tree nodes → sub-root ${subOk ? '✓' : '✗'}`],
      ['③', 'THE ROOT', br ? 'YOUR browser folded the summary into one root' : 'the main tree gives one root for the whole 5-min batch', `computed ${hex(hexToBytes(computedHex))}`],
      ['④', 'ON-CHAIN', `anchored on Solana account ${(pda || '').slice(0, 6)}… (epoch day ${epochDay})`, `chain root ${hex(hexToBytes(chainHex))}`],
    ];
    // the two independent checks
    const browserLine = browser == null ? null
      : browser.status === 'pending' ? { c: DIM, t: 'IN YOUR BROWSER', d: 'reconstructing the root + reading Solana…', mark: '◌' }
      : browser.status === 'error' ? { c: '#e8c98a', t: 'IN YOUR BROWSER', d: 'RPC unreachable — engine verdict stands', mark: '—' }
      : browserOk ? { c: '#7ed992', t: 'IN YOUR BROWSER', d: 'computed root === the root Solana anchored', mark: '✓' }
      : { c: '#e88a8a', t: 'IN YOUR BROWSER', d: br.failureMode || 'roots did not match', mark: '✗' };
    const engineLine = { c: engineOk ? '#7ed992' : '#e88a8a', t: 'BY THE ENGINE', d: engineOk ? 'server reconstructed the same root independently' : (oc.failureMode || 'roots did not match'), mark: engineOk ? '✓' : '✗' };
    const Check = ({ ln }) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,.03)', border: `1px solid ${LINE}`, marginBottom: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: ln.c, width: 14, textAlign: 'center' }}>{ln.mark}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, color: INK }}>{ln.t}</div>
          <div style={{ fontSize: 9, color: DIM }}>{ln.d}</div>
        </div>
      </div>
    );
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: ok ? 'rgba(126,217,146,.12)' : 'rgba(232,138,138,.12)', border: `1px solid ${ok ? 'rgba(126,217,146,.4)' : 'rgba(232,138,138,.4)'}`, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{ok ? '🛡' : '⚠'}</span>
          <div>
            <div style={{ fontFamily: COND, fontSize: 15, fontWeight: 700, letterSpacing: 1, color: ok ? '#a8e8ba' : '#f0b0b0' }}>{ok ? (bothOk ? 'PROVEN AUTHENTIC · VERIFIED TWICE' : 'PROVEN AUTHENTIC') : 'PROOF INCOMPLETE'}</div>
            <div style={{ fontSize: 9, color: DIM, letterSpacing: .5 }}>{bothOk ? 'independently confirmed in your browser AND by the engine' : ok ? 'computed root === the root Solana anchored' : (oc.failureMode || 'roots did not match')}</div>
          </div>
        </div>
        {browserLine && <Check ln={browserLine} />}
        <Check ln={engineLine} />
        <div style={{ height: 6 }} />
        {steps.map(([n, t, d, val], i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < 3 ? `1px solid ${LINE}` : 'none' }}>
            <span style={{ flex: '0 0 auto', fontFamily: COND, fontSize: 17, color: GOLD, width: 18 }}>{n}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: INK }}>{t}</div>
              <div style={{ fontSize: 10, color: DIM, margin: '2px 0 3px' }}>{d}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#8fc4ec', wordBreak: 'break-all' }}>{val}</div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 8.5, letterSpacing: 1, color: 'rgba(210,220,205,.4)', paddingTop: 10 }}>TxLINE scores proof · verified against Solana oracle {(programId || '').slice(0, 8)}… · read-only, no wallet, no gas</div>
      </div>
    );
  }
  function hexToBytes(h) { const out = []; if (!h) return out; for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16)); return out; }
  function clockLabel(st) {
    const c = st.clock || {}; const s = c.seconds != null ? c.seconds : (c.Seconds != null ? c.Seconds : null);
    if (s == null) return st.statusLabel || '—';
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${st.statusLabel || ''}`.trim();
  }
  function scoreLabel(st) {
    const sc = st.score;
    if (sc && typeof sc === 'object' && sc.participant1 != null) return `${sc.participant1}–${sc.participant2}`;
    if (Array.isArray(sc)) return `${sc[0]}–${sc[1]}`;
    const s1 = st.raw && st.raw.Stats ? st.raw.Stats['1'] : null;
    const s2 = st.raw && st.raw.Stats ? st.raw.Stats['2'] : null;
    return s1 != null ? `${s1}–${s2}` : '0–0';
  }

  function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const Muted = ({ children }) => <div style={{ color: DIM, fontSize: 11, padding: '18px 4px', textAlign: 'center' }}>{children}</div>;
  const Row = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${LINE}` }}><span style={{ fontSize: 10, letterSpacing: 1, color: DIM }}>{k}</span><span style={{ fontFamily: MONO, fontSize: 12, color: INK, textAlign: 'right' }}>{v}</span></div>;

  // ── share helpers (robust across form factors / non-secure LAN origins) ────
  // The main diorama is the largest canvas (a desktop build also has the tiny
  // sparkline canvas); pick by area so the poster never grabs the wrong one.
  function mainCanvas() {
    let best = null, area = 0;
    for (const c of document.querySelectorAll('canvas')) { const a = (c.width || 0) * (c.height || 0); if (a > area) { area = a; best = c; } }
    return best;
  }
  // clipboard write fails on a LAN http:// origin (Clipboard API is secure-context
  // only) — fall back to a hidden textarea + execCommand so copy still works there.
  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.left = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch (_) { return false; }
  }
  // toBlob + object URL downloads far more reliably than a multi-MB data: URL anchor
  // (Safari/iOS especially); dataURL is the last-ditch fallback.
  function saveImage(canvas, name) {
    return new Promise((resolve) => {
      const go = (href, revoke) => { const a = document.createElement('a'); a.download = name; a.href = href; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); if (revoke) setTimeout(() => URL.revokeObjectURL(href), 4000); resolve(true); };
      try { canvas.toBlob((blob) => { blob ? go(URL.createObjectURL(blob), true) : go(canvas.toDataURL('image/png'), false); }, 'image/png'); }
      catch (_) { try { go(canvas.toDataURL('image/png'), false); } catch (e) { resolve(false); } }
    });
  }

  // ── share sheet ───────────────────────────────────────────────────────────
  function ShareSheet({ onClose, room, onCreateRoom, onJoinRoom }) {
    const [copied, setCopied] = useState(null);
    const [invCopied, setInvCopied] = useState(null);
    const [joinCode, setJoinCode] = useState('');
    const url = B().shareUrl ? B().shareUrl() : location.href;
    const inviteUrl = room ? `${url}${url.includes('?') ? '&' : '?'}room=${room.code}` : null;
    const [posterMsg, setPosterMsg] = useState(null);
    const copyText = async (text, setter) => {
      let ok = false;
      try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (_) {}
      if (!ok) ok = legacyCopy(text);
      setter(ok ? 'COPIED ✓' : 'COPY FAILED — LONG-PRESS LINK');
      setTimeout(() => setter(null), ok ? 1600 : 2800);
    };
    const doCopy = () => copyText(url, setCopied);
    const poster = async () => {
      const src = mainCanvas();
      if (!src) return;
      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        const st = B().getState ? B().getState() : {};
        const id = st.ident || (B().getIdent && B().getIdent()) || {};
        const f = st.frame || (B().getFrame && B().getFrame()) || {};
        const meta = (B().getMeta && B().getMeta()) || {};
        const score = f.score || meta.finalScore || { home: 0, away: 0 };
        const prob = f.prob || { home: 33.3, draw: 33.4, away: 33.3 };
        const clock = f.clock || { s: 0, phase: 'FT' };
        const ha = id.homeAbbr || 'HOME', aa = id.awayAbbr || 'AWAY';
        const W = 1200, imgH = 1040, bandH = 380, H = imgH + bandH;
        const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
        const g = oc.getContext('2d');
        g.fillStyle = '#070b08'; g.fillRect(0, 0, W, H);
        // diorama, cover-fit into the top area
        const sr = src.width / src.height, tr = W / imgH; let dw, dh, dx, dy;
        if (sr > tr) { dh = imgH; dw = imgH * sr; dx = (W - dw) / 2; dy = 0; } else { dw = W; dh = W / sr; dx = 0; dy = (imgH - dh) / 2; }
        g.drawImage(src, dx, dy, dw, dh);
        const grad = g.createLinearGradient(0, imgH - 220, 0, imgH + 20);
        grad.addColorStop(0, 'rgba(7,11,8,0)'); grad.addColorStop(1, '#070b08');
        g.fillStyle = grad; g.fillRect(0, imgH - 220, W, 240);
        g.textAlign = 'center';
        g.fillStyle = GOLD; g.font = '700 34px "Barlow Condensed", sans-serif';
        g.fillText('T H E   P R O B A B I L I T Y   B A T T L E F I E L D', W / 2, imgH + 64);
        g.fillStyle = 'rgba(210,220,205,.5)'; g.font = '500 21px "IBM Plex Mono", monospace';
        g.fillText(`${(id.competition || 'WORLD CUP').toUpperCase()}  ·  ${(st.mode || 'replay').toUpperCase()}`, W / 2, imgH + 98);
        // score line
        g.font = '700 104px "Barlow Condensed", sans-serif'; g.fillStyle = '#f0f3ec';
        g.fillText(`${ha}   ${score.home} — ${score.away}   ${aa}`, W / 2, imgH + 208);
        g.fillStyle = '#e8ecdf'; g.font = '500 27px "IBM Plex Mono", monospace';
        const cl = clock.phase === 'FT' ? 'FULL TIME' : `${fmtClock(clock)} · ${clock.phase}`;
        g.fillText(cl, W / 2, imgH + 250);
        // win-probability bar (home | draw | away)
        const bx = 140, bw = W - 280, by = imgH + 282, bh = 20;
        const total = prob.home + prob.draw + prob.away || 100;
        const segs = [[prob.home / total, '#d3273e'], [prob.draw / total, 'rgba(210,220,205,.45)'], [prob.away / total, '#7ab5e8']];
        let cx = bx;
        g.save(); roundRectPath(g, bx, by, bw, bh, 10); g.clip();
        for (const [frac, col] of segs) { g.fillStyle = col; g.fillRect(cx, by, bw * frac, bh); cx += bw * frac; }
        g.restore();
        g.textAlign = 'left'; g.fillStyle = '#d3273e'; g.font = '600 19px "IBM Plex Mono", monospace';
        g.fillText(`${ha} ${Math.round(prob.home)}%`, bx, by + bh + 26);
        g.textAlign = 'center'; g.fillStyle = 'rgba(210,220,205,.6)';
        g.fillText(`DRAW ${Math.round(prob.draw)}%`, W / 2, by + bh + 26);
        g.textAlign = 'right'; g.fillStyle = '#7ab5e8';
        g.fillText(`${Math.round(prob.away)}% ${aa}`, bx + bw, by + bh + 26);
        g.textAlign = 'center'; g.fillStyle = 'rgba(143,196,236,.75)'; g.font = '600 18px "IBM Plex Mono", monospace';
        g.fillText('every troop is real, anchored TxLINE market data · proven on Solana', W / 2, H - 28);
        await saveImage(oc, `battlefield-${ha}-${aa}.png`);
        setPosterMsg('POSTER SAVED ✓'); setTimeout(() => setPosterMsg(null), 1800);
      } catch (e) {
        try { await saveImage(src, 'battlefield.png'); setPosterMsg('SAVED (raw) ✓'); }
        catch (_) { setPosterMsg('EXPORT FAILED — SCREENSHOT INSTEAD'); }
        setTimeout(() => setPosterMsg(null), 2200);
      }
    };
    return (
      <Sheet title="SHARE THE WAR" onClose={onClose}>
        <Muted>A replay link restores the exact fixture and moment. A poster-frame snapshots the terrain — scars and all.</Muted>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#8fc4ec', wordBreak: 'break-all', padding: '10px 12px', background: 'rgba(255,255,255,.03)', border: `1px solid ${LINE}`, borderRadius: 9, marginBottom: 10 }}>{url}</div>
        <button onClick={doCopy}
          style={{ width: '100%', padding: 12, marginBottom: 8, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#0d0b05', background: GOLD, border: 'none', borderRadius: 10, cursor: 'pointer' }}>{copied || 'COPY REPLAY LINK'}</button>
        <button onClick={poster} style={{ width: '100%', padding: 12, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: INK, background: 'rgba(255,255,255,.05)', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer' }}>{posterMsg || 'EXPORT POSTER FRAME (PNG)'}</button>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
          <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 2, color: DIM, marginBottom: 8 }}>PLAY LIVE WITH FRIENDS</div>
          {!room ? (
            <React.Fragment>
              <button onClick={() => onCreateRoom && onCreateRoom()} style={{ width: '100%', padding: 12, marginBottom: 8, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: '#fff', background: 'linear-gradient(90deg,#7d4fe0,#9b7de8)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="9" cy="8" r="3" /><path d="M15 8a3 3 0 100-2M3 20c0-3 3-5 6-5s6 2 6 5M15 15c3 0 6 2 6 5" /></svg>
                CREATE A ROOM
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={8} style={{ flex: 1, boxSizing: 'border-box', padding: '10px 11px', fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: INK, background: 'rgba(255,255,255,.04)', border: `1px solid ${LINE}`, borderRadius: 9, outline: 'none' }} />
                <button onClick={() => { if (joinCode && onJoinRoom) { onJoinRoom(joinCode); onClose(); } }} style={{ padding: '0 16px', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: INK, background: 'rgba(255,255,255,.05)', border: `1px solid ${LINE}`, borderRadius: 9, cursor: 'pointer' }}>JOIN</button>
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div style={{ fontFamily: MONO, fontSize: 10, color: DIM, marginBottom: 6 }}>In room <b style={{ color: GOLD }}>{room.code}</b> · {(room.members || []).length} player{(room.members || []).length === 1 ? '' : 's'}. Share the invite:</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#8fc4ec', wordBreak: 'break-all', padding: '10px 12px', background: 'rgba(255,255,255,.03)', border: `1px solid ${LINE}`, borderRadius: 9, marginBottom: 8 }}>{inviteUrl}</div>
              <button onClick={() => copyText(inviteUrl, setInvCopied)} style={{ width: '100%', padding: 12, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: '#0d0b05', background: GOLD, border: 'none', borderRadius: 10, cursor: 'pointer' }}>{invCopied || 'COPY INVITE LINK'}</button>
            </React.Fragment>
          )}
        </div>
      </Sheet>
    );
  }

  // ── wallet: real Phantom (window.phantom.solana), guest fallback ──────────
  function getPhantom() {
    try { return (window.phantom && window.phantom.solana) || (window.solana && window.solana.isPhantom ? window.solana : null); } catch { return null; }
  }
  // connect + sign-in-with-Solana (no funds, no gas). Returns the pubkey or throws.
  async function phantomSignIn() {
    const prov = getPhantom(); if (!prov) throw new Error('no-phantom');
    const resp = await prov.connect();
    const pubkey = ((resp && resp.publicKey) ? resp.publicKey : prov.publicKey).toString();
    const nonce = Math.random().toString(36).slice(2, 10);
    const msg = `The Probability Battlefield — enlist\nWallet: ${pubkey}\nDevnet · no funds move · nonce ${nonce}`;
    await prov.signMessage(new TextEncoder().encode(msg), 'utf8');
    return pubkey;
  }
  function newGuestId() { const bytes = Array.from({ length: 32 }, () => (Math.random() * 256) | 0); return base58(bytes); }
  const RANKS = [[400, 'GENERAL'], [150, 'CAPTAIN'], [50, 'SERGEANT'], [1, 'SOLDIER']];
  function rankFor(pts) { for (const [th, r] of RANKS) if (pts >= th) return r; return 'RECRUIT'; }

  function WalletSheet({ onClose, onConnect, wallet, walletKind }) {
    const rec = loadRecord();
    const acc = rec.made ? Math.round((rec.correct / rec.made) * 100) : 0;
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const phantom = getPhantom();
    const connectPhantom = async () => {
      setBusy(true); setErr(null);
      try { onConnect(await phantomSignIn(), 'phantom'); }
      catch (e) { setErr((e && (e.code === 4001 || /reject|declin/i.test(e.message || ''))) ? 'Enlistment declined' : 'Could not connect Phantom'); }
      finally { setBusy(false); }
    };
    const guest = () => onConnect(newGuestId(), 'guest');

    const Card = ({ children }) => <div style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: `1px solid ${LINE}`, borderRadius: 12, background: 'rgba(255,255,255,.03)', textAlign: 'center' }}>{children}</div>;
    const Record = () => (
      <Card>
        <div style={{ fontFamily: COND, fontSize: 22, fontWeight: 700, letterSpacing: 2, color: '#c9b6f0' }}>{rankFor(rec.pts)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {[['CALLS', rec.made], ['ACCURACY', `${acc}%`], ['POINTS', rec.pts]].map(([k, v]) => (
            <div key={k} style={{ flex: 1 }}>
              <div style={{ fontFamily: COND, fontSize: 24, fontWeight: 700, color: k === 'POINTS' ? GOLD : '#f0f3ec' }}>{v}</div>
              <div style={{ fontSize: 8, letterSpacing: 1.2, color: DIM }}>{k}</div>
            </div>
          ))}
        </div>
      </Card>
    );
    const Badge = () => (
      <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, color: '#c9b6f0', border: '1px solid rgba(155,125,232,.4)', background: 'rgba(155,125,232,.12)', padding: '4px 9px', borderRadius: 20, marginBottom: 14 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c9b6f0' }} />DEVNET · NO REAL FUNDS
      </div>
    );
    const btn = (bg, color) => ({ width: '100%', boxSizing: 'border-box', padding: 13, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color, background: bg, border: bg.startsWith('rgba') ? `1px solid ${LINE}` : 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 });
    const phantomMark = <svg width="15" height="15" viewBox="0 0 128 128" fill="currentColor"><path d="M110 64c0 25.4-20.6 46-46 46-20 0-37-12.8-43.3-30.6-.3-.9.6-1.7 1.5-1.3 3 1.3 6.3 2 9.8 2 8 0 13-4.7 13-12.3V56c0-9.4 7.6-17 17-17s17 7.6 17 17v2c0 2.2 1.8 4 4 4s4-1.8 4-4v-2c0-3 2.4-5.4 5.4-5.4S102 51 102 54v10z"/></svg>;

    return (
      <Sheet title={wallet ? (walletKind === 'phantom' ? 'YOUR COMMISSION' : 'GUEST COMMISSION') : 'ENLIST'} onClose={onClose} accent="#9b7de8">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', overflowY: 'auto', padding: '2px 2px 4px' }}>
          <Badge />
          {!wallet ? (
            <React.Fragment>
              <div style={{ fontFamily: COND, fontSize: 19, fontWeight: 700, letterSpacing: 1, color: '#f0f3ec' }}>JOIN THE CAMPAIGN</div>
              <div style={{ fontSize: 10.5, color: DIM, margin: '4px 0 16px', maxWidth: 280, lineHeight: 1.45 }}>Sign in with Solana to save your rank.</div>
              {phantom ? (
                <button onClick={connectPhantom} disabled={busy} style={btn('linear-gradient(90deg,#7d4fe0,#9b7de8)', '#fff')}>{phantomMark}{busy ? 'CHECK PHANTOM…' : 'CONNECT PHANTOM'}</button>
              ) : (
                <a href="https://phantom.app/download" target="_blank" rel="noopener" style={{ width: '100%', textDecoration: 'none' }}>
                  <button style={btn('linear-gradient(90deg,#7d4fe0,#9b7de8)', '#fff')}>{phantomMark}GET PHANTOM</button>
                </a>
              )}
              {err && <div style={{ fontSize: 10, color: '#e88a8a', marginTop: 8 }}>{err}</div>}
              <button onClick={guest} style={{ marginTop: 10, background: 'none', border: 'none', color: DIM, fontFamily: MONO, fontSize: 10, letterSpacing: 1, cursor: 'pointer', textDecoration: 'underline' }}>or continue as guest</button>
              <div style={{ height: 14 }} />
              <Record />
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: walletKind === 'phantom' ? '#7ed992' : DIM, marginBottom: 10 }}>
                {walletKind === 'phantom' ? <React.Fragment>{phantomMark}PHANTOM · SIGNED IN</React.Fragment> : 'GUEST IDENTITY'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: INK, letterSpacing: .5 }}>{wallet.slice(0, 4)}…{wallet.slice(-4)}</div>
              <div style={{ height: 14 }} />
              <Record />
              <button onClick={() => onConnect(null)} style={{ ...btn('rgba(255,255,255,.05)', INK), marginTop: 12 }}>{walletKind === 'phantom' ? 'DISCONNECT' : 'CLEAR GUEST ID'}</button>
            </React.Fragment>
          )}
        </div>
      </Sheet>
    );
  }
  function base58(bytes) {
    const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
    let s = ''; while (n > 0n) { s = A[Number(n % 58n)] + s; n = n / 58n; } return s || '1';
  }

  // ── predict-along (compact corner war-drum) ────────────────────────────────
  // A danger spell fires a RAID prompt: call goal / corner / nothing. Log-scored vs
  // the market's implied chance; consecutive correct calls build a streak multiplier.
  // Compact + corner-anchored so it never covers the centre of the diorama; a visible
  // countdown auto-dismisses it (no penalty) if you don't answer.
  const RAID_SECS = 11;
  function PredictAlong({ wallet, side }) {
    const [prompt, setPrompt] = useState(null);   // { threatSide, outcome, marketProb }
    const [result, setResult] = useState(null);    // { correct, outcome, pts, total, streak, mult }
    const [count, setCount] = useState(0);
    const cool = useRef(0); const promptRef = useRef(null); const frameRef = useRef(null);
    const board = useRef(loadBoard()); const timer = useRef(null); const tick = useRef(null);

    const clear = () => { clearInterval(tick.current); clearTimeout(timer.current); };
    const dismiss = () => { promptRef.current = null; setPrompt(null); clear(); };
    useEffect(() => { if (B().subscribe) return B().subscribe((s) => { frameRef.current = s.frame; }); }, []);
    useEffect(() => {
      if (!B().onEvent) return;
      return B().onEvent((e) => {
        if (e.kind !== 'predict_prompt') return;
        if (promptRef.current || Date.now() < cool.current) return;
        const mp = e.momentum ? a2pMom(e.momentum[e.side]) : (frameRef.current ? a2p(frameRef.current, e.side) : 0.3);
        const p = { threatSide: e.side, outcome: e.outcome, marketProb: mp };
        promptRef.current = p; setPrompt(p); setCount(RAID_SECS);
        cool.current = Date.now() + 16000;
        clear();
        tick.current = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
        timer.current = setTimeout(dismiss, RAID_SECS * 1000);
      });
    }, []);
    useEffect(() => () => clear(), []);

    const answer = (choice) => {
      const p = promptRef.current; dismiss();
      if (!p) return;
      const outcome = p.outcome, correct = choice === outcome;
      const pMarket = outcome === 'goal' ? p.marketProb : outcome === 'corner' ? 0.15 : (1 - p.marketProb);
      const base = correct ? Math.max(4, Math.round(-Math.log2(Math.max(0.03, pMarket)) * 10)) : -8;
      const prev = loadRecord();
      const streak = correct ? (prev.streak || 0) + 1 : 0;
      const mult = correct ? streakMult(streak) : 1;
      const gain = correct ? Math.round(base * mult) : -8;
      board.current = addScore(board.current, wallet, gain);
      bumpRecord(correct, gain, streak);
      const total = board.current[wallet ? wallet.slice(0, 6) : 'you'] || 0;
      setResult({ correct, outcome, pts: gain, total, streak, mult });
      setTimeout(() => setResult(null), 4200);
    };

    if (!prompt && !result) return null;
    const id = (B().getIdent && B().getIdent()) || {};
    const yours = side && prompt && prompt.threatSide === side;
    const threatName = prompt ? (prompt.threatSide === 'home' ? (id.homeAbbr || 'HOME') : (id.awayAbbr || 'AWAY')) : '';
    // desktop: right-middle, clearing the stats (bottom-left) + war-feed (bottom-right) columns.
    const isDesktop = typeof matchMedia !== 'undefined' && matchMedia('(min-width:1024px)').matches;
    const wrapPos = isDesktop ? { right: 20, top: '36%', width: 220 } : { right: 10, bottom: 'calc(env(safe-area-inset-bottom) + 150px)', width: 206 };
    return (
      <div style={{ position: 'fixed', ...wrapPos, zIndex: 47, pointerEvents: 'auto' }}>
        {prompt && (
          <div style={{ background: 'rgba(20,12,6,.95)', border: '1px solid rgba(211,171,72,.5)', borderRadius: 13, padding: '10px 11px', WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 34px rgba(0,0,0,.55)', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5L21 18v3h-3L6.5 9.5" /></svg>
              <span style={{ flex: 1, fontFamily: COND, fontSize: 14, fontWeight: 700, letterSpacing: 1.5, color: GOLD }}>RAID{yours ? ' · YOURS' : ''}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: count <= 3 ? '#e88a8a' : DIM }}>{count}s</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 8 }}>
              <span style={{ fontFamily: COND, fontSize: 25, fontWeight: 700, color: INK, lineHeight: 1 }}>{Math.round(prompt.marketProb * 100)}%</span>
              <span style={{ fontSize: 8, color: DIM, letterSpacing: 1, lineHeight: 1.2 }}>MARKET GOAL<br />CHANCE · {threatName}</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[['goal', 'GOAL'], ['corner', 'COR'], ['nothing', 'NONE']].map(([k, l]) => (
                <button key={k} onClick={() => answer(k)} style={{ flex: 1, padding: '9px 2px', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: .5, borderRadius: 8, cursor: 'pointer', color: INK, border: '1px solid rgba(211,171,72,.35)', background: 'rgba(211,171,72,.12)' }}>{l}</button>
              ))}
            </div>
            <div style={{ height: 3, marginTop: 8, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(count / RAID_SECS) * 100}%`, background: GOLD, transition: 'width 1s linear' }} /></div>
          </div>
        )}
        {result && (
          <div style={{ background: result.correct ? 'rgba(10,30,14,.95)' : 'rgba(30,12,12,.95)', border: `1px solid ${result.correct ? 'rgba(126,217,146,.5)' : 'rgba(232,138,138,.5)'}`, borderRadius: 13, padding: '10px 12px', animation: 'sheetUp .3s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: COND, fontSize: 16, fontWeight: 700, letterSpacing: 1, color: result.correct ? '#a8e8ba' : '#f0b0b0' }}>{result.correct ? 'RIGHT' : 'WRONG'}</span>
              <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: result.correct ? '#7ed992' : '#e88a8a' }}>{result.pts > 0 ? '+' : ''}{result.pts}</span>
            </div>
            <div style={{ fontSize: 8.5, color: DIM, letterSpacing: .5, marginTop: 2 }}>it was {result.outcome.toUpperCase()} · {result.total} PTS</div>
            {result.correct && result.streak >= 2 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '2px 7px', borderRadius: 20, background: 'rgba(211,171,72,.16)', border: '1px solid rgba(211,171,72,.4)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill={GOLD}><path d="M12 2c1 3 4 4 4 8a4 4 0 01-8 0c0-1 .5-2 1-2.5C9 8 12 6 12 2z" /></svg>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: GOLD }}>STREAK ×{result.streak} · {result.mult.toFixed(2)}×</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── campaign HUD chip (points + streak + your side) ────────────────────────
  function CampaignHUD({ side, onPickSide }) {
    const snap = useSnap();
    const [rec, setRec] = useState(loadRecord);
    useEffect(() => { const on = (e) => setRec(e.detail || loadRecord()); window.addEventListener('bf-record', on); return () => window.removeEventListener('bf-record', on); }, []);
    if (snap.mode === 'sandbox' || snap.mode === 'synthetic') return null;
    const id = snap.ident || {};
    const sideName = side === 'home' ? (id.homeAbbr || 'HOME') : side === 'away' ? (id.awayAbbr || 'AWAY') : null;
    return (
      <div style={{ position: 'fixed', left: 10, top: 'calc(env(safe-area-inset-top) + 52px)', zIndex: 43, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 9, border: `1px solid ${LINE}`, background: PANEL, WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round"><path d="M12 2l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 9l6-1z" /></svg>
          <span style={{ fontFamily: COND, fontSize: 18, fontWeight: 700, color: '#f0f3ec', lineHeight: 1 }}>{rec.pts}</span>
          <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.5, color: DIM }}>PTS</span>
          {rec.streak >= 2 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 1 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill={GOLD}><path d="M12 2c1 3 4 4 4 8a4 4 0 01-8 0c0-1 .5-2 1-2.5C9 8 12 6 12 2z" /></svg>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: GOLD }}>{rec.streak}</span>
            </span>
          )}
        </div>
        <button onClick={onPickSide} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 7, border: `1px solid ${LINE}`, background: PANEL, cursor: 'pointer', WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}>
          <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1, color: DIM }}>FIGHTING FOR</span>
          {sideName ? <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: side === 'home' ? '#e88a8a' : '#7ab5e8' }}>{sideName}</span> : <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: GOLD }}>PICK ›</span>}
        </button>
      </div>
    );
  }

  // ── pick a side ────────────────────────────────────────────────────────────
  function SidePick({ onPick, onClose }) {
    const snap = useSnap();
    const id = snap.ident || {};
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 82, display: 'grid', placeItems: 'center' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,3,.62)', animation: 'fadeIn .2s both' }} />
        <div style={{ position: 'relative', width: 'min(360px, 90vw)', background: PANEL, border: `1px solid ${LINE}`, borderRadius: 16, padding: '18px 16px', textAlign: 'center', animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1) both', WebkitBackdropFilter: 'blur(16px)', backdropFilter: 'blur(16px)' }}>
          <div style={{ fontFamily: COND, fontSize: 21, fontWeight: 700, letterSpacing: 2, color: '#f0f3ec' }}>WHOSE SIDE?</div>
          <div style={{ fontSize: 10, color: DIM, margin: '4px 0 16px' }}>Pick the army you fight for.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['home', id.homeNation, id.homeAbbr, '#d3273e'], ['away', id.awayNation, id.awayAbbr, '#7ab5e8']].map(([s, nation, abbr, col]) => (
              <button key={s} onClick={() => onPick(s)} style={{ flex: 1, padding: '14px 8px', borderRadius: 12, border: `1px solid ${col}66`, background: `${col}18`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
                <Flag name={nation || (s === 'home' ? 'England' : 'Argentina')} w={42} />
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: INK }}>{abbr || (s === 'home' ? 'HOME' : 'AWAY')}</span>
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ marginTop: 14, background: 'none', border: 'none', color: DIM, fontFamily: MONO, fontSize: 9, letterSpacing: 1, cursor: 'pointer', textDecoration: 'underline' }}>just watching</button>
        </div>
      </div>
    );
  }
  // implied P(goal in spell) proxy: momentum of the threatening side scaled into a plausible band
  function a2p(f, side) { const m = (f.momentum && f.momentum[side]) || 0.4; return a2pMom(m); }
  function a2pMom(m) { return Math.min(0.6, Math.max(0.12, 0.12 + (m || 0.4) * 0.5)); }
  function loadBoard() { try { return JSON.parse(localStorage.getItem('bf_board') || '{}'); } catch { return {}; } }
  function addScore(board, wallet, pts) { const k = wallet ? wallet.slice(0, 6) : 'you'; board[k] = (board[k] || 0) + pts; try { localStorage.setItem('bf_board', JSON.stringify(board)); } catch {} return board; }
  function loadRecord() { try { const r = JSON.parse(localStorage.getItem('bf_record') || '{}'); return { made: r.made || 0, correct: r.correct || 0, pts: r.pts || 0, streak: r.streak || 0, best: r.best || 0 }; } catch { return { made: 0, correct: 0, pts: 0, streak: 0, best: 0 }; } }
  function bumpRecord(correct, pts, streak) {
    const r = loadRecord(); r.made++; if (correct) r.correct++; r.pts += pts; r.streak = streak; r.best = Math.max(r.best, streak);
    try { localStorage.setItem('bf_record', JSON.stringify(r)); } catch {}
    try { window.dispatchEvent(new CustomEvent('bf-record', { detail: r })); } catch {}
    return r;
  }
  // multiplier grows with the streak, modestly, capped at 2x
  function streakMult(streak) { return 1 + Math.min(Math.max(0, streak - 1), 4) * 0.25; }
  // which side you fight for (persists across fixtures; home|away)
  function loadSide() { try { return localStorage.getItem('bf_side') || null; } catch { return null; } }
  function saveSide(s) { try { s ? localStorage.setItem('bf_side', s) : localStorage.removeItem('bf_side'); } catch {} try { window.dispatchEvent(new CustomEvent('bf-side', { detail: s })); } catch {} }

  // which threat flare (if any) is lit on the diorama right now
  function flareOf(threat) {
    const t = threat || {};
    for (const side of ['home', 'away']) {
      const s = t[side] || {};
      if (s.goal) return { side, event: 'goal' };
      if (s.penalty) return { side, event: 'penalty' };
      if (s.corner) return { side, event: 'corner' };
    }
    const n = t.neutral || {};
    if (n.var) return { side: 'neutral', event: 'var' };
    if (n.redCard) return { side: 'neutral', event: 'redCard' };
    if (n.yellowCard) return { side: 'neutral', event: 'yellowCard' };
    return null;
  }

  // ── every-pixel-inspectable overlay: tap the flare / fog / frontline ────────
  // Small hit targets over the live diorama that each open the SAME inspect sheet
  // with the real payload behind that pixel. Kept tiny so the engine's own camera
  // orbit (drag anywhere else on the canvas) still works; the frontline also
  // responds to a long-press (desktop: click the FRONT chip).
  function InspectHotspots({ onInspect, mode }) {
    const snap = useSnap();
    const f = snap.frame;
    const openFront = useCallback(() => { const fr = B().getFrame && B().getFrame(); if (!fr) return; onInspect({ kind: 'frontline', prob: fr.prob, front: fr.front, ts: B().headTs ? B().headTs() : 0 }); }, [onInspect]);
    const openFog = useCallback(() => {
      const ts = B().headTs ? B().headTs() : 0; const m = B().getModel && B().getModel();
      const w = m && m.inSuspension ? m.inSuspension(ts) : null;
      const g = (w && m) ? { startSec: m.displayClock(w.goalTs != null ? w.goalTs : w.start).sec, endSec: m.displayClock(w.end).sec, durMs: w.end - (w.goalTs != null ? w.goalTs : w.start) } : {};
      onInspect({ kind: 'fog', ts, gap: g });
    }, [onInspect]);
    const openFlare = useCallback(() => { const fr = B().getFrame && B().getFrame(); const fl = fr && flareOf(fr.threat); if (!fl) return; onInspect({ kind: 'flare', side: fl.side, event: fl.event, ts: B().headTs ? B().headTs() : 0 }); }, [onInspect]);
    // long-press the trench (the canvas) → frontline odds; a drag = camera orbit, left alone.
    useEffect(() => {
      if (mode === 'sandbox' || mode === 'synthetic') return;
      const cv = mainCanvas(); if (!cv) return;
      let t = null, sx = 0, sy = 0, moved = false;
      const down = (e) => { sx = e.clientX; sy = e.clientY; moved = false; clearTimeout(t); t = setTimeout(() => { if (!moved) openFront(); }, 480); };
      const move = (e) => { if (!moved && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)) { moved = true; clearTimeout(t); } };
      const up = () => clearTimeout(t);
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      return () => { clearTimeout(t); cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); };
    }, [mode, openFront]);
    if (mode === 'sandbox' || mode === 'synthetic' || !f) return null;
    const suspended = f.market && f.market.suspended;
    const flare = flareOf(f.threat);
    const ha = (snap.ident && snap.ident.homeAbbr) || 'HOME', aa = (snap.ident && snap.ident.awayAbbr) || 'AWAY';
    const flareTop = flare ? (flare.side === 'home' ? '64%' : flare.side === 'away' ? '29%' : '46%') : null;
    const chip = { position: 'fixed', zIndex: 43, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: MONO, fontWeight: 700, WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' };
    return (
      <React.Fragment>
        {!suspended && (
          <button onClick={openFront} aria-label="Inspect the frontline odds" style={{ ...chip, left: 12, top: '50%', transform: 'translateY(-50%)', padding: '7px 10px', borderRadius: 9, border: `1px solid ${LINE}`, background: PANEL, color: INK, fontSize: 9.5, letterSpacing: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8fc4ec" strokeWidth="2"><circle cx="12" cy="12" r="8" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
            {ha} {(f.prob.home || 0).toFixed(0)}%
          </button>
        )}
        {suspended && (
          <button onClick={openFog} aria-label="Inspect the suspension" style={{ ...chip, left: '50%', top: '42%', transform: 'translateX(-50%)', padding: '8px 13px', borderRadius: 10, border: '1px solid rgba(211,171,72,.5)', background: 'rgba(8,12,8,.85)', color: GOLD, fontSize: 10, letterSpacing: 1.5, animation: 'pulseGold 1.4s infinite' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round"><path d="M3 8h18M3 12h18M3 16h13" /></svg>
            MARKET DARK · TAP TO INSPECT
          </button>
        )}
        {flare && (
          <button onClick={openFlare} aria-label="Inspect the threat flare" style={{ ...chip, left: '50%', top: flareTop, transform: 'translateX(-50%)', padding: '6px 11px', borderRadius: 20, border: '1px solid rgba(211,171,72,.55)', background: 'rgba(20,14,6,.85)', color: GOLD, fontSize: 9, letterSpacing: 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>
            {flare.side === 'neutral' ? 'FLARE' : (flare.side === 'home' ? ha : aa)} · TAP
          </button>
        )}
      </React.Fragment>
    );
  }

  // ── home / landing ─────────────────────────────────────────────────────────
  function Home({ wallet, walletKind, onConnect, onEnter }) {
    const phantom = getPhantom();
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(null);
    const connect = async () => {
      setBusy(true); setErr(null);
      try { onConnect(await phantomSignIn(), 'phantom'); }
      catch (e) { setErr(e && e.message === 'no-phantom' ? null : 'Enlistment declined'); }
      finally { setBusy(false); }
    };
    const primary = { width: 'min(320px,90vw)', boxSizing: 'border-box', padding: 13, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#fff', background: 'linear-gradient(90deg,#7d4fe0,#9b7de8)', border: 'none', borderRadius: 11, cursor: 'pointer' };
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'radial-gradient(120% 85% at 50% 0%, #0d150f, #070b08 62%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', animation: 'fadeIn .4s both' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 8.5, letterSpacing: 2.5, color: GOLD, marginBottom: 16, border: '1px solid rgba(211,171,72,.35)', borderRadius: 20, padding: '4px 11px' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD }} />DEVNET · LIVE TxLINE MARKET DATA
        </div>
        <div style={{ fontFamily: COND, fontSize: 'min(13.5vw,56px)', fontWeight: 700, letterSpacing: 3, color: '#f6f8f1', lineHeight: .96, textTransform: 'uppercase' }}>The Probability<br />Battlefield</div>
        <div style={{ fontSize: 12, color: DIM, margin: '15px 0 30px', maxWidth: 330, lineHeight: 1.5 }}>Every World Cup match as a live war between two armies — driven by the de-margined market, provable on Solana.</div>
        {wallet ? (
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#7ed992', marginBottom: 18, letterSpacing: 1 }}>{walletKind === 'phantom' ? 'PHANTOM · SIGNED IN' : 'GUEST'} · {wallet.slice(0, 4)}…{wallet.slice(-4)}</div>
        ) : (
          <div style={{ width: 'min(320px,90vw)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, marginBottom: 18 }}>
            {phantom
              ? <button onClick={connect} disabled={busy} style={primary}>{busy ? 'CHECK PHANTOM…' : 'CONNECT PHANTOM'}</button>
              : <a href="https://phantom.app/download" target="_blank" rel="noopener" style={{ width: '100%', textDecoration: 'none' }}><button style={primary}>GET PHANTOM</button></a>}
            <button onClick={() => onConnect(newGuestId(), 'guest')} style={{ background: 'none', border: 'none', color: DIM, fontFamily: MONO, fontSize: 10, letterSpacing: 1, cursor: 'pointer', textDecoration: 'underline' }}>continue as guest</button>
            {err && <div style={{ fontSize: 10, color: '#e88a8a' }}>{err}</div>}
          </div>
        )}
        <button onClick={onEnter} style={{ width: 'min(320px,90vw)', boxSizing: 'border-box', padding: 15, fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: 2, color: '#0d0b05', background: GOLD, border: 'none', borderRadius: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>CHOOSE YOUR BATTLE →</button>
      </div>
    );
  }

  // ── first-time micro-onboarding (3 tips, skippable, seen once) ─────────────
  const TIPS = [
    ['ORBIT', 'Drag the battlefield to rotate the camera around the pitch.'],
    ['PREDICT', 'When the war-drum sounds, call the raid — beat the market for points & streaks.'],
    ['VERIFY', 'Tap the front, a flare, or VERIFY — every tick is provable on Solana.'],
  ];
  function OnboardingTips({ onDone }) {
    const [i, setI] = useState(0);
    const done = () => { try { localStorage.setItem('bf_onboarded', '1'); } catch {} onDone(); };
    const next = () => { if (i >= TIPS.length - 1) done(); else setI(i + 1); };
    const [tag, body] = TIPS[i];
    return (
      <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 200px)', zIndex: 48, display: 'flex', justifyContent: 'center', pointerEvents: 'auto' }}>
        <div style={{ width: 'min(360px,100%)', background: 'rgba(9,13,10,.97)', border: `1px solid ${LINE}`, borderRadius: 13, padding: '12px 14px', WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)', animation: 'sheetUp .3s both', boxShadow: '0 10px 34px rgba(0,0,0,.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: 1.5, color: GOLD }}>{i + 1}/{TIPS.length}</span>
            <span style={{ fontFamily: COND, fontSize: 15, fontWeight: 700, letterSpacing: 1.5, color: '#f0f3ec' }}>{tag}</span>
          </div>
          <div style={{ fontSize: 11, color: DIM, lineHeight: 1.45, marginBottom: 10 }}>{body}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={done} style={{ background: 'none', border: 'none', color: DIM, fontFamily: MONO, fontSize: 9.5, letterSpacing: 1, cursor: 'pointer' }}>SKIP</button>
            <button onClick={next} style={{ padding: '6px 14px', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#0d0b05', background: GOLD, border: 'none', borderRadius: 8, cursor: 'pointer' }}>{i >= TIPS.length - 1 ? 'GOT IT' : 'NEXT'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── friend rooms (real-time, C10) ──────────────────────────────────────────
  // WebSocket to the :4490 sidecar via the same-origin /rooms proxy. We broadcast
  // our side + running record; the server fans the sorted roster back to everyone.
  function roomIdentity(wallet) {
    let id = wallet;
    if (!id) { try { id = localStorage.getItem('bf_guest_room_id'); } catch {} if (!id) { id = 'g' + Math.random().toString(36).slice(2, 8); try { localStorage.setItem('bf_guest_room_id', id); } catch {} } }
    const name = wallet ? (wallet.slice(0, 4) + '…' + wallet.slice(-4)) : ('GUEST-' + id.slice(-3).toUpperCase());
    return { id, name };
  }
  function useRooms(wallet, side) {
    const [room, setRoom] = useState(null); // { code, status:'connecting'|'online'|'offline', members:[] }
    const wsRef = useRef(null); const idRef = useRef(null); const sideRef = useRef(side);
    useEffect(() => { sideRef.current = side; }, [side]);
    const send = (obj) => { const ws = wsRef.current; if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch {} } };
    const join = useCallback((rawCode) => {
      const code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (!code) return;
      try { wsRef.current && wsRef.current.close(); } catch {}
      setRoom({ code, status: 'connecting', members: [] });
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      let ws; try { ws = new WebSocket(`${proto}//${location.host}/rooms`); } catch (e) { setRoom({ code, status: 'offline', members: [] }); return; }
      wsRef.current = ws;
      const { id, name } = roomIdentity(wallet); idRef.current = id;
      ws.onopen = () => { const rec = loadRecord(); const st = B().getState ? B().getState() : {}; send({ type: 'join', room: code, fixtureId: st.fixtureId, id, name, side: sideRef.current, pts: rec.pts, streak: rec.streak, correct: rec.correct, made: rec.made }); };
      ws.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m.type === 'roster') setRoom({ code: m.room, members: m.members || [], status: 'online' }); } catch {} };
      ws.onerror = () => setRoom((r) => r ? { ...r, status: 'offline' } : { code, status: 'offline', members: [] });
      ws.onclose = () => setRoom((r) => (r && r.code === code) ? { ...r, status: 'offline' } : r);
      try { const u = new URL(location.href); u.searchParams.set('room', code); history.replaceState(null, '', u); } catch {}
    }, [wallet]);
    const leave = useCallback(() => { try { wsRef.current && wsRef.current.close(); } catch {} wsRef.current = null; setRoom(null); try { const u = new URL(location.href); u.searchParams.delete('room'); history.replaceState(null, '', u); } catch {} }, []);
    const create = useCallback(() => { const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join(''); join(code); return code; }, [join]);
    // fan our own record/side changes to the room
    useEffect(() => {
      const onRec = (e) => { const r = e.detail || loadRecord(); send({ type: 'update', pts: r.pts, streak: r.streak, correct: r.correct, made: r.made }); };
      const onSide = (e) => send({ type: 'update', side: e.detail });
      window.addEventListener('bf-record', onRec); window.addEventListener('bf-side', onSide);
      return () => { window.removeEventListener('bf-record', onRec); window.removeEventListener('bf-side', onSide); };
    }, []);
    useEffect(() => () => { try { wsRef.current && wsRef.current.close(); } catch {} }, []);
    return { room, join, leave, create, myId: () => idRef.current };
  }

  function RoomPanel({ room, myId, onLeave }) {
    if (!room) return null;
    const offline = room.status === 'offline';
    const me = myId();
    const flame = (n) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><svg width="9" height="9" viewBox="0 0 24 24" fill={GOLD}><path d="M12 2c1 3 4 4 4 8a4 4 0 01-8 0c0-1 .5-2 1-2.5C9 8 12 6 12 2z" /></svg><span style={{ fontSize: 8, fontWeight: 700, color: GOLD }}>{n}</span></span>;
    return (
      <div style={{ position: 'fixed', right: 10, top: 'calc(env(safe-area-inset-top) + 52px)', zIndex: 44, width: 172, pointerEvents: 'auto' }}>
        <div style={{ background: PANEL, border: `1px solid ${offline ? 'rgba(232,138,138,.4)' : LINE}`, borderRadius: 11, padding: '8px 10px', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2"><circle cx="9" cy="8" r="3" /><path d="M15 8a3 3 0 100-2M3 20c0-3 3-5 6-5s6 2 6 5M15 15c3 0 6 2 6 5" /></svg>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: INK }}>ROOM {room.code}</span>
            <div style={{ flex: 1 }} />
            <button onClick={onLeave} aria-label="Leave room" style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${LINE}`, background: 'rgba(255,255,255,.05)', color: DIM, cursor: 'pointer', fontSize: 9, lineHeight: 1, padding: 0 }}>✕</button>
          </div>
          {offline ? (
            <div style={{ fontSize: 8.5, color: '#e8c98a', letterSpacing: .5 }}>rooms offline · playing solo</div>
          ) : (room.members && room.members.length) ? (
            room.members.slice(0, 6).map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderTop: i ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: DIM, width: 10 }}>{i + 1}</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', background: m.side === 'home' ? '#e88a8a' : m.side === 'away' ? '#7ab5e8' : 'rgba(255,255,255,.3)' }} />
                <span style={{ flex: 1, fontFamily: MONO, fontSize: 9.5, fontWeight: m.id === me ? 700 : 500, color: m.id === me ? GOLD : INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                {m.streak >= 2 && flame(m.streak)}
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: m.id === me ? GOLD : INK }}>{m.pts}</span>
              </div>
            ))
          ) : <div style={{ fontSize: 8.5, color: DIM }}>{room.status === 'connecting' ? 'connecting…' : 'waiting for players…'}</div>}
        </div>
      </div>
    );
  }

  // ── root ──────────────────────────────────────────────────────────────────
  // The creator overlay route (?overlay=1) shows ONLY the diorama + score strip
  // (rendered by index.html) — no console chrome, no interactions.
  const IS_OVERLAY = (() => { try { return new URLSearchParams(location.search).get('overlay') === '1'; } catch { return false; } })();
  function BattleConsole() {
    if (IS_OVERLAY) return null;
    const [ready, setReady] = useState(!!window.BATTLE);
    const [sheet, setSheet] = useState(null);
    const [inspectSubject, setInspectSubject] = useState(null);
    const [wallet, setWallet] = useState(() => { try { return localStorage.getItem('bf_wallet') || null; } catch { return null; } });
    const [walletKind, setWalletKind] = useState(() => { try { return localStorage.getItem('bf_wallet_kind') || 'guest'; } catch { return 'guest'; } });
    const [mode, setMode] = useState('replay');
    const [side, setSide] = useState(loadSide);
    const [showSidePick, setShowSidePick] = useState(false);
    const pickSide = (s) => { saveSide(s); setSide(s); setShowSidePick(false); try { localStorage.setItem('bf_side_prompted', '1'); } catch {} };
    // home/lobby: deep-links (?fixture=) bypass home; cold visit → hero; returning → lobby
    const hasFixtureParam = (() => { try { return new URLSearchParams(location.search).has('fixture'); } catch { return false; } })();
    const [home, setHome] = useState(() => {
      if (hasFixtureParam) { try { localStorage.setItem('bf_entered', '1'); } catch {} return null; }
      let entered = false; try { entered = !!localStorage.getItem('bf_entered'); } catch {}
      return entered ? 'lobby' : 'hero';
    });
    const [showTips, setShowTips] = useState(false);
    const enter = () => { try { localStorage.setItem('bf_entered', '1'); } catch {} setHome(null); setSheet('picker'); };
    const { room, join: joinRoom, leave: leaveRoom, create: createRoom, myId } = useRooms(wallet, side);
    const openInspect = useCallback((subject) => { setInspectSubject(subject); setSheet('inspect'); B().setPaused && B().setPaused(true); }, []);
    useEffect(() => {
      if (!ready || !B().onEvent) return;
      return B().onEvent((e) => { if (e.kind === 'inspect') openInspect({ kind: 'tick', seq: e.seq }); });
    }, [ready, openInspect]);
    const openSheet = (s) => { if (s === 'inspect') setInspectSubject({ kind: 'tick' }); setSheet(s); };
    useEffect(() => {
      if (ready) return;
      const iv = setInterval(() => { if (window.BATTLE) { clearInterval(iv); setReady(true); } }, 120);
      return () => clearInterval(iv);
    }, [ready]);
    useEffect(() => {
      if (!ready || !B().subscribe) return;
      return B().subscribe((s) => { if (s.mode && s.mode !== mode) setMode(s.mode); });
    }, [ready, mode]);
    useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') { setSheet(null); setShowSidePick(false); } };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);
    // returning visit with an identity → straight to the lobby (the picker)
    useEffect(() => { if (ready && home === 'lobby') { setSheet('picker'); setHome(null); } }, [ready, home]);
    // auto-join a room from a shared ?room= deep-link (once, after ready)
    const roomJoinedRef = useRef(false);
    useEffect(() => {
      if (!ready || roomJoinedRef.current) return;
      let code = null; try { code = new URLSearchParams(location.search).get('room'); } catch {}
      if (code) { roomJoinedRef.current = true; joinRoom(code); }
    }, [ready, joinRoom]);
    // pick-a-side once, on the first real-fixture entry with no side chosen (after home)
    useEffect(() => {
      if (!ready || home) return;
      const real = mode !== 'sandbox' && mode !== 'synthetic';
      let prompted = false; try { prompted = !!localStorage.getItem('bf_side_prompted'); } catch {}
      if (real && !side && !prompted) { const t = setTimeout(() => setShowSidePick(true), 1400); return () => clearTimeout(t); }
    }, [ready, home, mode, side]);
    // 3-tip micro-onboarding once, after home + side are out of the way
    useEffect(() => {
      if (!ready || home || sheet || showSidePick) return;
      let onboarded = false, prompted = false;
      try { onboarded = !!localStorage.getItem('bf_onboarded'); prompted = !!localStorage.getItem('bf_side_prompted'); } catch {}
      const real = mode !== 'sandbox' && mode !== 'synthetic';
      if (real && !onboarded && prompted) { const t = setTimeout(() => setShowTips(true), 900); return () => clearTimeout(t); }
    }, [ready, home, mode, sheet, showSidePick]);
    if (!ready) return null;
    const connect = (w, kind = 'guest') => {
      setWallet(w); setWalletKind(kind);
      try {
        if (w) { localStorage.setItem('bf_wallet', w); localStorage.setItem('bf_wallet_kind', kind); }
        else { localStorage.removeItem('bf_wallet'); localStorage.removeItem('bf_wallet_kind'); }
      } catch {}
    };
    return (
      <React.Fragment>
        <TopChrome onOpen={openSheet} mode={mode} wallet={wallet} />
        <CampaignHUD side={side} onPickSide={() => setShowSidePick(true)} />
        <RoomPanel room={room} myId={myId} onLeave={leaveRoom} />
        <Scrubber />
        <InspectHotspots onInspect={openInspect} mode={mode} />
        <PredictAlong wallet={wallet} side={side} />
        {showTips && !sheet && !showSidePick && <OnboardingTips onDone={() => setShowTips(false)} />}
        {showSidePick && <SidePick onPick={pickSide} onClose={() => { setShowSidePick(false); try { localStorage.setItem('bf_side_prompted', '1'); } catch {} }} />}
        {sheet === 'picker' && <FixturePicker onClose={() => setSheet(null)} />}
        {sheet === 'inspect' && <InspectSheet subject={inspectSubject} onClose={() => setSheet(null)} />}
        {sheet === 'share' && <ShareSheet onClose={() => setSheet(null)} room={room} onCreateRoom={createRoom} onJoinRoom={joinRoom} />}
        {sheet === 'wallet' && <WalletSheet onClose={() => setSheet(null)} onConnect={connect} wallet={wallet} walletKind={walletKind} />}
        {home === 'hero' && <Home wallet={wallet} walletKind={walletKind} onConnect={connect} onEnter={enter} />}
      </React.Fragment>
    );
  }

  window.BattleConsole = BattleConsole;
})();
