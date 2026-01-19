import { useState, useEffect, useMemo } from 'react';
import { Icons } from './Icons';
import {
    calculateRatios,
    getRatioStatus,
    getMineralHistory,
    saveMineralHistory,
    checkProlongedDeficit,
    getHeavyDinnerFlag,
    setHeavyDinnerFlag,
    calculateFAScore,
    getFAScoreStatus
} from '../utils/helpers';

const SaludView = ({ logs, activityData, thresholds }) => {
    const [heavyDinner, setHeavyDinner] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [timeToSleep, setTimeToSleep] = useState('plus2'); // 'plus2', '1to2', 'less1'
    const [nightModeOverride, setNightModeOverride] = useState(null); // null=auto, true=forceON, false=forceOFF

    const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const todayDateStr = useMemo(() => new Date().toLocaleDateString(), []);
    const tssToday = activityData?.tss || 0;

    // Night Mode logic
    const currentHour = new Date().getHours();
    const isNightByTime = currentHour >= 20 || currentHour < 6;
    const autoNightMode = isNightByTime || heavyDinner;
    const isNightMode = nightModeOverride !== null ? nightModeOverride : autoNightMode;

    const toggleNightMode = () => {
        if (isNightMode) {
            setNightModeOverride(false);
        } else {
            setNightModeOverride(null);
            if (!autoNightMode) setNightModeOverride(true);
        }
    };

    useEffect(() => {
        setHeavyDinner(getHeavyDinnerFlag(todayDateStr));
    }, [todayDateStr]);

    const toggleHeavyDinner = () => {
        const newVal = !heavyDinner;
        setHeavyDinner(newVal);
        setHeavyDinnerFlag(todayDateStr, newVal);
    };

    const today = useMemo(() => logs.filter(l => (l.dateISO || l.dateStr) === todayISO || l.dateStr === todayDateStr), [logs, todayISO, todayDateStr]);
    const sum = (k) => today.reduce((a, b) => a + (Number(b[k]) || 0), 0);

    const na = sum('na'), k = sum('k'), ca = sum('ca'), mg = sum('mg');

    useEffect(() => {
        if (na > 0 || k > 0 || mg > 0) {
            saveMineralHistory(todayDateStr, na, k, mg);
        }
    }, [na, k, mg, todayDateStr]);

    const kDeficit = checkProlongedDeficit('k', thresholds.potassium.low, k);
    const mgDeficit = checkProlongedDeficit('mg', thresholds.magnesium.low, mg);

    const ratios = calculateRatios(na, k, ca, mg);
    const naKStatus = getRatioStatus(ratios.naK, thresholds.ratios.na_k);
    const caMgStatus = getRatioStatus(ratios.caMg, thresholds.ratios.ca_mg);

    const nightLogs = today.filter(l => l.timeBlock === 'noche');
    const nightFat = nightLogs.reduce((a, b) => a + (Number(b.fat) || 0), 0);
    const nightFiber = nightLogs.reduce((a, b) => a + (Number(b.fiber) || 0), 0);

    const fatPenalty = nightFat > 20 ? (nightFat - 20) * 1.2 : 0;
    const fiberPenalty = nightFiber * 0.8;

    let timeFactor = 1.0;
    if (timeToSleep === '1to2') timeFactor = 1.3;
    if (timeToSleep === 'less1') timeFactor = 1.6;

    const digestiveLoad = (fatPenalty + fiberPenalty) * timeFactor;

    const getDigestiveStatus = () => {
        if (digestiveLoad < 120) return { label: 'Ligera', color: 'emerald' };
        if (digestiveLoad < 180) return { label: 'Moderada', color: 'amber' };
        return { label: 'Pesada', color: 'rose' };
    };
    const digestiveStatus = getDigestiveStatus();

    const taurinaTotal = today.reduce((s, l) => {
        const entry = (l.extraMinerals || []).find(m => m.label?.toLowerCase() === 'taurina');
        return s + (entry ? Number(entry.value) || 0 : 0);
    }, 0);
    const taurinaG = taurinaTotal / 1000;

    const faScore = calculateFAScore(na, k, ca, mg, taurinaG, digestiveLoad, tssToday);
    const faScoreStatus = getFAScoreStatus(faScore);

    const getDayStatus = () => {
        if (today.length === 0) return { label: 'Sin datos', color: 'gray', icon: '📊' };
        const issues = [naKStatus.status === 'high', caMgStatus.status === 'high', digestiveStatus.color === 'rose'].filter(Boolean).length;
        if (issues === 0) return { label: 'Día ordenado', color: 'emerald', icon: '✨' };
        if (issues === 1) return { label: 'Día con carga', color: 'amber', icon: '⚡' };
        return { label: 'Día sensible', color: 'rose', icon: '🌙' };
    };
    const dayStatus = getDayStatus();

    // Omega-3 Tracker Logic
    const omega3Tracker = useMemo(() => {
        const isOmega3Food = (name) => {
            const n = (name || '').toLowerCase();
            return n.includes('salm') || n.includes('atún') || n.includes('atun') || n.includes('sardina') ||
                n.includes('caballa') || n.includes('anchoa') || n.includes('boquer') ||
                (n.includes('omega') && (n.includes('3') || n.includes('600'))) ||
                n.includes('cápsula') || n.includes('capsula');
        };
        const now = new Date();
        const logs30 = logs.filter(l => {
            const d = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000) : new Date(l.dateISO || l.dateStr);
            return (now - d) < (30 * 24 * 60 * 60 * 1000) && isOmega3Food(l.name);
        });
        logs30.sort((a, b) => {
            const da = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.dateISO || a.dateStr).getTime();
            const db = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.dateISO || b.dateStr).getTime();
            return db - da;
        });
        const last = logs30[0] || null;
        const daysSince = last ? Math.floor((now - (last.timestamp?.seconds ? new Date(last.timestamp.seconds * 1000) : new Date(last.dateISO || last.dateStr))) / (24 * 60 * 60 * 1000)) : 999;

        const getStatus = (days) => {
            if (days <= 3) return { emoji: '🟢', label: 'Óptimo', color: 'emerald' };
            if (days <= 7) return { emoji: '🟡', label: 'Aceptable', color: 'amber', daysLeft: 7 - days };
            return { emoji: '🔴', label: 'Urgente', color: 'rose' };
        };
        const status = getStatus(daysSince);

        const dots = [];
        for (let i = 0; i < 30; i++) {
            const check = new Date(now);
            check.setDate(check.getDate() - i);
            const checkStr = check.toISOString().slice(0, 10);
            dots.push(logs30.some(l => (l.dateISO || l.dateStr) === checkStr));
        }
        return { status, daysSince, last, dots };
    }, [logs]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header & Night Mode Toggle */}
            <div className="flex justify-between items-center px-2 mb-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black tracking-tighter">
                        {isNightMode ? '🌙 Modo Nocturno' : 'Salud Cardíaca'}
                    </h2>
                    <button
                        onClick={toggleNightMode}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${isNightMode
                            ? 'bg-indigo-600 text-white'
                            : nightModeOverride === false
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                    >
                        {isNightMode ? '🌙 ON' : nightModeOverride === false ? '☀️ DÍA' : '🌙'}
                    </button>
                </div>
                <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${tssToday >= 40 ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-900/50 dark:text-slate-400'}`}>
                        {tssToday >= 40 ? `🚴 ${tssToday} TSS` : '🛌 Descanso'}
                    </span>
                </div>
            </div>

            {isNightMode ? (
                /* NIGHT MODE VIEW */
                <div className="space-y-4 mb-6 animate-fade-in">
                    <div className={`p-5 rounded-3xl border-2 bg-gradient-to-br ${faScoreStatus.color === 'emerald' ? 'from-emerald-100 to-emerald-50 border-emerald-300 dark:from-emerald-900/40 dark:to-emerald-900/20 dark:border-emerald-700' :
                        faScoreStatus.color === 'amber' ? 'from-amber-100 to-amber-50 border-amber-300 dark:from-amber-900/40 dark:to-amber-900/20 dark:border-amber-700' :
                            'from-rose-100 to-rose-50 border-rose-300 dark:from-rose-900/40 dark:to-rose-900/20 dark:border-rose-700'
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-4xl">🫀</span>
                                <div>
                                    <p className="text-[10px] font-bold text-secondary uppercase">Score FA</p>
                                    <p className={`text-3xl font-black text-${faScoreStatus.color}-600 dark:text-${faScoreStatus.color}-400`}>
                                        {faScore}/100
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-4xl">{faScoreStatus.emoji}</span>
                                <p className={`text-sm font-black text-${faScoreStatus.color}-600 dark:text-${faScoreStatus.color}-400`}>
                                    {faScoreStatus.label}
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic text-center border-t border-current/10 pt-3">
                            "{faScoreStatus.message}"
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Summary metrics for night mode */}
                        {[
                            { label: 'Na:K', val: naKStatus.status === 'excellent' ? '✨ Equilibrado' : naKStatus.status === 'attention' ? '⚡ Atención' : '⚠️ Revisar', color: naKStatus.color },
                            { label: 'Ca:Mg', val: caMgStatus.status === 'excellent' ? '✨ Equilibrado' : caMgStatus.status === 'attention' ? '⚡ Atención' : '⚠️ Revisar', color: caMgStatus.color },
                            { label: 'Digestión', val: digestiveStatus.label, color: digestiveStatus.color },
                            { label: 'Taurina', val: taurinaG === 0 ? '⚫ Sin registro' : taurinaG < 0.5 ? '🔴 Bajo' : taurinaG <= 1.5 ? '✅ Base' : '🟡 Funcional', color: taurinaG >= 0.5 && taurinaG <= 2.5 ? 'teal' : taurinaG === 0 ? 'slate' : 'amber' }
                        ].map((m, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border bg-${m.color}-50 border-${m.color}-200 dark:bg-${m.color}-900/30 dark:border-${m.color}-700`}>
                                <p className="text-[10px] font-bold text-secondary uppercase mb-1">{m.label}</p>
                                <p className={`text-sm font-bold text-${m.color}-600 dark:text-${m.color}-400`}>{m.val}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* DAY MODE VIEW */
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-end px-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${dayStatus.color}-100 text-${dayStatus.color}-600 dark:bg-${dayStatus.color}-900/50 dark:text-${dayStatus.color}-400`}>
                            {dayStatus.icon} {dayStatus.label}
                        </span>
                    </div>

                    {/* Summary & Toggles */}
                    <div className="bg-card p-4 rounded-2xl border border-theme space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer" onClick={toggleHeavyDinner}>
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${heavyDinner ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                {heavyDinner && <span className="text-sm">✓</span>}
                            </div>
                            <span className="text-sm font-medium">🌙 Cena realizada</span>
                        </label>

                        {heavyDinner && (
                            <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 animate-fade-in">
                                <p className="font-bold text-sm text-primary">📊 Resumen del día ({thresholds.dayType})</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 bg-card rounded-lg flex justify-between"><span>Na:</span> <b>{Math.round(na)}mg</b></div>
                                    <div className="p-2 bg-card rounded-lg flex justify-between"><span>K:</span> <b>{Math.round(k)}mg</b></div>
                                    <div className="p-2 bg-card rounded-lg flex justify-between"><span>Ca:</span> <b>{Math.round(ca)}mg</b></div>
                                    <div className="p-2 bg-card rounded-lg flex justify-between"><span>Mg:</span> <b>{Math.round(mg)}mg</b></div>
                                </div>
                                <div className="text-[10px] space-y-1 text-secondary border-t border-theme pt-2">
                                    {tssToday >= 50 && na < 2000 && <p>💧 Aumenta Na para reponer sudor</p>}
                                    {k < thresholds.potassium.good && <p>🍌 Prioriza K mañana</p>}
                                    {mg < thresholds.magnesium.good && <p>💊 Suplementa Mg antes de dormir</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Ratios */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`bg-card p-5 rounded-3xl border border-theme border-l-4 border-l-${naKStatus.color}-500 shadow-sm`}>
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Ratio Na:K</p>
                            <p className="text-3xl font-black">{ratios.naK ? ratios.naK.toFixed(2) : '-'}</p>
                            <p className={`text-xs font-bold text-${naKStatus.color}-600 mt-2`}>{naKStatus.message}</p>
                        </div>
                        <div className={`bg-card p-5 rounded-3xl border border-theme border-l-4 border-l-${caMgStatus.color}-500 shadow-sm`}>
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Ratio Ca:Mg</p>
                            <p className="text-3xl font-black">{ratios.caMg ? ratios.caMg.toFixed(2) : '-'}</p>
                            <p className={`text-xs font-bold text-${caMgStatus.color}-600 mt-2`}>{caMgStatus.message}</p>
                        </div>
                    </div>

                    {/* Density & Taurine */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-teal-50 dark:bg-teal-900/10 p-4 rounded-2xl border border-teal-200 dark:border-teal-800">
                            <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest mb-1">Densidad Mineral</p>
                            <p className="text-3xl font-black text-teal-700">{((mg + k / 10 + ca / 5) / (sum('calories') || 1) * 10).toFixed(1)}</p>
                        </div>
                        <div className="bg-violet-50 dark:bg-violet-900/10 p-4 rounded-2xl border border-violet-200 dark:border-violet-800">
                            <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-1">Taurina</p>
                            <p className="text-3xl font-black text-violet-700">{taurinaG.toFixed(1)}<span className="text-sm">g</span></p>
                        </div>
                    </div>

                    {/* Digestive Load */}
                    <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Carga Digestiva Nocturna</p>
                                <p className="text-4xl font-black">{Math.round(digestiveLoad)}</p>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-1 flex gap-1 border border-slate-700">
                                {['plus2', '1to2', 'less1'].map(t => (
                                    <button key={t} onClick={() => setTimeToSleep(t)} className={`px-2 py-1 rounded text-[10px] font-bold ${timeToSleep === t ? 'bg-indigo-600' : 'text-slate-500'}`}>
                                        {t === 'plus2' ? '>2h' : t === '1to2' ? '1-2h' : '<1h'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                            <div className="bg-white/5 p-2 rounded-lg">Grasa: {Math.round(fatPenalty)} pts</div>
                            <div className="bg-white/5 p-2 rounded-lg">Fibra: {Math.round(fiberPenalty)} pts</div>
                        </div>
                    </div>

                    {/* Mineral Progress Bars */}
                    <div className="bg-card p-6 rounded-3xl border border-theme space-y-4">
                        <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Progreso Mineral</p>
                        {[
                            { label: 'Sodio', val: na, max: thresholds.sodium.high, color: 'blue' },
                            { label: 'Potasio', val: k, max: thresholds.potassium.good, color: 'emerald' },
                            { label: 'Calcio', val: ca, max: thresholds.calcium.good, color: 'rose' },
                            { label: 'Magnesio', val: mg, max: thresholds.magnesium.good, color: 'violet' }
                        ].map(m => (
                            <div key={m.label} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase">
                                    <span className={`text-${m.color}-500`}>{m.label}</span>
                                    <span>{Math.round(m.val)} / {m.max}mg</span>
                                </div>
                                <div className={`h-2 bg-${m.color}-100 dark:bg-${m.color}-900/20 rounded-full overflow-hidden`}>
                                    <div className={`h-full bg-${m.color}-500 transition-all`} style={{ width: `${Math.min(100, (m.val / m.max) * 100)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Omega-3 Tracker Card (Always Visible) */}
            <div className={`p-4 rounded-2xl border-2 bg-gradient-to-br ${omega3Tracker.status.color === 'emerald' ? 'from-emerald-50 to-emerald-100 border-emerald-300 dark:from-emerald-900/30' : omega3Tracker.status.color === 'amber' ? 'from-amber-50 to-amber-100 border-amber-300 dark:from-amber-900/30' : 'from-rose-50 to-rose-100 border-rose-300 dark:from-rose-900/30'}`}>
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🐟</span>
                        <div>
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Omega-3</p>
                            <p className={`text-sm font-bold text-${omega3Tracker.status.color}-600`}>{omega3Tracker.status.emoji} {omega3Tracker.status.label}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-secondary">Hace:</p>
                        <p className="text-xl font-black">{omega3Tracker.daysSince === 999 ? '+30d' : `${omega3Tracker.daysSince}d`}</p>
                    </div>
                </div>
                <div className="flex gap-1 justify-center mb-2">
                    {omega3Tracker.dots.map((dot, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${dot ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    ))}
                </div>
            </div>

            {/* Info Toggle */}
            <button onClick={() => setShowInfo(!showInfo)} className="w-full text-center text-xs text-secondary font-bold py-2">
                {showInfo ? 'Cerrar Información ⬆️' : '¿Cómo se calculan estos datos? ⬇️'}
            </button>
            {showInfo && (
                <div className="p-4 bg-card rounded-2xl border border-theme text-[11px] text-secondary space-y-3 animate-fade-in shadow-inner">
                    <p>🧪 <b>Densidad:</b> Electrolitos clave por cada caloría ingerida.</p>
                    <p>🌙 <b>Digestión:</b> Impacto de la grasa y fibra nocturna en tu HRV.</p>
                    <p>⚖️ <b>Na:K & Ca:Mg:</b> Ratios críticos para la estabilidad eléctrica del corazón.</p>
                </div>
            )}
        </div>
    );
};

export default SaludView;
