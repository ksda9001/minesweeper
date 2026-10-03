import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Game, PRESETS, validate, type Difficulty, type Config } from '../../../packages/game-core/src/index';
import type { BoardRenderer, Action } from '../../../packages/renderer/src/index';
import { Audio, enableMotion, haptic, loadSettings, saveSettings, loadScores, saveScores, type Settings } from './platform';
import { translations, systemLanguage } from './i18n';

function Counter({ value, label }: { value: number; label: string }) {
  const text = value < 0 ? '-' + String(Math.min(99, Math.abs(value))).padStart(2, '0') : String(Math.min(999, value)).padStart(3, '0');
  return <div className="counter" aria-label={`${label} ${value}`} role="status">{[...text].map((char, i) => <span className="wood-digit" key={i} aria-hidden="true">{char === '-' ? '−' : char}</span>)}</div>;
}
function Face({ expression }: { expression: 'happy' | 'surprised' | 'won' | 'lost' }) {
  return <img src="/assets/clover-token.png" alt="" className={`clover ${expression}`} aria-hidden="true" draggable={false}/>;
}
function ToolIcon({ kind }: { kind: 'flag' | 'center' | 'tilt' }) {
  return <svg className="tool-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{kind === 'flag' ? <><path d="M5 21V3m0 1c6-4 8 4 14 0v10c-6 4-8-4-14 0"/></> : kind === 'center' ? <><circle cx="12" cy="12" r="6"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/></> : <><rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(15 12 12)"/><path d="M2 9l2-3 2 3m12 6 2 3 2-3"/></>}</svg>;
}
export function App() {
  const [mobile, setMobile] = useState(() => matchMedia('(max-width:600px)').matches);
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [game, setGame] = useState(() => new Game(PRESETS.beginner));
  const [, update] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [settings, setSettings] = useState(loadSettings);
  const [system, setSystem] = useState(systemLanguage);
  const language = settings.language === 'auto' ? system : settings.language;
  const t = translations[language];
  const [selected, setSelected] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [menu, setMenu] = useState<'custom' | 'settings' | 'help' | 'scores' | null>(null);
  const [scores, setScores] = useState(loadScores);
  const [scoreStorageFailed, setScoreStorageFailed] = useState(false);
  const [custom, setCustom] = useState<Config>({ width: 20, height: 20, mines: 60 });
  const [customError, setCustomError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsStorageFailed, setSettingsStorageFailed] = useState(false);
  const [motionError, setMotionError] = useState('');
  const [motion, setMotion] = useState(false);
  const [diagnostics, setDiagnostics] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [cacheReady, setCacheReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), dialog = useRef<HTMLDialogElement>(null), renderer = useRef<BoardRenderer | null>(null);
  const current = useRef({ game, flagMode, settings, menu }); current.current = { game, flagMode, settings, menu };
  const audio = useRef<Audio | null>(null), stopMotion = useRef<(() => void) | null>(null);
  const action = useRef<(index: number, kind: Action) => void>(() => {});
  action.current = (index, kind) => {
    if (current.current.menu || loading) return;
    const g = current.current.game;
    if (current.current.flagMode && kind === 'reveal' && !g.cells[index]?.revealed) kind = 'flag';
    const before = g.status;
    const changed = kind === 'flag' ? g.flag(index) : kind === 'chord' || g.cells[index]?.revealed ? g.chord(index, performance.now()) : g.reveal(index, performance.now());
    if (!changed.length) return;
    renderer.current?.update(changed);
    const sound = g.status === 'lost' ? 'lost' : g.status === 'won' ? 'won' : kind === 'flag' ? 'flag' : 'reveal';
    if (sound !== 'lost' || settings.reducedMotion) audio.current?.play(sound); void haptic(sound);
    if (before !== g.status || g.status === 'won' || g.status === 'lost') setElapsed(g.elapsed(performance.now()));
    if (before !== 'won' && g.status === 'won') {
      const next = [{ ...g.config, mode: difficulty, seconds: g.elapsed(performance.now()), finishedAt: new Date().toISOString() }, ...scores];
      setScores(next); setScoreStorageFailed(!saveScores(next));
    }
    update(v => v + 1);
  };
  function restart(config = current.current.game.config, level = difficulty) {
    if (mobile && config.width > config.height) config = { ...config, width: config.height, height: config.width };
    setDifficulty(level); setGame(new Game(config)); setElapsed(0); setPressed(false); setMenu(null);
  }
  useEffect(() => {
    const query = matchMedia('(max-width:600px)'), changed = () => setMobile(query.matches);
    query.addEventListener('change', changed); return () => query.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    let cancelled = false; audio.current = new Audio();
    import('../../../packages/renderer/src/index').then(async ({ createRenderer }) => {
      const view = await createRenderer(canvas.current!, (i, kind) => action.current(i, kind), setPressed, setSelected, () => audio.current?.play('lost'));
      if (cancelled) { view.dispose(); return; }
      renderer.current = view; view.reset(current.current.game, current.current.settings); await view.loadProps(); await view.ready(); if (!cancelled) setLoading(false);
    }).catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } });
    const online = () => setOffline(!navigator.onLine); window.addEventListener('online', online); window.addEventListener('offline', online);
    const visibility = () => { if (document.hidden) audio.current?.suspend(); }; document.addEventListener('visibilitychange', visibility);
    if ('serviceWorker' in navigator && import.meta.env.PROD) void navigator.serviceWorker.ready.then(async () => { if (!cancelled) setCacheReady(true); });
    return () => { cancelled = true; stopMotion.current?.(); renderer.current?.dispose(); audio.current?.dispose(); window.removeEventListener('online', online); window.removeEventListener('offline', online); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { renderer.current?.reset(game, settings); }, [game, settings.quality, settings.reducedMotion, settings.contrast]);
  useEffect(() => { if (renderer.current) renderer.current.setMotionSettings(settings.motionIntensity, settings.sensitivity); }, [settings.motionIntensity, settings.sensitivity]);
  useEffect(() => { renderer.current?.setShortcuts(settings.shortcuts); }, [settings.shortcuts]);
  useEffect(() => { setSettingsStorageFailed(!saveSettings(settings)); audio.current?.setSettings(settings); }, [settings]);
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; document.title = t.title; }, [language]);
  useEffect(() => { const changed = () => setSystem(systemLanguage()); window.addEventListener('languagechange', changed); return () => window.removeEventListener('languagechange', changed); }, []);
  useEffect(() => {
    const id = setInterval(() => { setElapsed(current.current.game.elapsed(performance.now())); setDiagnostics(renderer.current?.diagnostics ?? ''); }, 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || menu || !settings.shortcuts) return; if (e.key.toLowerCase() === 'r') restart(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [menu, settings.shortcuts, difficulty]);
  useEffect(() => { if (menu) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close(); }, [menu]);
  useEffect(() => { if (settings.reducedMotion && motion) { stopMotion.current?.(); stopMotion.current = null; setMotion(false); } }, [settings.reducedMotion, motion]);
  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }));
  async function toggleMotion() {
    if (motion) { stopMotion.current?.(); stopMotion.current = null; setMotion(false); return; }
    if (!renderer.current) return;
    setMotionError('');
    try { stopMotion.current = await enableMotion(renderer.current, language); setMotion(true); } catch (e) { setMotionError(e instanceof Error ? e.message : String(e)); }
  }
  const cell = game.cells[selected];
  const cellDescription = `${t.cell} ${selected % game.config.width + 1}, ${Math.floor(selected / game.config.width) + 1}: ${cell?.flagged ? t.flagged : cell?.revealed ? cell.mine ? t.mine : cell.adjacent ? `${t.adjacent} ${cell.adjacent}` : t.empty : t.covered}`;
  return <main>
    <section className="cabinet" aria-label={t.board} style={{ '--board-ratio': game.config.width / game.config.height } as CSSProperties}>
      <canvas ref={canvas} tabIndex={0} aria-describedby="cell-description" aria-label={`${t[difficulty]} ${t.board}, ${game.config.width} ${t.columns}, ${game.config.height} ${t.rows}. ${t.keyboardHelp}`}/>
      <nav className="menu-bar" aria-label={t.navigation}><label><span className="menu-label">{t.game}</span><select aria-label={t.difficulty} value={difficulty === 'custom' ? 'custom-current' : difficulty} onChange={e => { const value = e.target.value; if (value === 'custom') setMenu('custom'); else if (value !== 'custom-current') restart(PRESETS[value as keyof typeof PRESETS], value as Difficulty); }}><option value="beginner">{t.beginner} · 9 × 9</option><option value="intermediate">{t.intermediate} · 16 × 16</option><option value="expert">{t.expert} · {mobile ? '16 × 30' : '30 × 16'}</option>{difficulty === 'custom' && <option value="custom-current">{t.custom} · {game.config.width} × {game.config.height}</option>}<option value="custom">{t.custom}…</option></select></label><button className={`mode-toggle${flagMode ? ' active' : ''}`} aria-pressed={flagMode} aria-label={flagMode ? t.flagMode : t.revealMode} title={flagMode ? t.flagMode : t.revealMode} onClick={() => setFlagMode(!flagMode)}><ToolIcon kind="flag"/><span>{flagMode ? t.flag : t.reveal}</span></button><div><span className="local-badge" title={offline ? t.offline : cacheReady ? t.offlineReady : t.local}><i/></span><button onClick={() => setMenu('scores')}>{t.scores}</button><button onClick={() => setMenu('settings')}>{t.settings}</button><button onClick={() => setMenu('help')}>{t.help}</button></div></nav>
      <div className="hud"><div className="instrument"><span>{t.remaining}</span><Counter value={game.remaining} label={t.remaining}/></div><button className="reset" aria-label={t.restart} title={`${t.restart} (R)`} onClick={() => restart()} onPointerDown={() => { setPressed(true); audio.current?.unlock(); }} onPointerUp={() => setPressed(false)} onPointerCancel={() => setPressed(false)}><Face expression={game.status === 'won' ? 'won' : game.status === 'lost' ? 'lost' : pressed ? 'surprised' : 'happy'}/></button><div className="instrument"><span>{t.timer}</span><Counter value={Math.floor(elapsed)} label={t.timer}/></div></div>
      <div className="field" data-status={game.status} aria-busy={loading}>{loading && <div className="loading"><span className="spinner"/><strong>{t.loading}</strong><small>{t.loadingDetail}</small></div>}{error && <div className="loading"><strong>{t.renderUnavailable}</strong><p>{t.renderError}{error}</p><button className="raised" onClick={() => location.reload()}>{t.reload}</button></div>}<output className="sr-only" id="cell-description" aria-live="polite">{cellDescription}</output></div>
    </section>
    <dialog ref={dialog} className={menu === 'scores' ? 'score-dialog' : undefined} onCancel={() => setMenu(null)} onClose={() => setMenu(null)}><div className="dialog-title"><h2>{menu === 'custom' ? t.customTitle : menu === 'settings' ? t.settings : menu === 'scores' ? t.scores : t.helpTitle}</h2><button aria-label={t.close} onClick={() => setMenu(null)}>×</button></div>
      {menu === 'custom' && <form noValidate onSubmit={e => { e.preventDefault(); const error = validate(custom, language); if (error) setCustomError(error); else { setCustomError(''); restart(custom, 'custom'); } }}><p>{t.customIntro}</p>{(['width', 'height', 'mines'] as const).map(key => <label className="form-row" key={key}>{t[key]}<input aria-label={t[key]} type="number" step="1" min={key === 'mines' ? 1 : 5} max={key === 'mines' ? custom.width * custom.height - 9 : 40} required value={Number.isNaN(custom[key]) ? '' : custom[key]} onChange={e => { setCustomError(''); setCustom(c => ({ ...c, [key]: e.target.valueAsNumber })); }}/></label>)}<small>{t.customHint}{mobile && <><br/>{t.portraitHint}</>}</small>{customError && <p className="form-error" role="alert">{customError}</p>}<button className="primary" type="submit">{t.start}</button></form>}
      {menu === 'settings' && <div className="settings"><label className="form-row">{t.language}<select aria-label={t.language} value={settings.language} onChange={e => patch('language', e.target.value as Settings['language'])}><option value="auto">{t.system}</option><option value="zh">中文</option><option value="en">English</option></select></label><h3>{t.graphics}</h3><label className="form-row">{t.quality}<select aria-label={t.quality} value={settings.quality} onChange={e => patch('quality', e.target.value as Settings['quality'])}><option value="auto">{t.autoQuality}</option><option value="low">{t.low}</option><option value="medium">{t.medium}</option><option value="high">{t.high}</option><option value="ultra">{t.ultra}</option></select></label><label className="check"><input type="checkbox" checked={settings.reducedMotion} onChange={e => patch('reducedMotion', e.target.checked)}/>{t.reducedMotion}</label><label className="check"><input type="checkbox" checked={settings.contrast} onChange={e => patch('contrast', e.target.checked)}/>{t.contrast}</label><h3>{t.motion}</h3><div className="tools settings-tools"><button onClick={() => { renderer.current?.recenter(); setMenu(null); }}><ToolIcon kind="center"/> {t.recenter}</button><button disabled={settings.reducedMotion || loading} aria-pressed={motion} className={motion ? 'active' : ''} onClick={() => void toggleMotion()}><ToolIcon kind="tilt"/> {motion ? t.disableMotion : t.enableMotion}</button></div><label className="form-row">{t.intensity}<input aria-label={t.intensity} type="range" min="0" max="1" step="0.05" value={settings.motionIntensity} onChange={e => patch('motionIntensity', Number(e.target.value))}/></label><label className="form-row">{t.sensitivity}<input aria-label={t.sensitivity} type="range" min="0.2" max="2" step="0.1" value={settings.sensitivity} onChange={e => patch('sensitivity', Number(e.target.value))}/></label><h3>{t.audio}</h3>{(['master', 'effects', 'ambient'] as const).map(key => <label className="form-row" key={key}>{t[key]}<input aria-label={t[key]} type="range" min="0" max="1" step="0.05" value={settings[key]} onPointerDown={() => audio.current?.unlock()} onChange={e => patch(key, Number(e.target.value))}/></label>)}<label className="check"><input type="checkbox" checked={settings.shortcuts} onChange={e => patch('shortcuts', e.target.checked)}/>{t.shortcuts}</label><p className="muted">{t.settingsHint}</p><p className="diagnostics">{diagnostics}</p></div>}
      {menu === 'settings' && settingsStorageFailed && <p className="form-error" role="alert">{t.storageError}</p>}
      {menu === 'settings' && motionError && <p className="form-error" role="alert">{motionError}</p>}
      {menu === 'help' && <div className="help"><p>{t.helpIntro}</p><dl><dt>{t.reveal}</dt><dd>{t.revealHelp}</dd><dt>{t.flag}</dt><dd>{t.flagHelp}</dd><dt>{t.chord}</dt><dd>{t.chordHelp}</dd><dt>{t.camera}</dt><dd>{t.cameraHelp}</dd><dt>{t.keyboard}</dt><dd>{t.keyboardHelp}</dd></dl><p className="muted">{t.helpHint}</p></div>}
      {menu === 'scores' && <div className="scores"><p className="muted">{t.scoreHint}</p>{scoreStorageFailed && <p className="form-error" role="alert">{t.scoreStorageError}</p>}{scores.length ? <table><thead><tr><th scope="col">{t.scoreMode}</th><th scope="col">{t.scoreTime}</th><th scope="col">{t.scoreDate}</th></tr></thead><tbody>{scores.map((score, i) => <tr key={`${score.finishedAt}-${i}`}><td>{t[score.mode]}<small>{score.width} × {score.height} · {score.mines} {t.minesUnit}</small></td><td className="score-time">{score.seconds.toFixed(2)} {t.seconds}</td><td className="score-date">{new Date(score.finishedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en', { dateStyle: 'short', timeStyle: 'short' })}</td></tr>)}</tbody></table> : <p className="score-empty">{t.scoreEmpty}</p>}</div>}
    </dialog>
  </main>;
}
