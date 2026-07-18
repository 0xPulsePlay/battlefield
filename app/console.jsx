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

  const fmtClock = (c) => {
    if (!c) return '—';
    const m = Math.floor(c.s / 60), sec = String(c.s % 60).padStart(2, '0');
    const mm = m > 90 && c.phase !== 'FT' ? `90+${m - 90}` : String(m);
    return `${mm}:${sec}`;
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
    const live = mode === 'live';
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: live ? '#7ed992' : GOLD, border: `1px solid ${live ? 'rgba(126,217,146,.4)' : 'rgba(211,171,72,.4)'}`, background: PANEL, borderRadius: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#7ed992' : GOLD, animation: 'blinkDot 1.6s infinite' }} />{live ? 'LIVE' : 'REPLAY'}
          </span>
          <Btn onClick={() => onOpen('inspect')} title="Verify this tick on-chain" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', height: 30, borderRadius: 10, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#8fc4ec' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8fc4ec" strokeWidth="2"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></svg>VERIFY
          </Btn>
          <Btn onClick={() => onOpen('share')} title="Share this moment" style={{ width: 34, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          </Btn>
          <button onClick={() => onOpen('wallet')} title={wallet ? 'Wallet · devnet' : 'Sign in with Solana'} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 9px', height: 30, boxSizing: 'border-box', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: wallet ? '#7ed992' : DIM, border: `1px solid ${wallet ? 'rgba(126,217,146,.4)' : LINE}`, background: PANEL, borderRadius: 10, cursor: 'pointer' }}>
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
    const wasPlaying = useRef(true);
    const prog = drag != null ? drag : (snap.progress || 0);
    const f = snap.frame;
    const speed = snap.speed || 1;
    const seek = (p) => { B().seekProgress && B().seekProgress(p); };
    return (
      <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 70px)', zIndex: 44, pointerEvents: 'auto' }}>
        <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: '8px 12px 9px', WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => B().togglePlay && B().togglePlay()} style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: 'rgba(255,255,255,.05)', color: INK, cursor: 'pointer', fontFamily: MONO, fontSize: 12 }}>{snap.playing === false ? '▶' : '❚❚'}</button>
            <span style={{ flex: '0 0 auto', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: INK, minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>{fmtClock(f && f.clock)}</span>
            <span style={{ flex: '0 0 auto', fontSize: 8.5, fontWeight: 700, letterSpacing: 1, color: DIM }}>{f && f.clock ? f.clock.phase : ''}</span>
            <input type="range" min="0" max="1000" value={Math.round(prog * 1000)} aria-label="Match timeline"
              onPointerDown={() => { wasPlaying.current = snap.playing !== false; B().setPaused && B().setPaused(true); }}
              onChange={(e) => { const p = +e.target.value / 1000; setDrag(p); seek(p); }}
              onPointerUp={() => { setDrag(null); if (wasPlaying.current) B().setPaused && B().setPaused(false); }}
              style={{ flex: 1, accentColor: GOLD, height: 4, cursor: 'pointer' }} />
            <button onClick={() => { const nx = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; B().setSpeed && B().setSpeed(nx); }}
              style={{ flex: '0 0 auto', minWidth: 34, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: 'rgba(255,255,255,.05)', color: INK, cursor: 'pointer', fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>{speed}×</button>
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
    const rows = (all || []).filter((f) => f.status === seg)
      .filter((f) => !q || (f.participant1 + f.participant2 + (f.competition || '')).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.oddsTickCount || 0) - (a.oddsTickCount || 0));
    return (
      <Sheet title="CHOOSE YOUR BATTLE" onClose={onClose}>
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
          {rows.length > 0 && <div style={{ fontSize: 8.5, letterSpacing: 1, color: 'rgba(210,220,205,.35)', padding: '8px 4px 4px' }}>SORTED BY MARKET DEPTH · {rows.length} FIXTURES · TXLINE CORPUS</div>}
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

  // ── inspect + Merkle proof walk ───────────────────────────────────────────
  function InspectSheet({ onClose }) {
    const [phase, setPhase] = useState('loading'); // loading|state|proof|error
    const [state, setState] = useState(null);
    const [proof, setProof] = useState(null);
    const [err, setErr] = useState(null);
    useEffect(() => {
      const ts = B().headTs ? B().headTs() : 0;
      B().stateAtTs(ts).then((st) => { setState(st); setPhase('state'); }).catch((e) => { setErr(String(e.message || e)); setPhase('error'); });
    }, []);
    const verify = async () => {
      setPhase('proof-loading');
      try { const p = await B().proof(state.seq, [1, 2], true); setProof(p); setPhase('proof'); }
      catch (e) { setErr(String(e.message || e)); setPhase('error'); }
    };
    const hex = (arr) => (arr || []).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16) + '…';
    return (
      <Sheet title="INSPECT THIS TICK" onClose={onClose} accent="#7ab5e8">
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {phase === 'loading' && <Muted>Reading market state at the frontline…</Muted>}
          {phase === 'error' && <Muted>Could not read this tick: {err}</Muted>}
          {(phase === 'state' || phase.startsWith('proof')) && state && (
            <div>
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
              {phase === 'proof' && proof && <ProofWalk proof={proof} hex={hex} />}
            </div>
          )}
        </div>
      </Sheet>
    );
  }

  function ProofWalk({ proof, hex }) {
    const oc = proof.onChain || {};
    const ok = oc.verified;
    const leaves = (proof.proof && proof.proof.statsToProve) || oc.statsToProve || [];
    const steps = [
      ['①', 'THE LEAF', `${leaves.length} stat ${leaves.length === 1 ? 'leaf' : 'leaves'} — the exact numbers on screen`, leaves.map((s) => `key ${s.key} = ${s.value}`).join(' · ') || '—'],
      ['②', 'THE BRANCH', 'sibling hashes fold the leaf up the sub-tree', `${(proof.proof && proof.proof.subTreeProof ? proof.proof.subTreeProof.length : 0)} sub-tree nodes → sub-root ${oc.subTreeVerified ? '✓' : '✗'}`],
      ['③', 'THE ROOT', 'the main tree gives one root for the whole 5-min batch', `computed ${hex(hexToBytes(oc.computedRootHex))}`],
      ['④', 'ON-CHAIN', `anchored on Solana account ${(oc.pda || '').slice(0, 6)}… (epoch day ${oc.epochDay})`, `chain root ${hex(hexToBytes(oc.onChainRootHex))}`],
    ];
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: ok ? 'rgba(126,217,146,.12)' : 'rgba(232,138,138,.12)', border: `1px solid ${ok ? 'rgba(126,217,146,.4)' : 'rgba(232,138,138,.4)'}`, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{ok ? '🛡' : '⚠'}</span>
          <div>
            <div style={{ fontFamily: COND, fontSize: 15, fontWeight: 700, letterSpacing: 1, color: ok ? '#a8e8ba' : '#f0b0b0' }}>{ok ? 'PROVEN AUTHENTIC' : 'PROOF INCOMPLETE'}</div>
            <div style={{ fontSize: 9, color: DIM, letterSpacing: .5 }}>{ok ? 'computed root === the root Solana anchored' : (oc.failureMode || 'roots did not match')}</div>
          </div>
        </div>
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
        <div style={{ fontSize: 8.5, letterSpacing: 1, color: 'rgba(210,220,205,.4)', paddingTop: 10 }}>TxLINE scores proof · verified against Solana oracle {(oc.programId || '').slice(0, 8)}… · read-only, no wallet, no gas</div>
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

  const Muted = ({ children }) => <div style={{ color: DIM, fontSize: 11, padding: '18px 4px', textAlign: 'center' }}>{children}</div>;
  const Row = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${LINE}` }}><span style={{ fontSize: 10, letterSpacing: 1, color: DIM }}>{k}</span><span style={{ fontFamily: MONO, fontSize: 12, color: INK, textAlign: 'right' }}>{v}</span></div>;

  // ── share sheet ───────────────────────────────────────────────────────────
  function ShareSheet({ onClose }) {
    const [copied, setCopied] = useState(false);
    const url = B().shareUrl ? B().shareUrl() : location.href;
    const poster = () => {
      const cv = document.querySelector('canvas');
      if (!cv) return;
      const a = document.createElement('a');
      a.download = `battlefield-${(B().getState && B().getState().fixtureId) || 'match'}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
    };
    return (
      <Sheet title="SHARE THE WAR" onClose={onClose}>
        <Muted>A replay link restores the exact fixture and moment. A poster-frame snapshots the terrain — scars and all.</Muted>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#8fc4ec', wordBreak: 'break-all', padding: '10px 12px', background: 'rgba(255,255,255,.03)', border: `1px solid ${LINE}`, borderRadius: 9, marginBottom: 10 }}>{url}</div>
        <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          style={{ width: '100%', padding: 12, marginBottom: 8, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#0d0b05', background: GOLD, border: 'none', borderRadius: 10, cursor: 'pointer' }}>{copied ? 'COPIED ✓' : 'COPY REPLAY LINK'}</button>
        <button onClick={poster} style={{ width: '100%', padding: 12, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: INK, background: 'rgba(255,255,255,.05)', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer' }}>EXPORT POSTER FRAME (PNG)</button>
      </Sheet>
    );
  }

  // ── wallet sheet (devnet, clearly labelled) ───────────────────────────────
  function WalletSheet({ onClose, onConnect, wallet }) {
    const connect = () => {
      // devnet demo: a deterministic ed25519-style pubkey stand-in (no real signing here).
      const bytes = Array.from({ length: 32 }, () => (Math.random() * 256) | 0);
      const b58 = base58(bytes);
      onConnect(b58);
    };
    return (
      <Sheet title="SIGN IN WITH SOLANA" onClose={onClose} accent="#9b7de8">
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 6, alignItems: 'center', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#c9b6f0', border: '1px solid rgba(155,125,232,.4)', background: 'rgba(155,125,232,.12)', padding: '4px 9px', borderRadius: 6, marginBottom: 12 }}>◆ DEVNET · NO REAL FUNDS</div>
        {!wallet ? (
          <div>
            <Muted>Sign in with a Solana wallet to save your predict-along record and climb the per-match leaderboard. This demo uses a devnet identity — nothing is signed on mainnet and no SOL is spent.</Muted>
            <button onClick={connect} style={{ width: '100%', padding: 13, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#fff', background: 'linear-gradient(90deg,#7d4fe0,#9b7de8)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>CONNECT DEVNET WALLET</button>
          </div>
        ) : (
          <div>
            <Row k="Network" v="Solana devnet" />
            <Row k="Address" v={wallet.slice(0, 8) + '…' + wallet.slice(-6)} />
            <Row k="Status" v="Signed in ✓" />
            <button onClick={() => onConnect(null)} style={{ width: '100%', marginTop: 14, padding: 12, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: INK, background: 'rgba(255,255,255,.05)', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer' }}>SIGN OUT</button>
          </div>
        )}
      </Sheet>
    );
  }
  function base58(bytes) {
    const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
    let s = ''; while (n > 0n) { s = A[Number(n % 58n)] + s; n = n / 58n; } return s || '1';
  }

  // ── predict-along ─────────────────────────────────────────────────────────
  // During a danger spell a war-drum prompt asks goal / corner / nothing; the pick
  // is log-scored against the market's implied probability for that outcome.
  function PredictAlong({ wallet }) {
    const [prompt, setPrompt] = useState(null);     // {side, outcome, marketProb, id}
    const [result, setResult] = useState(null);     // {label, pts, total, correct}
    const cool = useRef(0); const promptRef = useRef(null); const frameRef = useRef(null);
    const board = useRef(loadBoard());

    useEffect(() => { if (B().subscribe) return B().subscribe((s) => { frameRef.current = s.frame; }); }, []);
    useEffect(() => {
      if (!B().onEvent) return;
      return B().onEvent((e) => {
        if (e.kind !== 'predict_prompt') return;
        if (promptRef.current || Date.now() < cool.current) return;
        const mp = e.momentum ? a2pMom(e.momentum[e.side]) : (frameRef.current ? a2p(frameRef.current, e.side) : 0.3);
        const p = { side: e.side, outcome: e.outcome, marketProb: mp, id: Date.now() };
        promptRef.current = p; setPrompt(p);
        cool.current = Date.now() + 16000;
      });
    }, []);

    const answer = (choice) => {
      const p = promptRef.current; promptRef.current = null; setPrompt(null);
      if (!p) return;
      const outcome = p.outcome, correct = choice === outcome;
      // log-score vs the market's implied probability — a correct call the market
      // rated unlikely is worth more (Beat-the-Market scoring).
      const pMarket = outcome === 'goal' ? p.marketProb : outcome === 'corner' ? 0.15 : (1 - p.marketProb);
      const gain = correct ? Math.max(4, Math.round(-Math.log2(Math.max(0.03, pMarket)) * 10)) : -8;
      board.current = addScore(board.current, wallet, gain);
      const total = board.current[wallet ? wallet.slice(0, 6) : 'you'] || 0;
      setResult({ label: correct ? `RIGHT — ${outcome.toUpperCase()}` : `WRONG — it was ${outcome.toUpperCase()}`, pts: gain, total, correct });
      setTimeout(() => setResult(null), 4600);
    };

    if (!prompt && !result) return null;
    return (
      <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom) + 128px)', zIndex: 47, pointerEvents: 'auto', display: 'flex', justifyContent: 'center' }}>
        {prompt && (
          <div style={{ width: 'min(420px,100%)', background: 'rgba(20,10,8,.94)', border: '1px solid rgba(211,171,72,.5)', borderRadius: 14, padding: '12px 14px', WebkitBackdropFilter: 'blur(12px)', backdropFilter: 'blur(12px)', boxShadow: '0 10px 40px rgba(0,0,0,.55)', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1) both' }}>
            <div style={{ fontFamily: COND, fontSize: 17, fontWeight: 700, letterSpacing: 2, color: GOLD }}>⚔ RAID INCOMING</div>
            <div style={{ fontSize: 10, color: DIM, margin: '2px 0 10px' }}>Market implies <b style={{ color: INK }}>{Math.round(prompt.marketProb * 100)}%</b> goal chance this spell. Call it:</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {[['goal', 'GOAL'], ['corner', 'CORNER'], ['nothing', 'NOTHING']].map(([k, l]) => (
                <button key={k} onClick={() => answer(k)} style={{ flex: 1, padding: '11px 4px', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, borderRadius: 9, cursor: 'pointer', color: INK, border: '1px solid rgba(211,171,72,.35)', background: 'rgba(211,171,72,.1)' }}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {result && (
          <div style={{ width: 'min(420px,100%)', background: result.correct ? 'rgba(10,30,14,.95)' : 'rgba(30,12,12,.95)', border: `1px solid ${result.correct ? 'rgba(126,217,146,.5)' : 'rgba(232,138,138,.5)'}`, borderRadius: 14, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'sheetUp .3s both' }}>
            <div>
              <div style={{ fontFamily: COND, fontSize: 16, fontWeight: 700, letterSpacing: 1, color: result.correct ? '#a8e8ba' : '#f0b0b0' }}>{result.label}</div>
              <div style={{ fontSize: 9, color: DIM, letterSpacing: 1 }}>CAMPAIGN TOTAL {result.total} PTS</div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: result.correct ? '#7ed992' : '#e88a8a' }}>{result.pts > 0 ? '+' : ''}{result.pts}</span>
          </div>
        )}
      </div>
    );
  }
  // implied P(goal in spell) proxy: momentum of the threatening side scaled into a plausible band
  function a2p(f, side) { const m = (f.momentum && f.momentum[side]) || 0.4; return a2pMom(m); }
  function a2pMom(m) { return Math.min(0.6, Math.max(0.12, 0.12 + (m || 0.4) * 0.5)); }
  function loadBoard() { try { return JSON.parse(localStorage.getItem('bf_board') || '{}'); } catch { return {}; } }
  function addScore(board, wallet, pts) { const k = wallet ? wallet.slice(0, 6) : 'you'; board[k] = (board[k] || 0) + pts; try { localStorage.setItem('bf_board', JSON.stringify(board)); } catch {} return board; }

  // ── root ──────────────────────────────────────────────────────────────────
  function BattleConsole() {
    const [ready, setReady] = useState(!!window.BATTLE);
    const [sheet, setSheet] = useState(null);
    const [wallet, setWallet] = useState(() => { try { return localStorage.getItem('bf_wallet') || null; } catch { return null; } });
    const [mode, setMode] = useState('replay');
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
      const onKey = (e) => { if (e.key === 'Escape') setSheet(null); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);
    if (!ready) return null;
    const connect = (w) => { setWallet(w); try { w ? localStorage.setItem('bf_wallet', w) : localStorage.removeItem('bf_wallet'); } catch {} };
    return (
      <React.Fragment>
        <TopChrome onOpen={setSheet} mode={mode} wallet={wallet} />
        <Scrubber />
        <PredictAlong wallet={wallet} />
        {sheet === 'picker' && <FixturePicker onClose={() => setSheet(null)} />}
        {sheet === 'inspect' && <InspectSheet onClose={() => setSheet(null)} />}
        {sheet === 'share' && <ShareSheet onClose={() => setSheet(null)} />}
        {sheet === 'wallet' && <WalletSheet onClose={() => setSheet(null)} onConnect={connect} wallet={wallet} />}
      </React.Fragment>
    );
  }

  window.BattleConsole = BattleConsole;
})();
