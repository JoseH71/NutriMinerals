import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';
import {
    calculateJoseScore,
    extractDinnerData,
    getActivityType,
    getActivityDuration,
    calculateInercia
} from '../../utils/oraculoEngine';

import { ATHLETE_ID, INTERVALS_API_KEY, SHARED_USER_ID } from '../../config/firebase';
import { fetchIntervalsWellness, fetchIntervalsActivities } from '../../utils/intervalsData';
import { db } from '../../App';
import { savePrediction, getPrediction, validatePrediction, getAllPredictions } from '../../services/predictionService';
import {
    calculateDigestiveLoad,
    getHRVDelta,
    getAutomaticVerdict,
    getSymptomEmoji,
    getSymptomLabel
} from '../../utils/dinnerAnalyzer';
import { analyzeDinnerFoodTolerance } from '../../utils/dinnerIntelligence';

// Register ChartJS
ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

/**
 * ORACULO V2.0 - "BIO-HACKER DASHBOARD"
 * Interfaz técnica de alta precisión, rejillas militares y visualización de datos bio-autónomos.
 */
const OraculoView = ({ logs, appId, myFoods, dinnerFeedback = [], onSaveFeedback }) => {
    // --- STATE ---
    const [intervalsData, setIntervalsData] = useState([]);
    const [activitiesData, setActivitiesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [estresNocturno, setEstresNocturno] = useState('bajo');
    const [showSimulator, setShowSimulator] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [simulatorOverrides, setSimulatorOverrides] = useState({});
    const [validation, setValidation] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [viewDate, setViewDate] = useState(() => new Date().toLocaleDateString('sv'));
    const [showDinnerAnalysis, setShowDinnerAnalysis] = useState(false);
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [showBioTolerance, setShowBioTolerance] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [pastPredictions, setPastPredictions] = useState([]);
    const [showAuditHistory, setShowAuditHistory] = useState(false);

    const chartRef = useRef(null);

    // --- LOGIC ---
    const yesterdayISO = useMemo(() => {
        const d = new Date(viewDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }, [viewDate]);

    useEffect(() => {
        const feedback = dinnerFeedback.find(f => f.dateISO === yesterdayISO || f.id === yesterdayISO);
        if (feedback && feedback.symptoms) {
            setSelectedSymptoms(feedback.symptoms);
        } else {
            setSelectedSymptoms([]);
        }
    }, [yesterdayISO, dinnerFeedback]);

    const toggleSymptom = (symptomId) => {
        setSelectedSymptoms(prev => {
            let newSymptoms;
            if (symptomId === 'bien') {
                newSymptoms = prev.includes('bien') ? [] : ['bien'];
            } else {
                const filtered = prev.filter(s => s !== 'bien');
                if (filtered.includes(symptomId)) {
                    newSymptoms = filtered.filter(s => s !== symptomId);
                } else {
                    newSymptoms = [...filtered, symptomId];
                }
            }
            if (onSaveFeedback) {
                onSaveFeedback(yesterdayISO, newSymptoms);
            }
            return newSymptoms;
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const dateTo = new Date().toLocaleDateString('sv');
                const dateFrom = new Date();
                dateFrom.setDate(dateFrom.getDate() - 30);
                const fromStr = dateFrom.toLocaleDateString('sv');

                const [wellness, activities] = await Promise.all([
                    fetchIntervalsWellness(fromStr, dateTo),
                    fetchIntervalsActivities(fromStr, dateTo)
                ]);

                setIntervalsData(wellness);
                setActivitiesData(activities);

                if (db && SHARED_USER_ID) {
                    const prevPred = await getPrediction(db, SHARED_USER_ID, appId, yesterdayISO);
                    if (prevPred) {
                        const currentWellness = wellness.find(d => d.id === viewDate);
                        if (currentWellness && currentWellness.hrv) {
                            const dateIdx = wellness.findIndex(d => d.id === viewDate);
                            const relevantWellness = wellness.slice(dateIdx, dateIdx + 7);
                            const baseline = relevantWellness.filter(d => d.hrv).reduce((sum, d) => sum + d.hrv, 0) /
                                (relevantWellness.filter(d => d.hrv).length || 1);

                            const val = validatePrediction(prevPred, { ...currentWellness, baselineHRV: baseline });
                            const yesterdayWellness = wellness.find(d => d.id === yesterdayISO);
                            setValidation({
                                ...val,
                                prevHRV: yesterdayWellness?.hrv,
                                delta: yesterdayWellness ? (currentWellness.hrv - yesterdayWellness.hrv) : null,
                                joseScore: prevPred.total
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('Error fetching data:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [appId, viewDate, yesterdayISO]);

    useEffect(() => {
        const fetchPredictions = async () => {
            if (!db || !SHARED_USER_ID) return;
            const preds = await getAllPredictions(db, SHARED_USER_ID, appId);
            setPastPredictions(preds.sort((a, b) => b.date.localeCompare(a.date)));
        };
        fetchPredictions();
    }, [appId]);

    const todayISO = new Date().toLocaleDateString('sv');
    const isViewToday = viewDate === todayISO;

    const prediction = useMemo(() => {
        if (!logs || !intervalsData) return null;

        const dayLogs = logs.filter(l => {
            const logDate = l.dateISO || (l.dateStr ? l.dateStr.split('/').reverse().join('-') : '');
            return logDate === viewDate;
        });

        const nutrition = dayLogs.reduce((acc, l) => ({
            calories: acc.calories + (Number(l.calories) || 0),
            carbs: acc.carbs + (Number(l.carbs) || 0),
        }), { calories: 0, carbs: 0 });

        const dinnerData = extractDinnerData(dayLogs);
        const taurinaNoche = dayLogs.some(l => l.timeBlock === 'noche' && l.name?.toLowerCase().includes('taurina'));

        const dayActivities = activitiesData?.filter(a => a.start_date_local?.startsWith(viewDate)) || [];
        const activityType = getActivityType(dayActivities);
        const activityDuration = getActivityDuration(dayActivities);

        const prevWellness = intervalsData.find(d => d.id === yesterdayISO);
        const sleepScoreYesterday = prevWellness?.sleepScore || null;

        const currentWellness = intervalsData.find(d => d.id === viewDate);
        const tsb = currentWellness ? (currentWellness.ctl - currentWellness.atl) : 0;

        const baselineHRV_final = intervalsData.slice(0, 60).filter(d => d.hrv).reduce((sum, d) => sum + d.hrv, 0) /
            (intervalsData.slice(0, 60).filter(d => d.hrv).length || 1);

        const currentHRV = currentWellness?.hrv || baselineHRV_final;

        const dateIdx = intervalsData.findIndex(d => d.id === viewDate);
        const precedingHrvData = dateIdx !== -1 ? intervalsData.slice(dateIdx, dateIdx + 3).map(d => d.hrv).filter(v => v) : [];
        const inercia = calculateInercia(precedingHrvData, baselineHRV_final);

        const readyScore = currentWellness?.readyScore || null;

        const data = {
            calories: showSimulator && simulatorOverrides.calories !== undefined ? simulatorOverrides.calories : nutrition.calories,
            carbs: showSimulator && simulatorOverrides.carbs !== undefined ? simulatorOverrides.carbs : nutrition.carbs,
            dinnerKcal: showSimulator && simulatorOverrides.dinnerKcal !== undefined ? simulatorOverrides.dinnerKcal : dinnerData.dinnerKcal,
            dinnerFat: showSimulator && simulatorOverrides.dinnerFat !== undefined ? simulatorOverrides.dinnerFat : dinnerData.dinnerFat,
            dinnerFiber: dinnerData.dinnerFiber,
            dinnerTime: dinnerData.dinnerTime,
            taurinaNoche,
            estresNocturno: showSimulator && simulatorOverrides.estresNocturno !== undefined ? simulatorOverrides.estresNocturno : estresNocturno,
            activityType: showSimulator && simulatorOverrides.activityType !== undefined ? simulatorOverrides.activityType : activityType,
            activityDuration: showSimulator && simulatorOverrides.activityDuration !== undefined ? simulatorOverrides.activityDuration : activityDuration,
            sleepScoreYesterday,
            tsb,
            inercia,
            readyScore,
            todayActivities: dayActivities
        };

        const scoreResult = calculateJoseScore(data, logs, myFoods);
        const predictedHRV = Math.round(currentHRV + scoreResult.total);

        return {
            ...scoreResult,
            todayActivities: dayActivities,
            tsb,
            rawData: data,
            baselineHRV: baselineHRV_final,
            baseHRV: currentHRV,
            predictedHRV
        };
    }, [logs, intervalsData, activitiesData, viewDate, estresNocturno, showSimulator, simulatorOverrides, myFoods, yesterdayISO]);

    // Radar Chart Logic
    useEffect(() => {
        if (!prediction || !chartRef.current) return;

        const ctx = chartRef.current.getContext('2d');
        const b = prediction.breakdown;

        // Scores for radar visualization (scaled appropriately)
        const labels = ['Energía', 'Noche', 'Estímulo', 'Contexto'];
        const values = [
            b.energyScore * 2,
            b.nightScore * 2,
            b.stimulusScore,
            b.contextScore
        ];

        const chart = new ChartJS(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: 'Bio-Balance',
                    data: values,
                    backgroundColor: 'rgba(79, 70, 229, 0.2)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(79, 70, 229, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(79, 70, 229, 1)'
                }]
            },
            options: {
                scales: {
                    r: {
                        min: -3,
                        max: 3,
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { size: 10, weight: 'bold', family: 'monospace' }
                        },
                        ticks: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });

        return () => chart.destroy();
    }, [prediction]);

    const handleSavePrediction = async () => {
        if (!db || !SHARED_USER_ID || !prediction) return;
        setIsSaving(true);
        const success = await savePrediction(db, SHARED_USER_ID, appId, {
            ...prediction,
            dateISO: viewDate,
            createdAt: new Date().toISOString()
        });
        setIsSaving(false);
        setSaveStatus(success ? 'success' : 'error');
        if (success) setTimeout(() => setSaveStatus(null), 3000);
    };

    if (loading || !prediction) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#020617]">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">Booting System...</p>
                </div>
            </div>
        );
    }

    const config = {
        up: { color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', icon: 'ChevronUp' },
        neutral: { color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', icon: 'Minus' },
        down: { color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/5', icon: 'ChevronDown' }
    }[prediction.trend] || { color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/5', icon: 'Minus' };

    const TrendIcon = LucideIcons[config.icon] || LucideIcons.Minus;

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 font-sans pb-32 overflow-x-hidden selection:bg-indigo-500/30">
            {/* Top Security Bar */}
            <header className="px-6 py-4 flex justify-between items-center bg-[#020617] border-b border-white/5 sticky top-0 z-50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.3em]">System.Oraculo_v2.0</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setShowLegend(true)} className="text-white/40 hover:text-white transition-colors"><LucideIcons.Info size={16} /></button>
                    <button onClick={() => setShowSimulator(!showSimulator)} className={`${showSimulator ? 'text-indigo-400' : 'text-white/40'} hover:text-indigo-400 transition-colors`}><LucideIcons.Settings2 size={16} /></button>
                </div>
            </header>

            {/* Date Protocol Selector */}
            <div className="px-6 py-6 bg-slate-900/40 border-b border-white/5 overflow-x-auto no-scrollbar">
                <div className="flex items-center justify-between min-w-[300px]">
                    <button onClick={() => {
                        const d = new Date(viewDate + 'T12:00:00');
                        d.setDate(d.getDate() - 1);
                        setViewDate(d.toLocaleDateString('sv'));
                    }} className="p-2 text-white/20 hover:text-white transition-colors"><LucideIcons.ChevronLeft size={20} /></button>

                    <div className="text-center">
                        <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-[0.4em] mb-1">Target Protocol</p>
                        <p className="text-lg font-mono font-bold tracking-tight">
                            {viewDate.split('-').reverse().join('.')}
                            {isViewToday && <span className="ml-2 text-indigo-500/60 text-[10px]">[REAL_TIME]</span>}
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            const d = new Date(viewDate + 'T12:00:00');
                            d.setDate(d.getDate() + 1);
                            if (d <= new Date()) setViewDate(d.toLocaleDateString('sv'));
                        }}
                        disabled={isViewToday}
                        className={`p-2 transition-colors ${isViewToday ? 'opacity-0' : 'text-white/20 hover:text-white'}`}
                    >
                        <LucideIcons.ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <main className="px-5 mt-8 space-y-6">
                {/* Hero section: Radar + Score */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-indigo-500">
                            <LucideIcons.Activity size={120} />
                        </div>
                        <canvas ref={chartRef} className="max-w-[280px] mx-auto"></canvas>
                    </div>

                    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
                        <div className="relative z-10 w-full">
                            <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.5em] mb-4">Jose_Score.exec</p>
                            <div className="flex items-baseline justify-center gap-2 mb-2">
                                <h2 className={`text-8xl font-mono font-black tracking-tighter ${config.color}`}>
                                    {prediction.total > 0 ? '+' : ''}{prediction.total}
                                </h2>
                                <span className="text-indigo-400/20 font-mono text-xl">PTS</span>
                            </div>
                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${config.border} ${config.bg} mb-8`}>
                                <TrendIcon size={14} className={config.color} />
                                <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${config.color}`}>{prediction.trend}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-8 w-full">
                                <div className="text-center">
                                    <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest mb-1">Target HRV</p>
                                    <p className="text-2xl font-mono font-bold">{prediction.predictedHRV}<span className="text-[10px] text-white/20 ml-1">MS</span></p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[8px] font-mono text-white/40 uppercase tracking-widest mb-1">Confidence</p>
                                    <p className="text-2xl font-mono font-bold uppercase text-indigo-400">{prediction.confidence}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pillars Section: Technical Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Energía', val: prediction.breakdown.energyScore, icon: 'Zap', color: 'text-amber-400' },
                        { label: 'Noche', val: prediction.breakdown.nightScore, icon: 'Moon', color: 'text-indigo-400' },
                        { label: 'Estimulo', val: prediction.breakdown.stimulusScore, icon: 'Dumbbell', color: 'text-rose-400' },
                        { label: 'Contexto', val: prediction.breakdown.contextScore, icon: 'Layers', color: 'text-emerald-400' }
                    ].map(p => (
                        <div key={p.label} className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-2">
                            <div className={`p-2 rounded-lg bg-white/5 ${p.color}`}>
                                {React.createElement(LucideIcons[p.icon] || LucideLucideIcons.Activity, { size: 16 })}
                            </div>
                            <p className="text-[11px] font-mono font-bold uppercase text-white/40">{p.label}</p>
                            <p className="text-xl font-mono font-black">{p.val > 0 ? '+' : ''}{p.val}</p>
                        </div>
                    ))}
                </div>

                {/* Tactical Analysis Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4 px-2">
                        <div className="h-px flex-1 bg-white/5"></div>
                        <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.4em]">Tactical_Analysis</p>
                        <div className="h-px flex-1 bg-white/5"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Digestive Log */}
                        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">Digestive_Status</h4>
                                <LucideIcons.Database size={14} className="text-indigo-500/40" />
                            </div>
                            {(() => {
                                const yesterdayLogs = logs.filter(l => (l.dateISO || l.dateStr) === yesterdayISO && l.timeBlock === 'noche');
                                if (yesterdayLogs.length === 0) return <p className="text-[10px] font-mono text-white/20 italic">NULL_RECORDS_YESTERDAY</p>;

                                const load = calculateDigestiveLoad(yesterdayLogs);
                                const hrvDelta = intervalsData.find(d => d.id === viewDate)?.hrv ? getHRVDelta(intervalsData.find(d => d.id === viewDate).hrv, intervalsData) : null;
                                const verdict = getAutomaticVerdict(hrvDelta, load, selectedSymptoms.includes('fa'));
                                const vColor = { good: 'text-emerald-400', warning: 'text-amber-400', critical: 'text-rose-400' }[verdict];

                                return (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-mono text-white/20 mb-1">Varianza [24H]</p>
                                                <p className="text-2xl font-mono font-bold">{hrvDelta ? (hrvDelta > 0 ? `+${hrvDelta}` : hrvDelta) : '??'} <span className="text-[10px] opacity-20 ml-1 underline">ms</span></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-mono text-white/20 mb-1">Verdict</p>
                                                <p className={`text-sm font-mono font-bold uppercase ${vColor}`}>{verdict}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {['bien', 'gases', 'pulso_alto', 'reflujo', 'estres'].map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => toggleSymptom(s)}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase transition-all border ${selectedSymptoms.includes(s) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20'}`}
                                                >
                                                    {getSymptomLabel(s)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Current Load Check */}
                        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">Input_Flow</h4>
                                <LucideIcons.Terminal size={14} className="text-indigo-500/40" />
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <LucideIcons.Zap size={14} className="text-amber-400" />
                                        <span className="text-[10px] font-mono text-white/60">CARBS</span>
                                    </div>
                                    <p className="text-sm font-mono font-bold">{Math.round(prediction.rawData.carbs)}G</p>
                                </div>
                                <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <LucideIcons.Trophy size={14} className="text-indigo-400" />
                                        <span className="text-[10px] font-mono text-white/60">ACTIVITY</span>
                                    </div>
                                    <p className="text-xs font-mono font-bold uppercase truncate max-w-[120px]">{prediction.rawData.activityType}</p>
                                </div>
                                <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <LucideIcons.Brain size={14} className="text-emerald-400" />
                                        <span className="text-[10px] font-mono text-white/60">MENTAL_STRESS</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {['bajo', 'medio', 'alto'].map(l => (
                                            <button
                                                key={l}
                                                onClick={() => setEstresNocturno(l)}
                                                className={`text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded border transition-colors ${estresNocturno === l ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Logs (Causes) */}
                <div className="bg-slate-900/40 border-2 border-dashed border-white/5 rounded-2xl p-6">
                    <h4 className="text-[10px] font-mono font-bold text-white/20 uppercase tracking-[0.4em] mb-6">System.Event_Logs</h4>
                    <div className="space-y-3">
                        {prediction.causes.positive.map((c, i) => (
                            <div key={i} className="flex items-center gap-4 text-[10px] font-mono text-emerald-400/80">
                                <span className="text-emerald-500/40 font-bold">[INFO]</span> {c}
                            </div>
                        ))}
                        {prediction.causes.negative.map((c, i) => (
                            <div key={i} className="flex items-center gap-4 text-[10px] font-mono text-rose-400/80">
                                <span className="text-rose-500/40 font-bold">[WARN]</span> {c}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Final Protocol Confirmation */}
                <button
                    onClick={handleSavePrediction}
                    disabled={isSaving || !!saveStatus}
                    className={`w-full py-5 rounded-2xl font-mono font-black uppercase tracking-[0.4em] text-xs transition-all flex items-center justify-center gap-4 border shadow-[0_0_30px_rgba(79,70,229,0.1)] active:scale-[0.98] ${saveStatus === 'success' ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/20' : 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20 hover:bg-indigo-500'}`}
                >
                    {isSaving ? <LucideIcons.Loader2 className="animate-spin" size={18} /> : saveStatus === 'success' ? <LucideIcons.Check size={18} /> : <LucideIcons.ShieldCheck size={18} />}
                    {saveStatus === 'success' ? 'LOG_STORED' : 'EXECUTE_PROTOCOL'}
                </button>

                <div className="flex gap-4">
                    <button
                        onClick={() => setShowAuditHistory(true)}
                        className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-mono font-bold uppercase text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <LucideIcons.History size={16} /> History_Audit
                    </button>
                    <button
                        onClick={() => setShowBioTolerance(true)}
                        className="flex-1 py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-mono font-bold uppercase text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <LucideIcons.Compass size={16} /> Bio_Patterns
                    </button>
                </div>
            </main>

            {/* Simulation Laboratory Overlay */}
            {showSimulator && (
                <div className="fixed inset-0 z-[100] bg-[#020617]/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-indigo-500/5">
                            <div>
                                <h2 className="text-xl font-mono font-black uppercase text-white">Bio_Lab.hypothese</h2>
                                <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mt-1">Simulator mode enabled</p>
                            </div>
                            <button onClick={() => setShowSimulator(false)} className="p-2 text-white/20 hover:text-white"><LucideIcons.X size={24} /></button>
                        </div>

                        <div className="p-8 space-y-10">
                            {[
                                { label: 'Caloric_Load', unit: 'Kcal', key: 'calories', min: 1000, max: 4000, step: 100 },
                                { label: 'CHO_Availability', unit: 'G', key: 'carbs', min: 50, max: 600, step: 10 }
                            ].map(slide => (
                                <div key={slide.key} className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">{slide.label}</p>
                                        <p className="text-xl font-mono font-bold text-indigo-400">{simulatorOverrides[slide.key] || Math.round(prediction.rawData[slide.key])} <span className="text-xs text-white/20">{slide.unit}</span></p>
                                    </div>
                                    <input
                                        type="range" {...slide}
                                        value={simulatorOverrides[slide.key] || Math.round(prediction.rawData[slide.key])}
                                        onChange={e => setSimulatorOverrides({ ...simulatorOverrides, [slide.key]: Number(e.target.value) })}
                                        className="w-full accent-indigo-500 h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                                    />
                                </div>
                            ))}

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {['BiciCalle', 'Rodillo', 'Gym', 'Descanso'].map(at => (
                                    <button
                                        key={at}
                                        onClick={() => setSimulatorOverrides({ ...simulatorOverrides, activityType: at })}
                                        className={`py-4 rounded-xl text-[9px] font-mono font-bold uppercase transition-all border ${(simulatorOverrides.activityType || prediction.rawData.activityType) === at ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}
                                    >
                                        {at}
                                    </button>
                                ))}
                            </div>

                            <div className="pt-8 border-t border-white/5 flex gap-4">
                                <button onClick={() => setSimulatorOverrides({})} className="flex-1 py-4 text-[10px] font-mono uppercase text-rose-400/60 font-bold tracking-widest hover:text-rose-400 transition-colors">Clear_Variables</button>
                                <button onClick={() => setShowSimulator(false)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-mono font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">Apply_Model</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Audit History (Technical List) */}
            {showAuditHistory && (
                <div className="fixed inset-0 z-[100] bg-[#020617] p-8 overflow-y-auto animate-in slide-in-from-bottom duration-500">
                    <div className="max-w-2xl mx-auto pb-32">
                        <div className="flex justify-between items-center mb-16 px-2">
                            <div>
                                <h2 className="text-3xl font-mono font-black text-white tracking-tighter uppercase mb-2">Audit.Log</h2>
                                <p className="text-[10px] font-mono text-indigo-400/40 uppercase tracking-[0.4em]">Validation history results</p>
                            </div>
                            <button onClick={() => setShowAuditHistory(false)} className="p-3 text-white/40 bg-white/5 rounded-2xl"><LucideIcons.X size={28} /></button>
                        </div>
                        <div className="space-y-4">
                            {pastPredictions.map((pred, i) => {
                                const targetDate = new Date(pred.date + 'T12:00:00');
                                targetDate.setDate(targetDate.getDate() + 1);
                                const actual = intervalsData.find(d => d.id === targetDate.toISOString().split('T')[0]);
                                if (!actual) return null;
                                const audit = validatePrediction(pred, { ...actual, baselineHRV: pred.baselineHRV });

                                return (
                                    <div key={i} className={`p-6 bg-slate-900 border ${audit.correct ? 'border-emerald-500/20' : 'border-rose-500/20'} rounded-2xl relative overflow-hidden`}>
                                        <div className="flex justify-between items-center mb-6">
                                            <span className="text-[10px] font-mono font-bold text-white/20">{pred.date}</span>
                                            <span className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded ${audit.correct ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                {audit.correct ? 'PR_OK' : 'PR_FAIL'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-[8px] font-mono text-white/20 uppercase mb-1">Real_Value</p>
                                                <p className="text-4xl font-mono font-bold text-white tracking-tighter">{Math.round(audit.actualHRV)}<span className="text-[10px] opacity-20 ml-1 underline">ms</span></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-mono text-white/20 uppercase mb-1">Forecasted</p>
                                                <p className="text-2xl font-mono font-bold text-white/40">{Math.round(audit.predictedHRV)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* BioTolerance Overlay */}
            {showBioTolerance && (() => {
                const foodAnalysis = analyzeDinnerFoodTolerance(logs, dinnerFeedback, intervalsData);
                const displayFoods = selectedCategory === 'all' ? foodAnalysis.allFoods : foodAnalysis.foodsByCategory[selectedCategory] || [];
                return (
                    <div className="fixed inset-0 bg-[#020617] z-[100] flex flex-col p-8 animate-in slide-in-from-bottom duration-500">
                        <div className="flex justify-between items-center mb-12">
                            <div>
                                <h2 className="text-3xl font-mono font-black text-white tracking-tighter uppercase mb-2">Tolerance.DB</h2>
                                <p className="text-[10px] font-mono text-indigo-400/40 uppercase tracking-[0.4em]">Food vs HRV Correlation engine</p>
                            </div>
                            <button onClick={() => setShowBioTolerance(false)} className="p-3 text-white/40 bg-white/5 rounded-2xl"><LucideIcons.X size={28} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-8 pb-32 no-scrollbar">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                                {['all', ...Object.keys(foodAnalysis.foodsByCategory)].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-6 py-3 rounded-xl text-[9px] font-mono font-black uppercase whitespace-nowrap border transition-all ${selectedCategory === cat ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}
                                    >
                                        {cat === 'all' ? 'FULL_DB' : cat}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                {displayFoods.map((food, i) => (
                                    <div key={i} className="bg-slate-900 border border-white/5 p-6 rounded-2xl space-y-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-base font-mono font-black uppercase text-white tracking-tight">{food.name}</h4>
                                                <p className="text-[8px] font-mono text-indigo-400 uppercase mt-1 tracking-widest">{food.category}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-3xl font-mono font-black ${food.stableRatio >= 0.6 ? 'text-emerald-400' : 'text-rose-400'}`}>{Math.round(food.stableRatio * 100)}%</p>
                                                <p className="text-[8px] font-mono font-bold uppercase text-white/20 mt-1">Bio_Score.val</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-white/5 p-0.5 border border-white/5">
                                            {food.timeline.slice(-20).map((e, idx) => (
                                                <div key={idx} className={`flex-1 rounded-sm ${e.wasStable ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`} />
                                            ))}
                                        </div>

                                        {Object.keys(food.symptoms).length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(food.symptoms).map(([s, c]) => (
                                                    <span key={s} className="bg-white/5 px-2 py-1 rounded border border-white/5 text-[8px] font-mono uppercase text-white/40">
                                                        {getSymptomLabel(s)} x{c}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Legend Modal */}
            {showLegend && (
                <div className="fixed inset-0 z-[100] bg-[#020617] p-8 overflow-y-auto animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-12">
                        <h2 className="text-3xl font-mono font-black uppercase text-white tracking-tighter">Engine.Protocol</h2>
                        <button onClick={() => setShowLegend(false)} className="p-3 text-white/40 bg-white/5 rounded-2xl"><LucideIcons.X size={28} /></button>
                    </div>
                    <div className="space-y-8 pb-32">
                        {[
                            { title: '⚡ ENERGY_FACTOR (x2)', positive: '≥2100 kcal / ≥200g CHO', negative: '<1900 kcal / <170g CHO' },
                            { title: '🌙 NIGHT_FACTOR (x2)', positive: 'Cena ≤700 kcal / ≤25g grasa', negative: 'Cena >900 kcal / >35g grasa' },
                            { title: '🧪 CNS_FACTOR (x1)', positive: 'Esfuerzo aeróbico / Suave', negative: 'Esfuerzo alta intensidad / Gym' },
                            { title: '📉 CONTEXT_FACTOR (x1)', positive: 'Forma fresca (TSB > 2)', negative: 'Fatiga (TSB < -5)' }
                        ].map(section => (
                            <section key={section.title} className="bg-slate-900 border border-white/10 p-8 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-500"><LucideIcons.Shield size={60} /></div>
                                <h3 className="text-[10px] font-mono font-black uppercase text-indigo-400 mb-6 tracking-[0.4em]">{section.title}</h3>
                                <div className="space-y-4 font-mono text-sm">
                                    <p className="flex items-center gap-4 text-emerald-400/80"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {section.positive}</p>
                                    <p className="flex items-center gap-4 text-rose-400/80"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {section.negative}</p>
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OraculoView;
