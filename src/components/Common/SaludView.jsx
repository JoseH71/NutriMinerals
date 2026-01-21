import React, { useState, useMemo, useEffect } from 'react';
import { Icons } from '../Icons';
import { calculateRatios, getRatioStatus } from '../../utils/helpers';
import { getHealthThresholds, getZoneStatus, getZoneColor, getZoneEmoji } from '../../utils/healthThresholds';
import {
    calculateDigestiveLoad as calcDinnerLoad,
    getHRVDelta,
    getRHRDelta,
    getAutomaticVerdict,
    getSymptomEmoji,
    getSymptomLabel
} from '../../utils/dinnerAnalyzer';
import { analyzeDinnerFoodTolerance, getTopDinnerCombinations, getDinnerSuggestions } from '../../utils/dinnerIntelligence';
import { ATHLETE_ID, INTERVALS_API_KEY, SHARED_USER_ID, APP_ID } from '../../config/firebase';

const SaludView = ({ dayLogs = [], allLogs = [], tssToday = 0, dinnerFeedback = [], onSaveFeedback, manualDayType: propManualDayType, onSaveManualDayType }) => {
    // State for interactive components
    const [timeToSleep, setTimeToSleep] = useState('plus2');
    const [heavyDinner, setHeavyDinner] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    // State for Intervals wellness data
    const [intervalsData, setIntervalsData] = useState([]);
    const [intervalsLoading, setIntervalsLoading] = useState(false);

    // State for dinner feedback
    const [selectedSymptoms, setSelectedSymptoms] = useState([]);
    const [feedbackSaved, setFeedbackSaved] = useState(false);

    // State for Dinner History Modal
    const [showDinnerHistory, setShowDinnerHistory] = useState(false);
    const [showBioTimeline, setShowBioTimeline] = useState(false);
    const [bioTrendRange, setBioTrendRange] = useState(7);
    const [historyDateFilter, setHistoryDateFilter] = useState('all'); // 'all', '7d', '30d', '90d'
    const [historySymptomFilter, setHistorySymptomFilter] = useState('all'); // 'all', 'gases', 'pulso_alto', etc.

    const [mineralDisplayMode, setMineralDisplayMode] = useState({});

    const [expandedNutrient, setExpandedNutrient] = useState(null);

    // Get yesterday's date
    const yesterday = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
    }, []);
    const yesterdayISO = useMemo(() => yesterday.toISOString().split('T')[0], [yesterday]);

    // Symptom tags available
    const symptomTags = [
        { id: 'gases', emoji: '💨', label: 'Gases' },
        { id: 'pulso_alto', emoji: '❤️', label: 'Pulso↑' },
        { id: 'hrv_bajo', emoji: '📉', label: 'HRV↓' },
        { id: 'fa', emoji: '⚡', label: 'FA' },
        { id: 'reflujo', emoji: '🔥', label: 'Reflujo' },
        { id: 'estres', emoji: '😰', label: 'Estrés' },
        { id: 'bien', emoji: '💤', label: 'Bien' }
    ];

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

            // Save to Firestore if available
            if (onSaveFeedback) {
                onSaveFeedback(yesterdayISO, newSymptoms);
            }

            // Also save to localStorage as backup
            try {
                const feedbackKey = `dinner_feedback_${yesterdayISO}`;
                const feedback = {
                    date: yesterdayISO,
                    symptoms: newSymptoms,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem(feedbackKey, JSON.stringify(feedback));
            } catch (e) {
                console.error('[SYMPTOM] Error saving to localStorage:', e);
            }

            return newSymptoms;
        });
    };

    // Load saved feedback from Firestore or localStorage
    useEffect(() => {
        // First check Firestore (dinnerFeedback prop)
        const firestoreFeedback = dinnerFeedback.find(f => f.dateISO === yesterdayISO || f.id === yesterdayISO);
        if (firestoreFeedback && firestoreFeedback.symptoms) {
            setSelectedSymptoms(firestoreFeedback.symptoms);
            return;
        }

        // Fallback to localStorage
        try {
            const feedbackKey = `dinner_feedback_${yesterdayISO}`;
            const saved = localStorage.getItem(feedbackKey);
            if (saved) {
                const feedback = JSON.parse(saved);
                setSelectedSymptoms(feedback.symptoms || []);
            }
        } catch (e) {
            console.error('Error loading feedback:', e);
        }
    }, [yesterdayISO, dinnerFeedback]);

    // Use prop manualDayType (synced from Firestore) with localStorage fallback
    const [localManualDayType, setLocalManualDayType] = useState(() => {
        try {
            const saved = localStorage.getItem('manualDayType');
            return saved !== null ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    // Sync prop to local state
    const manualDayType = propManualDayType !== undefined ? propManualDayType : localManualDayType;

    const handleToggleDayType = () => {
        const newValue = manualDayType === null ? !isTrainingDay : manualDayType === true ? false : manualDayType === false ? null : true;

        // Save to Firestore if available
        if (onSaveManualDayType) {
            onSaveManualDayType(newValue);
        }

        // Also save to localStorage as backup
        setLocalManualDayType(newValue);
        try {
            if (newValue === null) {
                localStorage.removeItem('manualDayType');
            } else {
                localStorage.setItem('manualDayType', JSON.stringify(newValue));
            }
        } catch (e) { console.error('Error saving manualDayType:', e); }
    };

    const toggleMineralDisplay = (mineralKey) => {
        setMineralDisplayMode(prev => ({
            ...prev,
            [mineralKey]: !prev[mineralKey]
        }));
    };

    const toggleExpanded = (key) => {
        setExpandedNutrient(prev => prev === key ? null : key);
    };

    // Defensive coding
    const cleanLogs = Array.isArray(dayLogs) ? dayLogs : [];
    const allCleanLogs = Array.isArray(allLogs) ? allLogs : [];
    console.log("SaludView render with:", cleanLogs.length, "logs, TSS:", tssToday);

    // Get thresholds based on training day (with manual override)
    const isTrainingDay = manualDayType !== null ? manualDayType : tssToday >= 40;
    const thresholds = useMemo(() => getHealthThresholds(isTrainingDay ? 100 : 0), [isTrainingDay]);

    // Calculate totals
    const sum = (key) => cleanLogs.reduce((a, b) => a + (Number(b[key]) || 0), 0);
    const na = sum('na');
    const k = sum('k');
    const ca = sum('ca');
    const mg = sum('mg');
    const calories = sum('calories');

    // Fetch Intervals wellness data (last 7 days)
    useEffect(() => {
        const fetchIntervals = async () => {
            setIntervalsLoading(true);
            try {
                const today = new Date().toISOString().split('T')[0];
                const fourteenDaysAgo = new Date();
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                const oldest = fourteenDaysAgo.toISOString().split('T')[0];

                const apiUrl = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=${oldest}&newest=${today}`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
                const res = await fetch(proxyUrl, {
                    headers: { 'Authorization': 'Basic ' + btoa('API_KEY:' + INTERVALS_API_KEY) }
                });
                if (!res.ok) throw new Error('Error: ' + res.status);
                const data = await res.json();
                const sorted = data.sort((a, b) => new Date(b.id) - new Date(a.id));
                setIntervalsData(sorted);
            } catch (e) {
                console.error('Intervals fetch error:', e);
            } finally {
                setIntervalsLoading(false);
            }
        };
        fetchIntervals();
    }, []);

    // Calculate ratios
    const ratios = calculateRatios(na, k, ca, mg) || { naK: 0, caMg: 0 };

    // Taurina calculation
    const taurina = cleanLogs.reduce((s, l) => {
        const entry = (l.extraMinerals || []).find(m => m.label?.toLowerCase() === 'taurina');
        return s + (entry ? Number(entry.value) || 0 : 0);
    }, 0);
    const taurinaG = taurina / 1000;

    // Taurina status
    const getTaurinaStatus = (g) => {
        if (g === 0) return { color: 'slate', emoji: '⚫', label: 'Sin registro' };
        if (g < 0.5) return { color: 'rose', emoji: '🔴', label: 'Bajo' };
        if (g <= 1.5) return { color: 'emerald', emoji: '✅', label: 'Base' };
        if (g <= 2.5) return { color: 'amber', emoji: '🟡', label: 'Funcional' };
        return { color: 'rose', emoji: '🔴', label: 'Exceso' };
    };
    const taurinaStatus = getTaurinaStatus(taurinaG);

    // Mineral Density
    const mineralDensity = calories > 0 ? ((mg + k / 10 + ca / 5) / calories * 10) : 0;
    const getMineralDensityStatus = (density) => {
        if (density >= 6) return { color: 'emerald', emoji: '🟢', label: 'Alta' };
        if (density >= 3) return { color: 'amber', emoji: '🟡', label: 'Media' };
        return { color: 'rose', emoji: '🔴', label: 'Baja' };
    };
    const mineralDensityStatus = getMineralDensityStatus(mineralDensity);

    // Calculate historical calories for timeline
    const historyCalories = useMemo(() => {
        const map = {};
        intervalsData.slice(0, 10).forEach(day => {
            const dayLogs = allCleanLogs.filter(l => (l.dateISO || l.dateStr) === day.id);
            map[day.id] = dayLogs.reduce((acc, l) => acc + (Number(l.calories) || 0), 0);
        });
        return map;
    }, [allCleanLogs, intervalsData]);

    // Digestive load with time factor
    const nightLogs = cleanLogs.filter(l => l.timeBlock === 'noche');
    const nightFat = nightLogs.reduce((a, b) => a + (Number(b.fat) || 0), 0);
    const nightFiber = nightLogs.reduce((a, b) => a + (Number(b.fiber) || 0), 0);

    const timeFactor = timeToSleep === 'plus2' ? 0.8 : timeToSleep === '1to2' ? 1.2 : 1.6;
    const fatPenalty = nightFat > 20 ? (nightFat - 20) * 1.2 : 0;
    const fiberPenalty = nightFiber * 0.8;
    const digestiveLoad = (fatPenalty + fiberPenalty) * timeFactor;

    const digestiveStatus = digestiveLoad < 120 ? { color: 'emerald', label: 'Óptimo' } :
        digestiveLoad < 180 ? { color: 'amber', label: 'Moderado' } :
            { color: 'rose', label: 'Alto' };

    // Ratio statuses
    // Ratio statuses
    const naKStatus = getRatioStatus(ratios.naK, thresholds.ratios.na_k);
    const caMgStatus = getRatioStatus(ratios.caMg, thresholds.ratios.ca_mg);

    return (
        <div className="space-y-6 animate-fade-in px-2 pb-20">
            <div className="px-1 flex justify-between items-center mb-2">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Estado Metabólico</h2>
                <div className="flex gap-1">
                    <button
                        onClick={handleToggleDayType}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 transition-all active:scale-95 ${thresholds.dayType === 'entreno'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                            }`}
                    >
                        {thresholds.dayType === 'entreno' ? '🔵 Entreno' : '🟢 Descanso'}
                        {manualDayType === null ? '' : ' ✓'}
                    </button>
                </div>
            </div>

            {/* MACROS - Circle Progress Rings */}
            <div className="bg-card p-4 rounded-3xl border border-theme mb-4">
                <p className="text-xs font-black text-secondary uppercase tracking-widest mb-3">Macros</p>
                <div className="flex justify-between">
                    {[
                        { key: 'calories', label: 'Kcal', value: calories, target: thresholds.calories?.optHigh || 2200, color: '#f97316' },
                        { key: 'protein', label: 'Prot', value: sum('protein'), target: thresholds.protein?.optHigh || 125, color: '#3b82f6' },
                        { key: 'carbs', label: 'Carbs', value: sum('carbs'), target: thresholds.carbs?.optHigh || 280, color: '#eab308' },
                        { key: 'fat', label: 'Grasa', value: sum('fat'), target: thresholds.fat?.optHigh || 75, color: '#ef4444' },
                        { key: 'fiber', label: 'Fibra', value: sum('fiber'), target: thresholds.fiber?.optHigh || 30, color: '#22c55e' }
                    ].map(n => {
                        const percentage = Math.round((n.value / n.target) * 100);
                        const showPercent = mineralDisplayMode[n.key] !== false;
                        const size = 60;
                        const strokeWidth = percentage > 100 ? 7 : 4;
                        const radius = (size - strokeWidth) / 2;
                        const circumference = 2 * Math.PI * radius;
                        const fillPercentage = Math.min(percentage, 100);
                        const strokeDashoffset = circumference - (fillPercentage / 100) * circumference;

                        return (
                            <div key={n.key} className="flex flex-col items-center">
                                <button
                                    onClick={() => toggleMineralDisplay(n.key)}
                                    className="relative transition-all active:scale-95"
                                    style={{ width: size, height: size }}
                                >
                                    <svg width={size} height={size} className="transform -rotate-90">
                                        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3} className="text-gray-200 dark:text-gray-700" />
                                        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={n.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-500" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xs font-black text-primary">
                                            {showPercent ? `${percentage}%` : Math.round(n.value)}
                                        </span>
                                    </div>
                                </button>
                                <p className="text-[9px] font-bold text-secondary mt-1 uppercase">{n.label}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MICROS - Circle Progress Rings */}
            <div className="bg-card p-4 rounded-3xl border border-theme mb-6">
                <p className="text-xs font-black text-secondary uppercase tracking-widest mb-3">Minerales</p>
                <div className="flex justify-between">
                    {[
                        { key: 'sodium', label: 'Na', value: na, target: thresholds.sodium?.optHigh || 2200, color: '#3b82f6' },
                        { key: 'potassium', label: 'K', value: k, target: thresholds.potassium?.optHigh || 4500, color: '#10b981' },
                        { key: 'calcium', label: 'Ca', value: ca, target: thresholds.calcium?.optHigh || 1200, color: '#f43f5e' },
                        { key: 'magnesium', label: 'Mg', value: mg, target: thresholds.magnesium?.optHigh || 700, color: '#8b5cf6' }
                    ].map(n => {
                        const percentage = Math.round((n.value / n.target) * 100);
                        const showPercent = mineralDisplayMode[n.key] !== false;
                        const size = 72;
                        const strokeWidth = percentage > 100 ? 8 : 5;
                        const radius = (size - strokeWidth) / 2;
                        const circumference = 2 * Math.PI * radius;
                        const fillPercentage = Math.min(percentage, 100);
                        const strokeDashoffset = circumference - (fillPercentage / 100) * circumference;

                        return (
                            <div key={n.key} className="flex flex-col items-center">
                                <button
                                    onClick={() => toggleMineralDisplay(n.key)}
                                    className="relative transition-all active:scale-95"
                                    style={{ width: size, height: size }}
                                >
                                    <svg width={size} height={size} className="transform -rotate-90">
                                        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3} className="text-gray-200 dark:text-gray-700" />
                                        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={n.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-500" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-sm font-black text-primary">
                                            {showPercent ? `${percentage}%` : Math.round(n.value)}
                                        </span>
                                    </div>
                                </button>
                                <p className="text-[10px] font-bold text-secondary mt-1 uppercase">{n.label}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Electrolyte Ratios - Na:K and Ca:Mg */}
            <div className="grid grid-cols-2 gap-4">
                {/* Na:K Ratio */}
                <div className={`bg-card p-5 rounded-3xl border border-theme space-y-3 border-l-4 border-l-${naKStatus.color}-500`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Ratio Na:K</p>
                            <p className="text-3xl font-black">{ratios.naK ? ratios.naK.toFixed(2) : '-'}</p>
                        </div>
                        <span className="text-2xl">⚖️</span>
                    </div>
                    <p className={`text-xs font-bold text-${naKStatus.color}-600 dark:text-${naKStatus.color}-400`}>{naKStatus.message}</p>
                    <div className="text-[9px] text-secondary space-y-1 pt-2 border-t border-theme">
                        <p>🟢 &lt; 1.0 Excelente</p>
                        <p>🟡 1.0-1.5 Atención</p>
                        <p>🔴 &gt; 1.5 Menor margen</p>
                    </div>
                </div>

                {/* Ca:Mg Ratio */}
                <div className={`bg-card p-5 rounded-3xl border border-theme space-y-3 border-l-4 border-l-${caMgStatus.color}-500`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Ratio Ca:Mg</p>
                            <p className="text-3xl font-black">{ratios.caMg ? ratios.caMg.toFixed(2) : '-'}</p>
                        </div>
                        <span className="text-2xl">⚡</span>
                    </div>
                    <p className={`text-xs font-bold text-${caMgStatus.color}-600 dark:text-${caMgStatus.color}-400`}>{caMgStatus.message}</p>
                    <div className="text-[9px] text-secondary space-y-1 pt-2 border-theme">
                        <p>🟢 &lt; 2.5 Equilibrio</p>
                        <p>🟡 2.5-3.5 Excitabilidad</p>
                        <p>🔴 &gt; 3.5 Alto</p>
                    </div>
                </div>
            </div>

            {/* Mineral Density & Taurine */}
            <div className="grid grid-cols-2 gap-4">
                {/* Mineral Density */}
                <div className={`bg-card p-5 rounded-3xl border border-theme flex flex-col justify-between border-l-4 border-l-${mineralDensityStatus.color}-500`}>
                    <div>
                        <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">🧪 Densidad Global</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black">{mineralDensity.toFixed(1)}</p>
                            <span className="text-xl">{mineralDensityStatus.emoji}</span>
                        </div>
                    </div>
                    <div className="text-[8px] text-secondary flex flex-wrap gap-2 pt-2 border-t border-theme mt-2">
                        <span>🟢≥6</span>
                        <span>🟡3-6</span>
                        <span>🔴&lt;3</span>
                    </div>
                    <details className="mt-2">
                        <summary className="text-[9px] text-secondary cursor-pointer hover:text-primary">ℹ️ ¿Cómo se calcula?</summary>
                        <div className="mt-2 p-2 bg-card-alt/50 rounded-lg text-[9px] text-secondary space-y-1">
                            <p className="font-bold">Fórmula:</p>
                            <p className="font-mono">(Mg + K/10 + Ca/5) / Kcal × 10</p>
                            <p className="mt-2">Tus valores hoy:</p>
                            <p>• Mg: {mg}mg</p>
                            <p>• K: {k}mg (÷10 = {Math.round(k / 10)})</p>
                            <p>• Ca: {ca}mg (÷5 = {Math.round(ca / 5)})</p>
                            <p>• Kcal: {Math.round(calories)}</p>
                            <p className="mt-1 font-bold">= ({mg} + {Math.round(k / 10)} + {Math.round(ca / 5)}) / {Math.round(calories)} × 10 = {mineralDensity.toFixed(1)}</p>
                            <p className="mt-2 italic">Mide cuántos minerales esenciales aportas por cada caloría. Más alto = comida más nutritiva.</p>
                        </div>
                    </details>
                </div>

                {/* Taurine */}
                <div className={`bg-card p-5 rounded-3xl border border-theme flex flex-col justify-between border-l-4 border-l-${taurinaStatus.color}-500`}>
                    <div>
                        <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">⚡ Taurina</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black">
                                {taurinaG.toFixed(1)}<span className="text-sm">g</span>
                            </p>
                            <span className="text-xl">{taurinaStatus.emoji}</span>
                        </div>
                    </div>
                    <div className="text-[8px] text-secondary pt-2 border-t border-theme mt-2">
                        {taurinaStatus.label === 'Sin registro' ? 'Sin datos hoy' : `Nivel ${taurinaStatus.label}`}
                    </div>
                </div>
            </div>


            {/* TODAY'S DINNER (In Progress) */}
            {(() => {
                const today = new Date().toISOString().split('T')[0];
                const todayDinnerLogs = allCleanLogs.filter(l => {
                    const logDate = l.dateISO || l.dateStr;
                    return logDate === today && l.timeBlock === 'noche';
                });

                // Only show if there are dinner items OR if it's past 19:00
                const currentHour = new Date().getHours();
                if (todayDinnerLogs.length === 0 && currentHour < 19) return null;

                const dinnerTotals = todayDinnerLogs.reduce((acc, l) => ({
                    fat: acc.fat + (Number(l.fat) || 0),
                    fiber: acc.fiber + (Number(l.fiber) || 0),
                    protein: acc.protein + (Number(l.protein) || 0),
                    calories: acc.calories + (Number(l.calories) || 0)
                }), { fat: 0, fiber: 0, protein: 0, calories: 0 });

                const loadValue = calcDinnerLoad(todayDinnerLogs);

                return (
                    <div className="bg-card p-5 rounded-3xl border border-theme mb-4 border-l-4 border-l-indigo-500">
                        <div className="flex justify-between items-center mb-3">
                            <div>
                                <p className="text-[10px] font-black text-secondary uppercase tracking-widest">🍽️ Cena de Hoy</p>
                                <p className="text-xs text-secondary">En progreso...</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black">{loadValue}<span className="text-xs text-secondary">/10</span></p>
                                <p className="text-[9px] text-secondary">Carga actual</p>
                            </div>
                        </div>

                        {todayDinnerLogs.length > 0 ? (
                            <>
                                {(() => {
                                    // Dinner thresholds based on day type
                                    const dinnerLimits = isTrainingDay ? {
                                        fat: { optimal: 20, warning: 30 },
                                        fiber: { optimal: 8, warning: 12 },
                                        calories: { optimal: 600, warning: 800 }
                                    } : {
                                        fat: { optimal: 15, warning: 25 },
                                        fiber: { optimal: 6, warning: 10 },
                                        calories: { optimal: 500, warning: 700 }
                                    };

                                    const getTrafficLight = (value, limits) => {
                                        if (value <= limits.optimal) return '🟢';
                                        if (value <= limits.warning) return '🟡';
                                        return '🔴';
                                    };

                                    const getBgColor = (value, limits) => {
                                        if (value <= limits.optimal) return 'bg-emerald-500/10 border-emerald-500/30';
                                        if (value <= limits.warning) return 'bg-amber-500/10 border-amber-500/30';
                                        return 'bg-rose-500/10 border-rose-500/30';
                                    };

                                    const getTextColor = (value, limits) => {
                                        if (value <= limits.optimal) return 'text-emerald-400';
                                        if (value <= limits.warning) return 'text-amber-400';
                                        return 'text-rose-400';
                                    };

                                    return (
                                        <div className="grid grid-cols-4 gap-2 mb-2">
                                            <div className={`p-2 rounded-lg text-center border ${getBgColor(dinnerTotals.fat, dinnerLimits.fat)}`}>
                                                <p className="text-[9px] text-secondary">Grasa</p>
                                                <div className="flex items-center justify-center gap-1">
                                                    <p className={`font-bold text-sm ${getTextColor(dinnerTotals.fat, dinnerLimits.fat)}`}>
                                                        {Math.round(dinnerTotals.fat)}g
                                                    </p>
                                                    <span className="text-xs">{getTrafficLight(dinnerTotals.fat, dinnerLimits.fat)}</span>
                                                </div>
                                            </div>
                                            <div className={`p-2 rounded-lg text-center border ${getBgColor(dinnerTotals.fiber, dinnerLimits.fiber)}`}>
                                                <p className="text-[9px] text-secondary">Fibra</p>
                                                <div className="flex items-center justify-center gap-1">
                                                    <p className={`font-bold text-sm ${getTextColor(dinnerTotals.fiber, dinnerLimits.fiber)}`}>
                                                        {Math.round(dinnerTotals.fiber)}g
                                                    </p>
                                                    <span className="text-xs">{getTrafficLight(dinnerTotals.fiber, dinnerLimits.fiber)}</span>
                                                </div>
                                            </div>
                                            <div className="bg-card-alt/50 p-2 rounded-lg text-center border border-theme">
                                                <p className="text-[9px] text-secondary">Prot</p>
                                                <p className="font-bold text-sm">{Math.round(dinnerTotals.protein)}g</p>
                                            </div>
                                            <div className={`p-2 rounded-lg text-center border ${getBgColor(dinnerTotals.calories, dinnerLimits.calories)}`}>
                                                <p className="text-[9px] text-secondary">Kcal</p>
                                                <div className="flex items-center justify-center gap-1">
                                                    <p className={`font-bold text-sm ${getTextColor(dinnerTotals.calories, dinnerLimits.calories)}`}>
                                                        {Math.round(dinnerTotals.calories)}
                                                    </p>
                                                    <span className="text-xs">{getTrafficLight(dinnerTotals.calories, dinnerLimits.calories)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="flex flex-wrap gap-1">
                                    {todayDinnerLogs.map((log, i) => (
                                        <span key={i} className="text-[10px] bg-card-alt px-2 py-1 rounded-lg font-medium border border-theme">
                                            {log.name}
                                        </span>
                                    ))}
                                </div>
                                <details className="mt-3">
                                    <summary className="text-[9px] text-secondary cursor-pointer hover:text-primary">ℹ️ ¿Cómo se calcula la carga?</summary>
                                    <div className="mt-2 p-2 bg-card-alt/50 rounded-lg text-[9px] text-secondary space-y-1">
                                        <p className="font-bold">Fórmula de Carga Digestiva:</p>
                                        <p className="font-mono text-[8px]">(Grasa × 1.5 + Fibra × 1.2 + Prot × 0.8) / 100 × 10</p>
                                        <p className="mt-2 font-bold">Multiplicadores:</p>
                                        <p>• <span className="text-amber-500">Grasa ×1.5</span> — Más lenta de digerir</p>
                                        <p>• <span className="text-emerald-500">Fibra ×1.2</span> — Puede causar gases nocturno</p>
                                        <p>• <span className="text-blue-500">Proteína ×0.8</span> — Digestión moderada</p>
                                        <p className="mt-2 font-bold">Tus valores:</p>
                                        <p>({Math.round(dinnerTotals.fat)}×1.5) + ({Math.round(dinnerTotals.fiber)}×1.2) + ({Math.round(dinnerTotals.protein)}×0.8)</p>
                                        <p>= {(dinnerTotals.fat * 1.5 + dinnerTotals.fiber * 1.2 + dinnerTotals.protein * 0.8).toFixed(0)} → Carga: {loadValue}/10</p>
                                        <p className="mt-2 italic">Objetivo: mantener la carga ≤5 para un descanso óptimo.</p>
                                    </div>
                                </details>
                            </>
                        ) : (
                            <p className="text-center text-sm text-secondary italic">Aún no has registrado nada para la cena 🌙</p>
                        )}
                    </div>
                );
            })()}

            {/* YESTERDAY'S DINNER ANALYSIS */}
            {(() => {
                // Get yesterday's date
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayISO = yesterday.toISOString().split('T')[0];

                // Get yesterday's dinner logs
                const yesterdayLogs = allCleanLogs.filter(l => {
                    const logDate = l.dateISO || l.dateStr;
                    return logDate === yesterdayISO && l.timeBlock === 'noche';
                });

                if (yesterdayLogs.length === 0) return null; // No dinner yesterday

                // Calculate dinner nutrition
                const dinnerTotals = yesterdayLogs.reduce((acc, l) => ({
                    fat: acc.fat + (Number(l.fat) || 0),
                    fiber: acc.fiber + (Number(l.fiber) || 0),
                    protein: acc.protein + (Number(l.protein) || 0),
                    calories: acc.calories + (Number(l.calories) || 0)
                }), { fat: 0, fiber: 0, protein: 0, calories: 0 });

                const digestiveLoadValue = calcDinnerLoad(yesterdayLogs);

                // Get yesterday's wellness data
                const yesterdayWellness = intervalsData.find(d => d.id === yesterdayISO);
                const todayWellness = intervalsData.find(d => d.id === new Date().toISOString().split('T')[0]);

                // Calculate deltas
                const hrvDelta = todayWellness?.hrv ? getHRVDelta(todayWellness.hrv, intervalsData) : null;
                const rhrDelta = todayWellness?.restingHR ? getRHRDelta(todayWellness.restingHR, intervalsData) : null;

                // NEW: Calculate yesterday's total calories and deficit
                const yesterdayTotalLogs = allCleanLogs.filter(l => (l.dateISO || l.dateStr) === yesterdayISO);
                const yesterdayTotalCalories = yesterdayTotalLogs.reduce((acc, l) => acc + (Number(l.calories) || 0), 0);

                // Yesterday's target ref (simplified or fetched)
                const isTrainingYesterday = yesterdayWellness?.training_load > 60 || yesterdayTotalLogs.some(l => l.name?.toLowerCase().includes('entreno') || l.tss > 0);
                const yesterdayTarget = isTrainingYesterday ? 2450 : 2050;
                const isCalorieDeficit = yesterdayTotalCalories < (yesterdayTarget - 300);
                const hrvIsDown = hrvDelta !== null && hrvDelta < -5;

                // Get verdict
                const hasFATag = selectedSymptoms.includes('fa');
                const verdict = getAutomaticVerdict(hrvDelta, digestiveLoadValue, hasFATag);

                const verdictConfig = {
                    good: { color: 'emerald', emoji: '🟢', label: 'Digestión Óptima', bg: 'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700' },
                    warning: { color: 'amber', emoji: '🟡', label: 'Atención', bg: 'from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/20', border: 'border-amber-300 dark:border-amber-700' },
                    critical: { color: 'rose', emoji: '🔴', label: 'Crítico', bg: 'from-rose-50 to-rose-100 dark:from-rose-900/30 dark:to-rose-900/20', border: 'border-rose-300 dark:border-rose-700' }
                };
                const config = verdictConfig[verdict];

                // Symptom tags available
                const symptomTags = [
                    { id: 'gases', emoji: '💨', label: 'Gases' },
                    { id: 'pulso_alto', emoji: '❤️', label: 'Pulso↑' },
                    { id: 'hrv_bajo', emoji: '📉', label: 'HRV↓' },
                    { id: 'fa', emoji: '⚡', label: 'FA' },
                    { id: 'reflujo', emoji: '🔥', label: 'Reflujo' },
                    { id: 'estres', emoji: '😰', label: 'Estrés' },
                    { id: 'bien', emoji: '💤', label: 'Bien' }
                ];





                return (
                    <div className={`bg-card p-5 rounded-3xl border border-theme mb-4 border-l-4 border-l-${config.color}-500`}>
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <p className="text-base font-black text-secondary uppercase tracking-widest">📊 Análisis de Cena (Ayer)</p>
                                <p className={`text-xl font-bold text-${config.color}-600 dark:text-${config.color}-400`}>
                                    {config.emoji} {config.label}
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-2">
                                <p className="text-lg font-bold text-white">{yesterday.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowBioTimeline(true)}
                                        className="px-3 py-1.5 rounded-full text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-1 shadow-lg border border-indigo-400/30"
                                    >
                                        📉 Tendencias
                                    </button>
                                    <button
                                        onClick={() => setShowDinnerHistory(true)}
                                        className="px-3 py-1.5 rounded-full text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-1 shadow-lg border border-emerald-400/30"
                                    >
                                        🍽️ Historial
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Nutrition vs Biometric Comparison */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {/* Nutrition Side */}
                            <div className="bg-card-alt/50 p-4 rounded-xl">
                                <p className="text-base font-black text-secondary uppercase tracking-wider mb-2">🍽️ Nutrición</p>
                                <div className="space-y-2 text-base">
                                    {(() => {
                                        // Dinner thresholds based on day type
                                        const dinnerLimits = isTrainingDay ? {
                                            fat: { optimal: 20, warning: 30, label: 'Grasa' },
                                            fiber: { optimal: 8, warning: 12, label: 'Fibra' },
                                            calories: { optimal: 600, warning: 800, label: 'Calorías' }
                                        } : {
                                            fat: { optimal: 15, warning: 25, label: 'Grasa' },
                                            fiber: { optimal: 6, warning: 10, label: 'Fibra' },
                                            calories: { optimal: 500, warning: 700, label: 'Calorías' }
                                        };

                                        const getTrafficLight = (value, limits) => {
                                            if (value <= limits.optimal) return '🟢';
                                            if (value <= limits.warning) return '🟡';
                                            return '🔴';
                                        };

                                        const getTextColor = (value, limits) => {
                                            if (value <= limits.optimal) return 'text-emerald-400';
                                            if (value <= limits.warning) return 'text-amber-400';
                                            return 'text-rose-400';
                                        };

                                        return (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-secondary">Carga:</span>
                                                    <span className="font-bold text-white">{digestiveLoadValue}/10</span>
                                                </div>

                                                {/* Grasa - Clickable */}
                                                <details className="group">
                                                    <summary className="flex justify-between items-center cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                                        <span className="text-secondary">Grasa:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`font-bold ${getTextColor(dinnerTotals.fat, dinnerLimits.fat)}`}>
                                                                {Math.round(dinnerTotals.fat)}g
                                                            </span>
                                                            <span className="text-lg">{getTrafficLight(dinnerTotals.fat, dinnerLimits.fat)}</span>
                                                        </div>
                                                    </summary>
                                                    <div className="mt-1 pl-2 text-[9px] text-secondary border-l-2 border-theme">
                                                        <p>🟢 Óptimo: ≤{dinnerLimits.fat.optimal}g</p>
                                                        <p>🟡 Atención: ≤{dinnerLimits.fat.warning}g</p>
                                                        <p>🔴 Exceso: &gt;{dinnerLimits.fat.warning}g</p>
                                                    </div>
                                                </details>

                                                {/* Fibra - Clickable */}
                                                <details className="group">
                                                    <summary className="flex justify-between items-center cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                                        <span className="text-secondary">Fibra:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`font-bold ${getTextColor(dinnerTotals.fiber, dinnerLimits.fiber)}`}>
                                                                {Math.round(dinnerTotals.fiber)}g
                                                            </span>
                                                            <span className="text-lg">{getTrafficLight(dinnerTotals.fiber, dinnerLimits.fiber)}</span>
                                                        </div>
                                                    </summary>
                                                    <div className="mt-1 pl-2 text-[9px] text-secondary border-l-2 border-theme">
                                                        <p>🟢 Óptimo: ≤{dinnerLimits.fiber.optimal}g</p>
                                                        <p>🟡 Atención: ≤{dinnerLimits.fiber.warning}g</p>
                                                        <p>🔴 Exceso: &gt;{dinnerLimits.fiber.warning}g</p>
                                                    </div>
                                                </details>

                                                {/* Calorías - Clickable */}
                                                <details className="group">
                                                    <summary className="flex justify-between items-center cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                                        <span className="text-secondary">Calorías:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`font-bold ${getTextColor(dinnerTotals.calories, dinnerLimits.calories)}`}>
                                                                {Math.round(dinnerTotals.calories)}
                                                            </span>
                                                            <span className="text-lg">{getTrafficLight(dinnerTotals.calories, dinnerLimits.calories)}</span>
                                                        </div>
                                                    </summary>
                                                    <div className="mt-1 pl-2 text-[9px] text-secondary border-l-2 border-theme">
                                                        <p>🟢 Óptimo: ≤{dinnerLimits.calories.optimal}</p>
                                                        <p>🟡 Atención: ≤{dinnerLimits.calories.warning}</p>
                                                        <p>🔴 Exceso: &gt;{dinnerLimits.calories.warning}</p>
                                                    </div>
                                                </details>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Biometric Side */}
                            <div className="bg-card-alt/50 p-4 rounded-xl">
                                <p className="text-base font-black text-secondary uppercase tracking-wider mb-2">📊 Biométrica</p>
                                <div className="space-y-2 text-base">
                                    <div className="flex justify-between">
                                        <span className="text-secondary">HRV:</span>
                                        <span className={`font-bold ${hrvDelta !== null && hrvDelta < -10 ? 'text-rose-600' : 'text-white'}`}>
                                            {todayWellness?.hrv || '-'} {hrvDelta !== null ? `(${hrvDelta > 0 ? '+' : ''}${hrvDelta}%)` : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-secondary">RHR:</span>
                                        <span className={`font-bold ${rhrDelta !== null && rhrDelta > 3 ? 'text-rose-600' : 'text-white'}`}>
                                            {todayWellness?.restingHR || '-'} {rhrDelta !== null ? `(${rhrDelta > 0 ? '+' : ''}${rhrDelta})` : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-secondary">Sueño:</span>
                                        <span className="font-bold text-white">{todayWellness?.sleepScore || '-'}/100</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RECOVERY INSIGHT (New: Calorie/HRV Correlation) */}
                        {hrvIsDown && isCalorieDeficit && (
                            <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-start gap-3 animate-pulse-subtle">
                                <span className="text-2xl mt-1">💡</span>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Insight de Recuperación</p>
                                    <p className="text-sm text-secondary leading-tight mt-1">
                                        Tu HRV ha bajado un <span className="text-rose-500 font-bold">{Math.abs(hrvDelta)}%</span> hoy.
                                        Ayer consumiste <span className="text-rose-500 font-bold">{Math.round(yesterdayTotalCalories)} kcal</span>,
                                        quedándote <span className="font-bold text-amber-500">{(yesterdayTarget - yesterdayTotalCalories).toFixed(0)} kcal por debajo</span> de tu objetivo.
                                        Esta falta de energía suele ser la causa principal de una mala recuperación del sistema vagal.
                                    </p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <p className="text-[10px] text-indigo-400 font-bold italic">🎯 Objetivo hoy: {thresholds.calories.optHigh} kcal</p>
                                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-lg border border-indigo-500/30">Déficit detectado</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Detailed Breakdown (Expandable) */}
                        <details className="mb-3">
                            <summary className="cursor-pointer text-[9px] font-black text-secondary uppercase tracking-wider mb-2 hover:text-primary transition-colors">📊 Desglose Detallado</summary>
                            <div className="mt-3 space-y-3">
                                {/* Time to Sleep Selector */}
                                <div className="flex justify-between items-center">
                                    <p className="text-[9px] text-secondary uppercase font-bold">Tiempo hasta dormir</p>
                                    <div className="flex bg-card-alt rounded-lg p-1 border border-theme">
                                        <button
                                            onClick={() => setTimeToSleep('plus2')}
                                            className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${timeToSleep === 'plus2' ? 'bg-emerald-600 text-white shadow-lg' : 'text-secondary hover:text-primary'}`}
                                        >&gt;2h</button>
                                        <button
                                            onClick={() => setTimeToSleep('1to2')}
                                            className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${timeToSleep === '1to2' ? 'bg-amber-600 text-white shadow-lg' : 'text-secondary hover:text-primary'}`}
                                        >1-2h</button>
                                        <button
                                            onClick={() => setTimeToSleep('less1')}
                                            className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${timeToSleep === 'less1' ? 'bg-rose-600 text-white shadow-lg' : 'text-secondary hover:text-primary'}`}
                                        >&lt;1h</button>
                                    </div>
                                </div>

                                {/* Fat and Fiber Penalties */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className={`p-2 rounded-lg border border-theme ${Number(dinnerTotals.fat) > 20 ? 'bg-amber-500/10' : 'bg-card-alt/50'}`}>
                                        <p className="text-secondary text-[9px] uppercase font-bold mb-1">Grasa Penalización</p>
                                        <p className="font-bold text-sm">
                                            {Number(dinnerTotals.fat) > 20 ? Math.round((Number(dinnerTotals.fat) - 20) * 1.2) : 0} <span className="text-[9px] font-normal text-secondary">pts</span>
                                        </p>
                                        <p className="text-[8px] text-secondary">
                                            {Number(dinnerTotals.fat) > 20 ? `Exceso ${Math.round(Number(dinnerTotals.fat) - 20)}g × 1.2` : 'Sin exceso'}
                                        </p>
                                    </div>
                                    <div className="bg-card-alt/50 p-2 rounded-lg border border-theme">
                                        <p className="text-secondary text-[9px] uppercase font-bold mb-1">Fibra Penalización</p>
                                        <p className="font-bold text-sm">
                                            {Math.round(Number(dinnerTotals.fiber) * 0.8)} <span className="text-[9px] font-normal text-secondary">pts</span>
                                        </p>
                                        <p className="text-[8px] text-secondary">{Math.round(dinnerTotals.fiber)}g × 0.8</p>
                                    </div>
                                </div>
                            </div>
                        </details>

                        {/* Dinner Foods */}
                        <div className="mb-3">
                            <p className="text-base font-black text-secondary uppercase tracking-wider mb-2">Platos:</p>
                            <div className="flex flex-wrap gap-1">
                                {yesterdayLogs.map((log, i) => (
                                    <span key={i} className="text-base bg-card px-2 py-1 rounded-lg font-medium border border-theme">
                                        {log.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Symptom Tags (Punto 2) */}
                        <div className="mb-3">
                            <p className="text-base font-black text-secondary uppercase tracking-wider mb-2">¿Cómo te sentó?</p>
                            <div className="flex flex-wrap gap-2">
                                {symptomTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleSymptom(tag.id)}
                                        className={`px-4 py-2 rounded-xl text-base font-bold transition-all ${selectedSymptoms.includes(tag.id)
                                            ? tag.id === 'fa'
                                                ? 'bg-rose-600 text-white shadow-lg scale-105'
                                                : tag.id === 'bien'
                                                    ? 'bg-emerald-600 text-white shadow-lg scale-105'
                                                    : 'bg-amber-600 text-white shadow-lg scale-105'
                                            : 'bg-card-alt text-secondary hover:bg-card border border-theme'
                                            }`}
                                    >
                                        {tag.emoji} {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Feedback Status */}
                        {selectedSymptoms.length > 0 && (
                            <div className="text-center">
                                <p className="text-sm text-secondary">
                                    ✓ Sensaciones registradas: {selectedSymptoms.map(s => getSymptomEmoji(s)).join(' ')}
                                </p>
                            </div>
                        )}

                        {/* Detailed Breakdown (Expandable) moved or kept */}
                    </div>
                );
            })()}

            {/* DINNER HISTORY MODAL */}
            {showDinnerHistory && (() => {
                // Build complete dinner history from logs and feedback
                // ONLY use dateISO (YYYY-MM-DD format) to avoid parsing issues
                const todayISO = new Date().toISOString().split('T')[0];

                const allDinnerDates = [...new Set(
                    allCleanLogs
                        .filter(l => l.timeBlock === 'noche' && l.dateISO) // Only use logs with valid dateISO
                        .map(l => l.dateISO)
                        .filter(d => d && d.match(/^\d{4}-\d{2}-\d{2}$/) && d <= todayISO) // Valid format and not future
                )].sort((a, b) => b.localeCompare(a)); // String sort works for ISO dates

                // Apply date filter
                const now = new Date();
                const filteredDates = allDinnerDates.filter(dateISO => {
                    if (historyDateFilter === 'all') return true;
                    const date = new Date(dateISO + 'T12:00:00'); // Add time to avoid timezone issues
                    const daysDiff = Math.ceil((now - date) / (1000 * 60 * 60 * 24));
                    if (historyDateFilter === '7d') return daysDiff <= 7;
                    if (historyDateFilter === '30d') return daysDiff <= 30;
                    if (historyDateFilter === '90d') return daysDiff <= 90;
                    return true;
                });

                // Build dinner entries with symptoms
                const dinnerEntries = filteredDates.map(dateISO => {
                    const logs = allCleanLogs.filter(l => l.dateISO === dateISO && l.timeBlock === 'noche');
                    const feedback = dinnerFeedback.find(f => f.dateISO === dateISO || f.id === dateISO);
                    const symptoms = feedback?.symptoms || [];

                    const totals = logs.reduce((acc, l) => ({
                        fat: acc.fat + (Number(l.fat) || 0),
                        fiber: acc.fiber + (Number(l.fiber) || 0),
                        protein: acc.protein + (Number(l.protein) || 0),
                        calories: acc.calories + (Number(l.calories) || 0)
                    }), { fat: 0, fiber: 0, protein: 0, calories: 0 });

                    const load = calcDinnerLoad(logs);

                    return {
                        date: dateISO,
                        foods: logs.map(l => l.name).filter(Boolean),
                        symptoms,
                        load,
                        totals
                    };
                });

                // Apply symptom filter
                const finalEntries = historySymptomFilter === 'all'
                    ? dinnerEntries
                    : dinnerEntries.filter(e => e.symptoms.includes(historySymptomFilter));

                const symptomOptions = [
                    { id: 'all', label: 'Todos', emoji: '📋' },
                    { id: 'gases', label: 'Gases', emoji: '💨' },
                    { id: 'pulso_alto', label: 'Pulso↑', emoji: '❤️' },
                    { id: 'hrv_bajo', label: 'HRV↓', emoji: '📉' },
                    { id: 'fa', label: 'FA', emoji: '⚡' },
                    { id: 'reflujo', label: 'Reflujo', emoji: '🔥' },
                    { id: 'bien', label: 'Bien', emoji: '💤' }
                ];

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-card w-full max-w-lg max-h-[85vh] rounded-3xl border border-theme shadow-2xl flex flex-col overflow-hidden">
                            {/* Modal Header */}
                            <div className="p-4 border-b border-theme flex justify-between items-center bg-gradient-to-r from-emerald-600 to-emerald-700">
                                <h3 className="text-xl font-black text-white flex items-center gap-2">
                                    🍽️ Historial de Cenas
                                </h3>
                                <button
                                    onClick={() => setShowDinnerHistory(false)}
                                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="p-3 border-b border-theme space-y-2 bg-card-alt/50">
                                {/* Date Range Filter */}
                                <div className="flex gap-1 flex-wrap">
                                    {[
                                        { id: 'all', label: 'Todo' },
                                        { id: '7d', label: '7 días' },
                                        { id: '30d', label: '30 días' },
                                        { id: '90d', label: '90 días' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setHistoryDateFilter(opt.id)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${historyDateFilter === opt.id
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-card text-secondary hover:bg-card-alt border border-theme'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {/* Symptom Filter */}
                                <div className="flex gap-1 flex-wrap">
                                    {symptomOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setHistorySymptomFilter(opt.id)}
                                            className={`px-2 py-1 rounded-full text-xs font-bold transition-all ${historySymptomFilter === opt.id
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-card text-secondary hover:bg-card-alt border border-theme'
                                                }`}
                                        >
                                            {opt.emoji} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dinner List */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                {finalEntries.length === 0 ? (
                                    <div className="text-center py-10 text-secondary">
                                        <p className="text-4xl mb-2">🍽️</p>
                                        <p className="font-bold">No hay cenas registradas</p>
                                        <p className="text-sm">con los filtros seleccionados</p>
                                    </div>
                                ) : (
                                    finalEntries.map((entry) => (
                                        <div
                                            key={entry.date}
                                            className={`p-4 rounded-2xl border border-theme bg-card-alt/30 space-y-2 ${entry.symptoms.includes('fa') ? 'border-l-4 border-l-rose-500' :
                                                entry.symptoms.includes('bien') ? 'border-l-4 border-l-emerald-500' :
                                                    entry.symptoms.length > 0 ? 'border-l-4 border-l-amber-500' : ''
                                                }`}
                                        >
                                            {/* Date & Load */}
                                            <div className="flex justify-between items-center">
                                                <p className="font-bold text-white">
                                                    {new Date(entry.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                </p>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${entry.load <= 4 ? 'bg-emerald-500/20 text-emerald-400' :
                                                    entry.load <= 6 ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-rose-500/20 text-rose-400'
                                                    }`}>
                                                    Carga: {entry.load}/10
                                                </span>
                                            </div>
                                            {/* Foods */}
                                            <div className="flex flex-wrap gap-1">
                                                {entry.foods.map((food, i) => (
                                                    <span key={i} className="text-sm bg-card px-2 py-0.5 rounded-lg text-secondary border border-theme">
                                                        {food}
                                                    </span>
                                                ))}
                                            </div>
                                            {/* Symptoms */}
                                            {entry.symptoms.length > 0 && (
                                                <div className="flex gap-1 items-center">
                                                    <span className="text-xs text-secondary">Sensaciones:</span>
                                                    {entry.symptoms.map((s, i) => (
                                                        <span key={i} className="text-lg" title={getSymptomLabel(s)}>
                                                            {getSymptomEmoji(s)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-3 border-t border-theme text-center text-xs text-secondary">
                                {finalEntries.length} cena{finalEntries.length !== 1 ? 's' : ''} encontrada{finalEntries.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                );
            })()}


            {/* BIO-TOLERANCIA TRENDS MODAL */}
            {showBioTimeline && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
                    <div className="bg-card w-full max-w-xl rounded-3xl border border-theme shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
                        <div className="p-6 border-b border-theme flex flex-col gap-4 bg-gradient-to-r from-indigo-600 to-indigo-800">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                        📉 Tendencias
                                    </h3>
                                    <p className="text-xs text-indigo-100 font-bold uppercase tracking-widest opacity-80">Recuperación Bio-Feedback</p>
                                </div>
                                <button
                                    onClick={() => setShowBioTimeline(false)}
                                    className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all active:scale-95 shadow-inner"
                                >
                                    <Icons.X size={24} />
                                </button>
                            </div>

                            {/* Range Selector */}
                            <div className="flex bg-white/10 rounded-xl p-1 self-start border border-white/10">
                                {[7, 14, 30].map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setBioTrendRange(range)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${bioTrendRange === range ? 'bg-white text-indigo-600 shadow-lg scale-105' : 'text-white/70 hover:text-white'}`}
                                    >
                                        {range}D
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar">
                            {/* HRV Chart Section */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-black text-secondary uppercase tracking-[0.2em]">Variabilidad (HRV)</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="w-3 h-3 bg-indigo-500 rounded-sm"></span>
                                        <span className="text-xs font-bold text-primary">ms</span>
                                    </div>
                                </div>
                                <div className="flex items-end justify-between h-48 gap-2 px-2 overflow-x-auto custom-scrollbar pb-2 min-w-max">
                                    {intervalsData.slice(0, bioTrendRange).reverse().map((day) => {
                                        const hrvValues = intervalsData.filter(d => d.hrv).map(d => d.hrv);
                                        const maxHRV = hrvValues.length > 0 ? Math.max(...hrvValues) : 100;
                                        const height = day.hrv ? (day.hrv / maxHRV) * 100 : 0;
                                        const isToday = day.id === new Date().toISOString().split('T')[0];

                                        return (
                                            <div key={day.id} className="flex flex-col items-center gap-4 group" style={{ width: bioTrendRange > 14 ? '40px' : '50px' }}>
                                                <div
                                                    className={`w-full rounded-t-2xl transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(0,0,0,0.1)] ${isToday ? 'bg-indigo-500 shadow-indigo-500/30' : 'bg-slate-400 dark:bg-slate-600'}`}
                                                    style={{ height: `${Math.max(15, height)}%` }}
                                                />
                                                <div className="text-center">
                                                    <p className={`text-[11px] font-black ${isToday ? 'text-indigo-400' : 'text-primary'}`}>
                                                        {day.hrv || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Calories Row Section */}
                            <div className="space-y-6 pt-6 border-t border-theme/50">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-black text-secondary uppercase tracking-[0.2em]">Energía (Calorías)</h4>
                                </div>
                                <div className="flex justify-between gap-2 px-2 overflow-x-auto custom-scrollbar pb-2 min-w-max">
                                    {intervalsData.slice(0, bioTrendRange).reverse().map((day) => {
                                        const cals = historyCalories[day.id] || 0;
                                        const isLow = cals > 0 && cals < 1900;
                                        return (
                                            <div key={day.id} className="flex flex-col items-center gap-3" style={{ width: bioTrendRange > 14 ? '40px' : '50px' }}>
                                                <div className={`text-[12px] font-black ${isLow ? 'text-rose-500 anim-pulse' : 'text-primary opacity-80'}`}>
                                                    {cals > 0 ? `${(cals / 1000).toFixed(1)}k` : '-'}
                                                </div>
                                                <div className={`mx-auto transition-all ${isLow ? 'w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-rose-500/20' : 'w-1.5 h-1.5 bg-theme/50 rounded-full'}`}></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Symptoms & Dates Section */}
                            <div className="space-y-6 pt-6 border-t border-theme/50 pb-2">
                                <h4 className="text-sm font-black text-secondary uppercase tracking-[0.2em]">Bio-Sensaciones</h4>
                                <div className="flex justify-between gap-2 px-2 overflow-x-auto custom-scrollbar pb-2 min-w-max">
                                    {intervalsData.slice(0, bioTrendRange).reverse().map((day) => {
                                        // Try to get symptoms from Firestore first, then fallback to localStorage
                                        const firestoreFeedback = dinnerFeedback.find(f => f.dateISO === day.id || f.id === day.id);
                                        let symptoms = firestoreFeedback?.symptoms || [];

                                        if (symptoms.length === 0) {
                                            try {
                                                const feedbackKey = `dinner_feedback_${day.id}`;
                                                const saved = localStorage.getItem(feedbackKey);
                                                if (saved) {
                                                    symptoms = JSON.parse(saved).symptoms || [];
                                                }
                                            } catch (e) {
                                                console.error('Error loading fallback symptoms:', e);
                                            }
                                        }

                                        return (
                                            <div key={day.id} className="flex flex-col items-center gap-4" style={{ width: bioTrendRange > 14 ? '40px' : '50px' }}>
                                                <div className="h-16 flex flex-wrap justify-center content-center gap-1">
                                                    {symptoms.length > 0 ? (
                                                        symptoms.slice(0, 6).map((s, idx) => (
                                                            <span key={idx} className="text-xl leading-none">{getSymptomEmoji(s)}</span>
                                                        ))
                                                    ) : (
                                                        <span className="text-secondary opacity-20 text-xs">·</span>
                                                    )}
                                                </div>
                                                <div className="text-center w-full">
                                                    <p className="text-[9px] font-black text-secondary uppercase opacity-50">
                                                        {new Date(day.id).toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 1)}
                                                    </p>
                                                    <p className={`text-[11px] font-black ${bioTrendRange > 14 ? 'text-secondary' : 'text-primary'}`}>
                                                        {new Date(day.id).getDate()}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-card-alt border-t border-theme text-center">
                            <div className="inline-flex items-start gap-4 text-left bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                                <span className="text-2xl">💡</span>
                                <p className="text-xs font-bold text-secondary leading-relaxed">
                                    <span className="text-indigo-400 uppercase font-black">Análisis:</span> Si ves una caída en las barras de <span className="text-indigo-400">HRV</span> coincidiendo con un punto <span className="text-rose-500">rojo</span> de calorías, indica que tu sistema nervioso está estresado por falta de energía.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BIO-TOLERANCIA NOCTURNA (Food Tolerance Analysis) */}
            {(() => {
                const foodAnalysis = analyzeDinnerFoodTolerance(allCleanLogs, dinnerFeedback, intervalsData);

                if (!foodAnalysis.hasData) {
                    return (
                        <div className="bg-card p-5 rounded-3xl border border-theme mb-4 border-l-4 border-l-emerald-500">
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-2">🧬 Bio-Tolerancia Nocturna</p>
                            <p className="text-sm text-secondary italic">Aún no hay suficientes datos. Continúa registrando cenas y cómo te sientas para ver patrones.</p>
                            <p className="text-[9px] text-secondary mt-2">Mínimo: 2 cenas con el mismo alimento</p>
                        </div>
                    );
                }

                return (
                    <div className="bg-card p-5 rounded-3xl border border-theme mb-4 border-l-4 border-l-emerald-500">
                        <p className="text-base font-black text-secondary uppercase tracking-widest mb-3">🧬 Bio-Tolerancia Nocturna</p>
                        <p className="text-base text-secondary mb-4">Basado en tus últimas {foodAnalysis.totalDinners} cenas</p>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Well Tolerated */}
                            <div>
                                <p className="text-base font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">🟢 Mejor tolerados</p>
                                {foodAnalysis.wellTolerated.length > 0 ? (
                                    <div className="space-y-1">
                                        {foodAnalysis.wellTolerated.map((food, i) => (
                                            <div key={i} className="flex items-center justify-between bg-emerald-500/10 px-2 py-2 rounded-lg">
                                                <span className="text-base font-medium truncate max-w-[120px]">{food.name}</span>
                                                <span className="text-base text-emerald-600 dark:text-emerald-400 font-bold">{Math.round(food.stableRatio * 100)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-secondary italic">Sin datos aún</p>
                                )}
                            </div>

                            {/* To Watch */}
                            <div>
                                <p className="text-base font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">🟡 A vigilar en cenas</p>
                                {foodAnalysis.toWatch.length > 0 ? (
                                    <div className="space-y-1">
                                        {foodAnalysis.toWatch.map((food, i) => (
                                            <div key={i} className="flex items-center justify-between bg-amber-500/10 px-2 py-2 rounded-lg">
                                                <span className="text-base font-medium truncate max-w-[120px]">{food.name}</span>
                                                <span className="text-base text-amber-600 dark:text-amber-400 font-bold">{Math.round(food.difficultRatio * 100)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-secondary italic">¡Genial! Sin problemas</p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* SUGERENCIAS PARA ESTA NOCHE */}
            {(() => {
                const suggestions = getDinnerSuggestions(allCleanLogs, dinnerFeedback, intervalsData, isTrainingDay);
                if (!suggestions.hasData && suggestions.tips.length === 0) return null;

                return (
                    <div className="bg-card p-5 rounded-3xl border border-theme mb-4 border-l-4 border-l-blue-500">
                        <p className="text-base font-black text-secondary uppercase tracking-widest mb-3">🌙 Sugerencias para esta noche</p>
                        <div className="space-y-2">
                            {suggestions.tips.map((tip, i) => (
                                <div key={i} className="flex gap-2 items-center bg-card-alt/50 p-2.5 rounded-xl border border-theme">
                                    <span className="text-lg">💡</span>
                                    <p className="text-sm font-medium">{tip}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Omega-3 Tracking Card (moved to end) */}
            {(() => {
                const fattyFishTerms = ['salmon', 'salmón', 'sardina', 'caballa', 'jurel', 'boqueron', 'boquerón', 'anchoa', 'chicharro'];
                const omega3Logs = allCleanLogs
                    .filter(l => fattyFishTerms.some(term => l.name?.toLowerCase().includes(term)))
                    .map(l => ({
                        name: l.name,
                        timestamp: l.timestamp?.seconds ? l.timestamp.seconds * 1000 : Date.now(),
                        date: l.dateISO || new Date(l.timestamp?.seconds ? l.timestamp.seconds * 1000 : Date.now()).toISOString().slice(0, 10)
                    }));

                const lastOmega3 = omega3Logs.length > 0
                    ? omega3Logs.sort((a, b) => b.timestamp - a.timestamp)[0]
                    : null;

                const now = new Date();
                const daysSince = lastOmega3
                    ? Math.ceil((now - new Date(lastOmega3.timestamp)) / (1000 * 60 * 60 * 24))
                    : 999;

                const omega3Status = daysSince === 0 ? { color: 'emerald', emoji: '✅', label: 'Consumido hoy' }
                    : daysSince <= 7 ? { color: 'emerald', emoji: '🟢', label: 'Óptimo' }
                        : daysSince <= 10 ? { color: 'amber', emoji: '🟡', label: 'Atención', daysLeft: 10 - daysSince }
                            : { color: 'rose', emoji: '🔴', label: 'Pendiente' };

                // Generate 30-day dots
                const dots = [];
                for (let i = 0; i < 30; i++) {
                    const checkDate = new Date(now);
                    checkDate.setDate(checkDate.getDate() - i);
                    const checkDateStr = checkDate.toISOString().slice(0, 10);
                    const hasOmega3 = omega3Logs.some(d => d.date === checkDateStr);
                    dots.push(hasOmega3);
                }

                return (
                    <div className={`bg-card p-5 rounded-3xl border border-theme mb-4 border-l-4 border-l-${omega3Status.color}-500`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🐟</span>
                                <div>
                                    <p className="text-xs font-black text-secondary uppercase tracking-wider">Omega-3</p>
                                    <p className={`text-sm font-bold text-${omega3Status.color}-600 dark:text-${omega3Status.color}-400`}>{omega3Status.emoji} {omega3Status.label}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-secondary">Hace:</p>
                                <p className={`text-xl font-black text-${omega3Status.color}-600 dark:text-${omega3Status.color}-400`}>{daysSince === 0 ? 'Hoy' : daysSince === 999 ? '+30d' : `${daysSince}d`}</p>
                            </div>
                        </div>
                        {lastOmega3 && (
                            <div className="text-center mb-2">
                                <p className="text-xs font-semibold text-secondary">🐟 {lastOmega3.name}</p>
                                <p className="text-[10px] text-secondary">{new Date(lastOmega3.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                            </div>
                        )}
                        {omega3Status.color === 'amber' && omega3Status.daysLeft !== undefined && (
                            <p className={`text-[11px] text-amber-600 dark:text-amber-400 mb-2 text-center font-medium`}>
                                ⏰ Consumir pronto (quedan {omega3Status.daysLeft} día{omega3Status.daysLeft !== 1 ? 's' : ''})
                            </p>
                        )}
                        {omega3Status.color === 'rose' && (
                            <p className={`text-[11px] text-rose-600 dark:text-rose-400 mb-2 text-center font-medium`}>
                                ⚠️ Llevas {daysSince} días sin omega-3
                            </p>
                        )}
                        <div className="flex gap-[3px] justify-center mb-2">
                            {dots.map((hasOmega, i) => (<div key={i} className={`w-2 h-2 rounded-full ${hasOmega ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`} title={`${i} días atrás`} />))}
                        </div>
                        <p className="text-[8px] text-center text-secondary">Últimos 30 días</p>
                    </div>
                );
            })()}


        </div>
    );
};

export default SaludView;
