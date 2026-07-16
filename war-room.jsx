// war-room.jsx — tweaks panel with direct BattleEvent triggers.
// Everything routes through window.BF → driver.inject(): one code path for scripted,
// triggered, and (later) real data.
(function () {
  const { useEffect } = React;
  function WarRoom() {
    const [t, setTweak] = useTweaks({
      shotOutcome: 'OnTarget',
      overrideMomentum: false, momHome: 0.4, momAway: 0.4,
      fog: false,
    });
    useEffect(() => { window.BF?.mom('home', t.overrideMomentum ? t.momHome : null); }, [t.overrideMomentum, t.momHome]);
    useEffect(() => { window.BF?.mom('away', t.overrideMomentum ? t.momAway : null); }, [t.overrideMomentum, t.momAway]);
    useEffect(() => { window.BF?.fog(t.fog); }, [t.fog]);
    const fire = (e) => () => window.BF?.inject(e);
    return (
      <TweaksPanel title="War Room">
        <TweakSection label="Goals" />
        <TweakButton label="Goal — England" onClick={fire({ kind: 'goal', side: 'home' })} />
        <TweakButton label="Goal — Argentina" onClick={fire({ kind: 'goal', side: 'away' })} />
        <TweakSection label="Shots" />
        <TweakSelect label="Outcome" value={t.shotOutcome} options={['OnTarget', 'Blocked', 'Woodwork', 'OffTarget']} onChange={(v) => setTweak('shotOutcome', v)} />
        <TweakButton label="Shot — England" onClick={() => window.BF?.inject({ kind: 'shot', side: 'home', outcome: t.shotOutcome })} />
        <TweakButton label="Shot — Argentina" onClick={() => window.BF?.inject({ kind: 'shot', side: 'away', outcome: t.shotOutcome })} />
        <TweakSection label="Set pieces" />
        <TweakButton label="Corner — England" onClick={fire({ kind: 'corner', side: 'home' })} />
        <TweakButton label="Corner — Argentina" onClick={fire({ kind: 'corner', side: 'away' })} />
        <TweakSection label="Discipline" />
        <TweakButton label="Yellow — England" onClick={fire({ kind: 'card', side: 'home', color: 'yellow' })} />
        <TweakButton label="Yellow — Argentina" onClick={fire({ kind: 'card', side: 'away', color: 'yellow' })} />
        <TweakButton label="Red — England" onClick={fire({ kind: 'card', side: 'home', color: 'red' })} />
        <TweakButton label="Red — Argentina" onClick={fire({ kind: 'card', side: 'away', color: 'red' })} />
        <TweakSection label="VAR" />
        <TweakButton label="Start VAR check" onClick={fire({ kind: 'var', subject: 'Penalty' })} />
        <TweakButton label="Resolve — Stands" onClick={fire({ kind: 'var_end', outcome: 'Stands' })} />
        <TweakButton label="Resolve — Overturned" onClick={fire({ kind: 'var_end', outcome: 'Overturned' })} />
        <TweakSection label="Threat flares" />
        <TweakButton label="Flare — England threat" onClick={() => window.BF?.threat('home')} />
        <TweakButton label="Flare — Argentina threat" onClick={() => window.BF?.threat('away')} />
        <TweakSection label="Market" />
        <TweakToggle label="Fog of war" value={t.fog} onChange={(v) => setTweak('fog', v)} />
        <TweakSection label="Momentum" />
        <TweakToggle label="Override momentum" value={t.overrideMomentum} onChange={(v) => setTweak('overrideMomentum', v)} />
        <TweakSlider label="England" value={t.momHome} min={0} max={1} step={0.05} onChange={(v) => setTweak('momHome', v)} />
        <TweakSlider label="Argentina" value={t.momAway} min={0} max={1} step={0.05} onChange={(v) => setTweak('momAway', v)} />
        <TweakSection label="Match" />
        <TweakButton label="Substitution — Argentina" onClick={fire({ kind: 'substitution', side: 'away' })} />
        <TweakButton label="Jump to finale" onClick={() => window.BF?.finale()} />
      </TweaksPanel>
    );
  }
  window.WarRoom = WarRoom;
})();
