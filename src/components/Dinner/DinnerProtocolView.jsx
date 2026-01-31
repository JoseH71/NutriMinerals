import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from '../Icons';
import { analyzeDinnerFoodTolerance } from '../../utils/dinnerIntelligence';
import { getSymptomLabel, getSymptomEmoji } from '../../utils/dinnerAnalyzer';
import { ATHLETE_ID, INTERVALS_API_KEY } from '../../config/firebase';
import { fetchIntervalsWellness } from '../../utils/intervalsData';

const DinnerProtocolView = ({ logs, dinnerFeedback = [], onSaveFeedback }) => {
    const [intervalsData, setIntervalsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedHistoryDate, setExpandedHistoryDate] = useState(null);
    const [view, setView] = useState('ayer'); // 'ayer' | 'hoy'
    const [bedtimeMinutes, setBedtimeMinutes] = useState(120);

    // Dates
    const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);
    const yesterdayISO = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }, []);

    // Load Intervals Data
    useEffect(() => {
        const fetchWellness = async () => {
            try {
                const dateTo = new Date().toLocaleDateString('sv');
                const dateFrom = new Date();
                dateFrom.setDate(dateFrom.getDate() - 30);
                const fromStr = dateFrom.toLocaleDateString('sv');

                const data = await fetchIntervalsWellness(fromStr, dateTo);
                if (data) {
                    setIntervalsData(data);
                }
            } catch (e) {
                console.error('Error fetching intervals:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchWellness();
    }, []);

    // Analysis
    const analysis = useMemo(() => analyzeDinnerFoodTolerance(logs, dinnerFeedback, intervalsData), [logs, dinnerFeedback, intervalsData]);

    const yesterdayDinner = useMemo(() => {
        return logs.filter(l => (l.dateISO || l.dateStr) === yesterdayISO && l.timeBlock === 'noche');
    }, [logs, yesterdayISO]);

    const todayDinner = useMemo(() => {
        return logs.filter(l => (l.dateISO || l.dateStr) === todayISO && l.timeBlock === 'noche');
    }, [logs, todayISO]);

    // PREDICTIVE ANALYSIS FOR TODAY
    const todayPrediction = useMemo(() => {
        if (todayDinner.length === 0) return null;

        const totals = todayDinner.reduce((acc, l) => ({
            kcal: acc.kcal + (Number(l.calories) || 0),
            fat: acc.fat + (Number(l.fat) || 0),
            prot: acc.prot + (Number(l.protein) || 0),
            fiber: acc.fiber + (Number(l.fiber) || 0),
            mg: acc.mg + (Number(l.mg) || 0),
            k: acc.k + (Number(l.k) || 0),
            na: acc.na + (Number(l.na) || 0)
        }), { kcal: 0, fat: 0, prot: 0, fiber: 0, mg: 0, k: 0, na: 0 });

        let score = 100;
        let reasons = [];
        let verdict = 'ÓPTIMO';
        let color = 'emerald';
        let emoji = '✅';

        // Context from today's waking HRV
        const todayWellness = intervalsData.find(d => d.id === todayISO);
        const hrvValues = intervalsData.filter(d => d.hrv).map(d => d.hrv);
        const avgHRV = hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;

        const wakingHRVLow = todayWellness?.hrv && avgHRV && todayWellness.hrv < avgHRV * 0.9;

        // REGLA 1 (Key): Cena ≥700 kcal + grasa >30 g + ir a la cama <90 min
        if (totals.kcal >= 700 && totals.fat > 30 && bedtimeMinutes < 90) {
            verdict = 'ALARMA';
            color = 'rose';
            emoji = '🚨';
            score = 20;
            reasons.push('Violación Regla 1: Calorías/Grasa altas + sueño muy cercano (HRV baja asegurada)');
        }
        else if (totals.kcal >= 600 || totals.fat > 25) {
            if (bedtimeMinutes < 120) {
                verdict = 'ATENCIÓN';
                color = 'amber';
                emoji = '⚠️';
                score = 50;
                reasons.push('Carga digestiva media-alta con ventana de sueño ajustada');
            }
        }

        if (wakingHRVLow && score > 40) {
            score -= 10;
            reasons.push('⚠️ HRV basal ya está baja hoy: Sistema Simpático dominante, extreman precauciones');
        }

        // Protein Analysis
        if (totals.prot > 45 && bedtimeMinutes < 90) {
            score -= 15;
            reasons.push('Excesiva proteína muy cerca del sueño (termogénesis elevada)');
        }

        // Fiber Analysis
        if (totals.fiber > 15) {
            reasons.push('Fibra alta: posible distensión abdominal nocturna');
        }

        // Micronutrients bonuses
        if (totals.mg > 100) reasons.push('✓ Buen aporte de Magnesio (vagal protector)');
        if (totals.k > 800) reasons.push('✓ Potasio alto: ayuda a control de RHR');
        if (totals.na > 2000) reasons.push('Sodio elevado: posible retención y pulso basal más alto');

        if (score > 80 && verdict !== 'ALARMA') {
            verdict = 'ÓPTIMO';
            color = 'emerald';
            emoji = '✅';
        } else if (score > 50 && verdict !== 'ALARMA') {
            verdict = 'ATENCIÓN';
            color = 'amber';
            emoji = '⚠️';
        } else {
            verdict = 'ALARMA';
            color = 'rose';
            emoji = '🚨';
        }

        return { totals, verdict, color, emoji, reasons, score };
    }, [todayDinner, bedtimeMinutes]);

    const currentFeedback = useMemo(() => {
        return dinnerFeedback.find(f => f.dateISO === yesterdayISO || f.id === yesterdayISO) || { symptoms: [] };
    }, [dinnerFeedback, yesterdayISO]);

    const symptomsList = [
        { id: 'bien', label: 'Todo Bien', emoji: '🟢' },
        { id: 'fa', label: 'Episodio FA', emoji: '🔴' },
        { id: 'pulso_alto', label: 'Pulso Alto', emoji: '⚠️' },
        { id: 'gases', label: 'Gases', emoji: '💨' },
        { id: 'reflujo', label: 'Reflujo', emoji: '🔥' },
        {
            id: 'estres_garmin', label: 'Estrés Garmin', emoji: (
                <div className="flex items-end gap-0.5 h-5">
                    <div className="w-1 h-2 bg-orange-500 rounded-t-sm" />
                    <div className="w-1 h-4 bg-orange-500 rounded-t-sm" />
                    <div className="w-1 h-3 bg-orange-500 rounded-t-sm" />
                    <div className="w-1 h-5 bg-orange-500 rounded-t-sm" />
                </div>
            )
        },
        { id: 'hrv_bajo', label: 'HRV Baja', emoji: '📉' },
        { id: 'pesadez', label: 'Pesadez', emoji: '⚖️' },
        { id: 'insomnio', label: 'Insomnio', emoji: '👁️' },
        // Día Alterado (Excluye del Auditor)
        { id: 'enfermedad', label: 'Enfermo', emoji: '🤒' },
        { id: 'mal_sueno', label: 'Mal Sueño', emoji: '😴' },
        { id: 'social', label: 'Social', emoji: '🍻' },
        { id: 'estres_vital', label: 'Estrés Vital', emoji: '🧠' }
    ];

    const toggleSymptom = (id) => {
        let newSymptoms;
        if (id === 'bien') {
            newSymptoms = currentFeedback.symptoms.includes('bien') ? [] : ['bien'];
        } else {
            const temp = currentFeedback.symptoms.filter(s => s !== 'bien');
            if (temp.includes(id)) {
                newSymptoms = temp.filter(s => s !== id);
            } else {
                newSymptoms = [...temp, id];
            }
        }
        if (onSaveFeedback) onSaveFeedback(yesterdayISO, newSymptoms);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <Icons.Loader2 size={40} className="animate-spin text-indigo-500" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Sincronizando Protocolo...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* VIEW TOGGLE */}
            <div className="flex bg-slate-900/50 p-1.5 rounded-[2rem] border border-white/5 mx-2">
                <button
                    onClick={() => setView('ayer')}
                    className={`flex-1 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${view === 'ayer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    <Icons.History size={16} /> Ayer (Feedback)
                </button>
                <button
                    onClick={() => setView('hoy')}
                    className={`flex-1 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${view === 'hoy' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    <Icons.Zap size={16} /> Hoy (Análisis)
                </button>
            </div>

            {/* PROTOCOLO AYER */}
            {view === 'ayer' && (
                <section className="bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-8 bg-gradient-to-br from-indigo-950/50 to-transparent">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Cena de Ayer</h2>
                                <p className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase">{yesterdayISO.split('-').reverse().join('/')}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                <Icons.Moon className="text-indigo-400" size={20} />
                            </div>
                        </div>

                        {/* What was eaten */}
                        <div className="mb-8 p-4 bg-black/40 rounded-2xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Menú registrado</p>
                            <div className="flex flex-wrap gap-2">
                                {yesterdayDinner.length > 0 ? (
                                    yesterdayDinner.map((f, i) => (
                                        <span key={i} className="text-xs text-white bg-white/5 py-1 px-3 rounded-full border border-white/10">
                                            {f.name}
                                        </span>
                                    ))
                                ) : (
                                    <p className="text-[10px] text-slate-500 italic font-bold">No hay registros de cena ayer</p>
                                )}
                            </div>
                        </div>

                        {/* Feedback Buttons */}
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">¿Cómo te sentó?</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {symptomsList.map(s => {
                                    const isActive = currentFeedback.symptoms.includes(s.id);
                                    const isAlteredDay = ['enfermedad', 'mal_sueno', 'social', 'estres_vital'].includes(s.id);

                                    let activeStyle = '';
                                    if (isActive) {
                                        if (s.id === 'bien') {
                                            activeStyle = 'bg-teal-500 border-teal-400 text-white shadow-[0_0_20px_rgba(20,184,166,0.3)]';
                                        } else if (isAlteredDay) {
                                            activeStyle = 'bg-violet-500 border-violet-400 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]';
                                        } else {
                                            activeStyle = 'bg-rose-500 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]';
                                        }
                                    }

                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => toggleSymptom(s.id)}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 group active:scale-95
                                                ${isActive
                                                    ? activeStyle
                                                    : isAlteredDay
                                                        ? 'bg-violet-500/10 border-violet-500/30 text-slate-400 hover:border-violet-400/50 hover:bg-violet-500/20'
                                                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30 hover:bg-white/10'}`}
                                        >
                                            <span className="text-xl group-hover:scale-125 transition-transform">{s.emoji}</span>
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-white' : isAlteredDay ? 'text-violet-400' : 'text-slate-500'}`}>{s.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* PREDICTIVO HOY */}
            {view === 'hoy' && (
                <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Today's Dinner Summary */}
                    <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Cena de Hoy</h2>
                                <p className="text-[10px] font-black text-emerald-400 tracking-[0.3em] uppercase">Predictor Inteligente</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-emerald-400">
                                <Icons.Zap size={20} />
                            </div>
                        </div>

                        {todayDinner.length > 0 ? (
                            <div className="space-y-6">
                                {/* Totals Bar */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Calories</p>
                                        <p className="text-base font-black text-white">{Math.round(todayPrediction.totals.kcal)}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Grasa</p>
                                        <p className="text-base font-black text-amber-500">{Math.round(todayPrediction.totals.fat)}g</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Proteína</p>
                                        <p className="text-base font-black text-indigo-400">{Math.round(todayPrediction.totals.prot)}g</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Fibra</p>
                                        <p className="text-base font-black text-emerald-400">{Math.round(todayPrediction.totals.fiber)}g</p>
                                    </div>
                                </div>

                                {/* Bedtime Slider */}
                                <div className="bg-black/40 p-5 rounded-3xl border border-white/10 shadow-inner">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Icons.Clock size={12} className="text-emerald-400" /> Tiempo hasta dormir
                                        </p>
                                        <span className={`px-4 py-1.5 rounded-full text-sm font-black transition-all ${bedtimeMinutes < 90 ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' : bedtimeMinutes < 120 ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'}`}>
                                            {bedtimeMinutes} min
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="30"
                                        max="240"
                                        step="15"
                                        value={bedtimeMinutes}
                                        onChange={(e) => setBedtimeMinutes(Number(e.target.value))}
                                        className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <div className="flex justify-between mt-3 text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                                        <span className="flex items-center gap-1"><Icons.AlertTriangle size={8} /> Riesgo</span>
                                        <span>Ideal: +150m</span>
                                        <span className="flex items-center gap-1">Óptimo <Icons.Check size={8} /></span>
                                    </div>
                                </div>

                                {/* Verdict Card */}
                                <div className={`p-6 rounded-[2.5rem] border-2 bg-gradient-to-br transition-all duration-700 border-${todayPrediction.color}-500/30 from-${todayPrediction.color}-500/10 to-transparent shadow-xl`}>
                                    <div className="text-center mb-6">
                                        <p className={`text-[10px] font-black text-${todayPrediction.color}-500 uppercase tracking-[0.3em] mb-1`}>Predicción Vagal</p>
                                        <h1 className={`text-5xl font-black text-${todayPrediction.color}-500 mb-2 tracking-tighter italic drop-shadow-sm`}>
                                            {todayPrediction.emoji} {todayPrediction.verdict}
                                        </h1>
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full bg-${todayPrediction.color}-500 transition-all duration-1000`} style={{ width: `${todayPrediction.score}%` }} />
                                            </div>
                                            <p className="text-[10px] text-white/50 font-black uppercase">
                                                Estabilidad: {todayPrediction.score}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {todayPrediction.reasons.map((r, i) => (
                                            <div key={i} className="flex gap-3 items-center bg-black/30 p-4 rounded-2xl border border-white/5 group hover:bg-black/40 transition-colors">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${r.startsWith('✓') ? 'bg-emerald-500' : 'bg-' + todayPrediction.color + '-500 animate-pulse'}`} />
                                                <p className="text-[11px] font-bold text-slate-300 leading-tight italic">{r}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Technical Micros Breakdown */}
                                <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Icons.Activity size={12} /> Análisis de Micronutrientes
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] uppercase font-black">
                                                <span className="text-indigo-400">Magnesio</span>
                                                <span className="text-white">{Math.round(todayPrediction.totals.mg)}mg</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full">
                                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (todayPrediction.totals.mg / 200) * 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] uppercase font-black">
                                                <span className="text-emerald-400">Potasio</span>
                                                <span className="text-white">{Math.round(todayPrediction.totals.k)}mg</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (todayPrediction.totals.k / 1500) * 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] uppercase font-black">
                                                <span className="text-rose-400">Sodio</span>
                                                <span className="text-white">{Math.round(todayPrediction.totals.na)}mg</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full">
                                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, (todayPrediction.totals.na / 2300) * 100)}%` }} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] uppercase font-black">
                                                <span className="text-amber-400">Ratio Na:K</span>
                                                <span className="text-white">{(todayPrediction.totals.na / (todayPrediction.totals.k || 1)).toFixed(2)}</span>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full">
                                                <div className={`h-full rounded-full ${todayPrediction.totals.na / (todayPrediction.totals.k || 1) > 1 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (todayPrediction.totals.na / (todayPrediction.totals.k || 1)) * 50)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white/5 rounded-[2.5rem] border-2 border-dashed border-white/10">
                                <Icons.Moon className="mx-auto text-slate-800 mb-4" size={48} />
                                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Nada en el plato todavía</p>
                                <p className="text-[10px] text-slate-600 mt-2 px-10 leading-relaxed font-bold uppercase tracking-tighter">
                                    Registra alimentos en el bloque 'Noche' para activar el predictor de impacto en HRV
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* EL SEMÁFORO VAGAL (FILAS DESPLEGABLES) */}
            <section className="space-y-4">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-white/5"></div>
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">El Semáforo Vagal</h3>
                    <div className="h-px flex-1 bg-white/5"></div>
                </div>

                {/* ZONA SEGURA */}
                <details className="group bg-emerald-500/5 rounded-[2rem] border border-emerald-500/20 overflow-hidden">
                    <summary className="p-6 flex items-center justify-between cursor-pointer list-none">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest italic">Zona Segura</h4>
                        </div>
                        <Icons.ChevronDown className="text-emerald-500 group-open:rotate-180 transition-transform" size={18} />
                    </summary>
                    <div className="px-8 pb-6 space-y-3">
                        {analysis.wellTolerated.map((f, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 translate-x-1">
                                <span className="text-sm text-slate-200">{f.name}</span>
                                <span className="text-[10px] font-black text-emerald-400/60 uppercase">{Math.round(f.stableRatio * 100)}% Éxito</span>
                            </div>
                        ))}
                    </div>
                </details>

                {/* MODERACIÓN */}
                <details className="group bg-amber-500/5 rounded-[2rem] border border-amber-500/20 overflow-hidden">
                    <summary className="p-6 flex items-center justify-between cursor-pointer list-none">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                            <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest italic">Moderación</h4>
                        </div>
                        <Icons.ChevronDown className="text-amber-500 group-open:rotate-180 transition-transform" size={18} />
                    </summary>
                    <div className="px-8 pb-6 space-y-3">
                        {analysis.allFoods
                            .filter(f => f.stableRatio < 0.6 && f.stableRatio > 0.4)
                            .map((f, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 translate-x-1">
                                    <span className="text-sm text-slate-200">{f.name}</span>
                                    <span className="text-[10px] font-black text-amber-400/60 uppercase">{Math.round(f.stableRatio * 100)}%</span>
                                </div>
                            ))}
                    </div>
                </details>

                {/* ZONA DE ALERTA */}
                <details className="group bg-rose-500/5 rounded-[2rem] border border-rose-500/20 overflow-hidden">
                    <summary className="p-6 flex items-center justify-between cursor-pointer list-none">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
                            <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest italic">Zona de Alerta</h4>
                        </div>
                        <Icons.ChevronDown className="text-rose-500 group-open:rotate-180 transition-transform" size={18} />
                    </summary>
                    <div className="px-8 pb-6 space-y-3">
                        {analysis.toWatch.map((f, i) => (
                            <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 translate-x-1">
                                <span className="text-sm text-slate-200">{f.name}</span>
                                <span className="text-[10px] font-black text-rose-400 uppercase bg-rose-400/10 px-2 py-1 rounded">
                                    {f.topSymptom ? getSymptomLabel(f.topSymptom[0]) : 'Evitar'}
                                </span>
                            </div>
                        ))}
                    </div>
                </details>
            </section>

            {/* HISTORIAL DE NOCHES (DESPLEGABLE) */}
            <details className="group bg-slate-900/40 rounded-[2rem] border border-white/5 overflow-hidden">
                <summary className="p-8 flex justify-between items-center cursor-pointer list-none">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest italic flex items-center gap-3">
                        <Icons.History className="text-slate-500" size={16} />
                        Historial de Noches
                    </h3>
                    <Icons.ChevronDown className="text-slate-500 group-open:rotate-180 transition-transform" size={18} />
                </summary>

                <div className="px-8 pb-8 space-y-3">
                    {dinnerFeedback
                        .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
                        .slice(0, 10)
                        .map((f, i) => {
                            const dateStr = f.dateISO.split('-').reverse().slice(0, 2).join('/');
                            const isGood = f.symptoms.includes('bien');
                            const isExpanded = expandedHistoryDate === f.dateISO;
                            const nightLogs = logs.filter(l => (l.dateISO || l.dateStr) === f.dateISO && l.timeBlock === 'noche');

                            return (
                                <div key={i} className="flex flex-col gap-2">
                                    <button
                                        onClick={() => setExpandedHistoryDate(isExpanded ? null : f.dateISO)}
                                        className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-black text-xs
                                                ${isGood ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                                {dateStr}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {f.symptoms.map(s => (
                                                    <span key={s} title={getSymptomLabel(s)} className="text-base">{getSymptomEmoji(s)}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <Icons.ChevronDown className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={14} />
                                    </button>

                                    {isExpanded && (
                                        <div className="mx-4 p-4 bg-black/40 rounded-2xl border-x border-b border-white/10 animate-slide-down">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Cena de esa noche:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {nightLogs.length > 0 ? (
                                                    nightLogs.map((nl, idx) => (
                                                        <span key={idx} className="text-sm text-white/80 bg-white/10 py-2 px-4 rounded-full border border-white/10">
                                                            {nl.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-600 italic">Sin registros detallados</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    }
                </div>
            </details>
        </div>
    );
};

export default DinnerProtocolView;
