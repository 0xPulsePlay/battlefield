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
    const wasPlaying = useRef(true);
    const prog = drag != null ? drag : (snap.progress || 0);
    const f = snap.frame;
    const speed = snap.speed || 1;
    const seek = (p) => { B().seekProgress && B().seekProgress(p); };
    // no timeline to scrub in the synthetic sandbox (it's a live-feel playground)
    if (snap.mode === 'sandbox' || snap.mode === 'synthetic') return null;
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
  function InspectSheet({ onClose, seq }) {
    const [phase, setPhase] = useState('loading'); // loading|state|proof|error
    const [state, setState] = useState(null);
    const [proof, setProof] = useState(null);
    const [browser, setBrowser] = useState(null); // { status:'pending'|'ok'|'error', res?, err? }
    const [err, setErr] = useState(null);
    useEffect(() => {
      const load = (seq != null && B().stateAtSeq) ? B().stateAtSeq(seq) : B().stateAtTs(B().headTs ? B().headTs() : 0);
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

  // ── share sheet ───────────────────────────────────────────────────────────
  function ShareSheet({ onClose }) {
    const [copied, setCopied] = useState(false);
    const url = B().shareUrl ? B().shareUrl() : location.href;
    const [posterMsg, setPosterMsg] = useState(null);
    const poster = async () => {
      const src = document.querySelector('canvas');
      if (!src) return;
      const dl = (dataUrl, name) => { const a = document.createElement('a'); a.download = name; a.href = dataUrl; a.click(); };
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
        dl(oc.toDataURL('image/png'), `battlefield-${ha}-${aa}.png`);
        setPosterMsg('POSTER SAVED ✓'); setTimeout(() => setPosterMsg(null), 1800);
      } catch (e) {
        dl(src.toDataURL('image/png'), 'battlefield.png');
        setPosterMsg('SAVED (raw) ✓'); setTimeout(() => setPosterMsg(null), 1800);
      }
    };
    return (
      <Sheet title="SHARE THE WAR" onClose={onClose}>
        <Muted>A replay link restores the exact fixture and moment. A poster-frame snapshots the terrain — scars and all.</Muted>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#8fc4ec', wordBreak: 'break-all', padding: '10px 12px', background: 'rgba(255,255,255,.03)', border: `1px solid ${LINE}`, borderRadius: 9, marginBottom: 10 }}>{url}</div>
        <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          style={{ width: '100%', padding: 12, marginBottom: 8, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#0d0b05', background: GOLD, border: 'none', borderRadius: 10, cursor: 'pointer' }}>{copied ? 'COPIED ✓' : 'COPY REPLAY LINK'}</button>
        <button onClick={poster} style={{ width: '100%', padding: 12, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: INK, background: 'rgba(255,255,255,.05)', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer' }}>{posterMsg || 'EXPORT POSTER FRAME (PNG)'}</button>
      </Sheet>
    );
  }

  // ── wallet sheet (devnet, clearly labelled) ───────────────────────────────
  function WalletSheet({ onClose, onConnect, wallet }) {
    const rec = loadRecord();
    const acc = rec.made ? Math.round((rec.correct / rec.made) * 100) : 0;
    const connect = () => {
      // devnet demo: a deterministic ed25519-style pubkey stand-in (no real signing here).
      const bytes = Array.from({ length: 32 }, () => (Math.random() * 256) | 0);
      const b58 = base58(bytes);
      onConnect(b58);
    };
    const RecordPanel = () => (
      <div style={{ margin: '14px 0 4px', padding: '12px 14px', border: `1px solid ${LINE}`, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 2, color: DIM, marginBottom: 10 }}>PREDICT-ALONG RECORD</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
          {[['CALLS', rec.made], ['RIGHT', `${rec.correct} · ${acc}%`], ['POINTS', rec.pts]].map(([k, v]) => (
            <div key={k} style={{ flex: 1 }}>
              <div style={{ fontFamily: COND, fontSize: 26, fontWeight: 700, color: k === 'POINTS' ? GOLD : '#f0f3ec' }}>{v}</div>
              <div style={{ fontSize: 8.5, letterSpacing: 1.5, color: DIM }}>{k}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 8.5, letterSpacing: 1, color: 'rgba(210,220,205,.35)', marginTop: 10 }}>SCORED VS THE IMPLIED GOAL CHANCE · THIS DEVICE</div>
      </div>
    );
    return (
      <Sheet title="GUEST IDENTITY" onClose={onClose} accent="#9b7de8">
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', gap: 6, alignItems: 'center', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#c9b6f0', border: '1px solid rgba(155,125,232,.4)', background: 'rgba(155,125,232,.12)', padding: '4px 9px', borderRadius: 6, marginBottom: 12 }}>◆ DEVNET LABEL · NO REAL FUNDS · WALLET CONNECT PLANNED</div>
        {!wallet ? (
          <div>
            <Muted>Create a local guest identity to save your predict-along record and climb the leaderboard. Real Solana wallet connect (Phantom / Backpack) is planned. The on-chain substance here is the <b style={{ color: INK }}>Merkle proof walk</b> — every tick is verified against the Solana oracle, no wallet needed.</Muted>
            <button onClick={connect} style={{ width: '100%', padding: 13, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#fff', background: 'linear-gradient(90deg,#7d4fe0,#9b7de8)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>CREATE GUEST ID (DEVNET)</button>
            <RecordPanel />
          </div>
        ) : (
          <div>
            <Row k="Identity" v="Guest (devnet label)" />
            <Row k="Address" v={wallet.slice(0, 8) + '…' + wallet.slice(-6)} />
            <Row k="Wallet connect" v="Planned" />
            <RecordPanel />
            <button onClick={() => onConnect(null)} style={{ width: '100%', marginTop: 8, padding: 12, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: INK, background: 'rgba(255,255,255,.05)', border: `1px solid ${LINE}`, borderRadius: 10, cursor: 'pointer' }}>CLEAR GUEST ID</button>
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
      // log-score vs the implied goal chance (a momentum read) — a correct call the
      // model rated unlikely is worth more (Beat-the-Market-style scoring).
      const pMarket = outcome === 'goal' ? p.marketProb : outcome === 'corner' ? 0.15 : (1 - p.marketProb);
      const gain = correct ? Math.max(4, Math.round(-Math.log2(Math.max(0.03, pMarket)) * 10)) : -8;
      board.current = addScore(board.current, wallet, gain);
      bumpRecord(correct, gain);
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
            <div style={{ fontSize: 10, color: DIM, margin: '2px 0 10px' }}>Momentum read implies <b style={{ color: INK }}>{Math.round(prompt.marketProb * 100)}%</b> goal chance this spell. Call it:</div>
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
  function loadRecord() { try { return JSON.parse(localStorage.getItem('bf_record') || '{"made":0,"correct":0,"pts":0}'); } catch { return { made: 0, correct: 0, pts: 0 }; } }
  function bumpRecord(correct, pts) { const r = loadRecord(); r.made++; if (correct) r.correct++; r.pts += pts; try { localStorage.setItem('bf_record', JSON.stringify(r)); } catch {} return r; }

  // ── root ──────────────────────────────────────────────────────────────────
  function BattleConsole() {
    const [ready, setReady] = useState(!!window.BATTLE);
    const [sheet, setSheet] = useState(null);
    const [inspectSeq, setInspectSeq] = useState(null);
    const [wallet, setWallet] = useState(() => { try { return localStorage.getItem('bf_wallet') || null; } catch { return null; } });
    const [mode, setMode] = useState('replay');
    useEffect(() => {
      if (!ready || !B().onEvent) return;
      return B().onEvent((e) => { if (e.kind === 'inspect') { setInspectSeq(e.seq); setSheet('inspect'); B().setPaused && B().setPaused(true); } });
    }, [ready]);
    const openSheet = (s) => { if (s === 'inspect') setInspectSeq(null); setSheet(s); };
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
        <TopChrome onOpen={openSheet} mode={mode} wallet={wallet} />
        <Scrubber />
        <PredictAlong wallet={wallet} />
        {sheet === 'picker' && <FixturePicker onClose={() => setSheet(null)} />}
        {sheet === 'inspect' && <InspectSheet seq={inspectSeq} onClose={() => setSheet(null)} />}
        {sheet === 'share' && <ShareSheet onClose={() => setSheet(null)} />}
        {sheet === 'wallet' && <WalletSheet onClose={() => setSheet(null)} onConnect={connect} wallet={wallet} />}
      </React.Fragment>
    );
  }

  window.BattleConsole = BattleConsole;
})();
