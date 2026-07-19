// war-room.jsx — tweaks panel with direct BattleEvent triggers.
// Everything routes through window.BF → driver.inject(): one code path for scripted,
// triggered, and (later) real data.
(function () {
  const { useEffect, useState } = React;
  // The War Room only exists in the SANDBOX battle — real fixtures (replay/live) take
  // their events ONLY from the data, so it is hidden there entirely.
  function useSandboxMode() {
    const [mode, setMode] = useState(() => { try { return (window.BATTLE && window.BATTLE.getState && window.BATTLE.getState().mode) || null; } catch { return null; } });
    useEffect(() => {
      let unsub = null;
      const attach = () => {
        if (window.BATTLE && window.BATTLE.subscribe) {
          unsub = window.BATTLE.subscribe((s) => { if (s && s.mode) setMode((m) => (m === s.mode ? m : s.mode)); });
          return true;
        }
        return false;
      };
      if (!attach()) { const iv = setInterval(() => { if (attach()) clearInterval(iv); }, 150); return () => { clearInterval(iv); unsub && unsub(); }; }
      return () => unsub && unsub();
    }, []);
    return mode === 'sandbox' || mode === 'synthetic';
  }

  function WarRoom() {
    const sandbox = useSandboxMode();
    const ident = (() => { try { return (window.BATTLE && window.BATTLE.getIdent && window.BATTLE.getIdent()) || {}; } catch { return {}; } })();
    const HN = ident.homeName || 'HOME', AN = ident.awayName || 'AWAY';
    const [t, setTweak] = useTweaks({
      shotOutcome: 'OnTarget',
      overrideMomentum: false, momHome: 0.4, momAway: 0.4,
      fog: false,
    });
    useEffect(() => { window.BF?.mom('home', t.overrideMomentum ? t.momHome : null); }, [t.overrideMomentum, t.momHome]);
    useEffect(() => { window.BF?.mom('away', t.overrideMomentum ? t.momAway : null); }, [t.overrideMomentum, t.momAway]);
    useEffect(() => { window.BF?.fog(t.fog); }, [t.fog]);
    if (!sandbox) return null;
    const fire = (e) => () => window.BF?.inject(e);
    return (
      <TweaksPanel title="War Room">
        <TweakSection label="Goals" />
        <TweakButton label={`Goal — ${HN}`} onClick={fire({ kind: 'goal', side: 'home' })} />
        <TweakButton label={`Goal — ${AN}`} onClick={fire({ kind: 'goal', side: 'away' })} />
        <TweakSection label="Shots" />
        <TweakSelect label="Outcome" value={t.shotOutcome} options={['OnTarget', 'Blocked', 'Woodwork', 'OffTarget']} onChange={(v) => setTweak('shotOutcome', v)} />
        <TweakButton label={`Shot — ${HN}`} onClick={() => window.BF?.inject({ kind: 'shot', side: 'home', outcome: t.shotOutcome })} />
        <TweakButton label={`Shot — ${AN}`} onClick={() => window.BF?.inject({ kind: 'shot', side: 'away', outcome: t.shotOutcome })} />
        <TweakSection label="Set pieces" />
        <TweakButton label={`Corner — ${HN}`} onClick={fire({ kind: 'corner', side: 'home' })} />
        <TweakButton label={`Corner — ${AN}`} onClick={fire({ kind: 'corner', side: 'away' })} />
        <TweakSection label="Discipline" />
        <TweakButton label={`Yellow — ${HN}`} onClick={fire({ kind: 'card', side: 'home', color: 'yellow' })} />
        <TweakButton label={`Yellow — ${AN}`} onClick={fire({ kind: 'card', side: 'away', color: 'yellow' })} />
        <TweakButton label={`Red — ${HN}`} onClick={fire({ kind: 'card', side: 'home', color: 'red' })} />
        <TweakButton label={`Red — ${AN}`} onClick={fire({ kind: 'card', side: 'away', color: 'red' })} />
        <TweakSection label="VAR" />
        <TweakButton label="Start VAR check" onClick={fire({ kind: 'var', subject: 'Penalty' })} />
        <TweakButton label="Resolve — Stands" onClick={fire({ kind: 'var_end', outcome: 'Stands' })} />
        <TweakButton label="Resolve — Overturned" onClick={fire({ kind: 'var_end', outcome: 'Overturned' })} />
        <TweakSection label="Threat flares" />
        <TweakButton label={`Flare — ${HN} threat`} onClick={() => window.BF?.threat('home')} />
        <TweakButton label={`Flare — ${AN} threat`} onClick={() => window.BF?.threat('away')} />
        <TweakSection label="Market" />
        <TweakToggle label="Fog of war" value={t.fog} onChange={(v) => setTweak('fog', v)} />
        <TweakSection label="Momentum" />
        <TweakToggle label="Override momentum" value={t.overrideMomentum} onChange={(v) => setTweak('overrideMomentum', v)} />
        <TweakSlider label={HN} value={t.momHome} min={0} max={1} step={0.05} onChange={(v) => setTweak('momHome', v)} />
        <TweakSlider label={AN} value={t.momAway} min={0} max={1} step={0.05} onChange={(v) => setTweak('momAway', v)} />
        <TweakSection label="Match" />
        <TweakButton label={`Substitution — ${AN}`} onClick={fire({ kind: 'substitution', side: 'away' })} />
        <TweakButton label="Jump to finale" onClick={() => window.BF?.finale()} />
      </TweaksPanel>
    );
  }
  window.WarRoom = WarRoom;
})();
