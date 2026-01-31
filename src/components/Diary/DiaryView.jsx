import React, { useState, useMemo, useEffect } from 'react';
import * as Icons from 'lucide-react';
import FoodDetail from '../Common/FoodDetail';
import { getHealthThresholds, getZoneStatus, getZoneEmoji, getDayStatus, getDayStatusType, CRITICAL_NUTRIENTS, CONTEXT_NUTRIENTS, getZoneEmojiForDay } from '../../utils/healthThresholds';

const DiaryView = ({ logs, onDelete, tssToday = 0, onSaveFood, myFoods, manualDayType: propManualDayType, onSaveManualDayType, dinnerFeedback }) => {
    const [expanded, setExpanded] = useState(null);
    const [showPlatos, setShowPlatos] = useState(false);
    const [expandedNutrient, setExpandedNutrient] = useState(null);
    const [displayMode, setDisplayMode] = useState({}); // true = %, false = value
    const [showWeeklyBalance, setShowWeeklyBalance] = useState(false);
    const [suggestionOverlay, setSuggestionOverlay] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [expandedSuggestion, setExpandedSuggestion] = useState(null);
    const [modalSelectedDay, setModalSelectedDay] = useState(null);

    // Helper to get Monday of current week
    const getMonday = (d) => {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    // Helper to get normalized date (yyyy-mm-dd)
    const normalizeDate = (date) => {
        if (!date || typeof date !== 'string') return '';

        // Handle DD/MM/YYYY
        if (date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }

        // Handle YYYY-MM-DD or DD-MM-YYYY
        if (date.includes('-')) {
            const parts = date.split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) { // Already YYYY-MM-DD
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else { // European DD-MM-YYYY
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
        }
        return date;
    };

    const mondayISO = useMemo(() => {
        const mon = getMonday(new Date());
        return mon.toLocaleDateString('sv'); // YYYY-MM-DD
    }, []);

    const weekLogs = useMemo(() => {
        return (logs || []).filter(l => {
            const date = normalizeDate(l.dateISO || l.dateStr);
            return date >= mondayISO;
        });
    }, [logs, mondayISO]);

    // Calculate weekly stats
    const weeklyProgress = useMemo(() => {
        if (!logs) return {
            balanceUntilYesterday: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 },
            consumedTotal: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 },
            fullTargets: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 },
            daysPassed: 1,
            dailyStatuses: []
        };

        const now = new Date();
        const daysPassed = Math.max(1, now.getDay() || 7);

        const targetsTillYesterday = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 };
        const consumedTillYesterday = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 };
        const dailyStatuses = [];

        const typesOfDays = ['bici', 'bici', 'bici', 'bici', 'bici', 'bici', 'descanso'];

        for (let i = 1; i < 8; i++) {
            const type = typesOfDays[i - 1];
            const th = getHealthThresholds(type === 'bici' ? 100 : 0, type);
            const pastDate = new Date(getMonday(new Date()));
            pastDate.setDate(pastDate.getDate() + (i - 1));
            const pastISO = pastDate.toISOString().split('T')[0];
            const dayLogs = (logs || []).filter(l => normalizeDate(l.dateISO || l.dateStr) === pastISO);
            const dayConsumed = dayLogs.reduce((a, b) => a + (Number(b.calories) || 0), 0);

            // Calculate full day totals for detail view
            const dayTotals = {
                calories: dayConsumed,
                protein: dayLogs.reduce((a, b) => a + (Number(b.protein) || 0), 0),
                carbs: dayLogs.reduce((a, b) => a + (Number(b.carbs) || 0), 0),
                fat: dayLogs.reduce((a, b) => a + (Number(b.fat) || 0), 0),
                fiber: dayLogs.reduce((a, b) => a + (Number(b.fiber) || 0), 0),
                na: dayLogs.reduce((a, b) => a + (Number(b.na) || 0), 0),
                k: dayLogs.reduce((a, b) => a + (Number(b.k) || 0), 0),
                ca: dayLogs.reduce((a, b) => a + (Number(b.ca) || 0), 0),
                mg: dayLogs.reduce((a, b) => a + (Number(b.mg) || 0), 0),
            };

            // Calendar status logic
            if (i < daysPassed) {
                const ratio = dayConsumed / (th.calories.optHigh || 2200);
                let status = '🟢';
                if (ratio < 0.9) status = '🟡';
                else if (ratio > 1.1) status = '🔵';
                dailyStatuses.push({ id: i, day: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i - 1], status, totals: dayTotals, type: th.dayLabel, thresholds: th });
            } else if (i === daysPassed) {
                dailyStatuses.push({ id: i, day: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i - 1], status: '⭐', totals: dayTotals, type: th.dayLabel, thresholds: th });
            } else {
                dailyStatuses.push({ id: i, day: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][i - 1], status: '—', totals: null, type: th.dayLabel, thresholds: th });
            }

            if (i < daysPassed && th && th.calories) {
                targetsTillYesterday.calories += th.calories.optHigh || 0;
                targetsTillYesterday.protein += th.protein?.optHigh || 0;
                targetsTillYesterday.carbs += th.carbs?.optHigh || 0;
                targetsTillYesterday.fat += th.fat?.optHigh || 0;
                targetsTillYesterday.fiber += th.fiber?.optHigh || 0;
                targetsTillYesterday.na += th.sodium?.optHigh || 0;
                targetsTillYesterday.k += th.potassium?.optHigh || 0;
                targetsTillYesterday.ca += th.calcium?.optHigh || 0;
                targetsTillYesterday.mg += th.magnesium?.optHigh || 0;

                consumedTillYesterday.calories += dayConsumed;
                consumedTillYesterday.protein += dayLogs.reduce((a, b) => a + (Number(b.protein) || 0), 0);
                consumedTillYesterday.carbs += dayLogs.reduce((a, b) => a + (Number(b.carbs) || 0), 0);
                consumedTillYesterday.fat += dayLogs.reduce((a, b) => a + (Number(b.fat) || 0), 0);
                consumedTillYesterday.fiber += dayLogs.reduce((a, b) => a + (Number(b.fiber) || 0), 0);
                consumedTillYesterday.na += dayLogs.reduce((a, b) => a + (Number(b.na) || 0), 0);
                consumedTillYesterday.k += dayLogs.reduce((a, b) => a + (Number(b.k) || 0), 0);
                consumedTillYesterday.ca += dayLogs.reduce((a, b) => a + (Number(b.ca) || 0), 0);
                consumedTillYesterday.mg += dayLogs.reduce((a, b) => a + (Number(b.mg) || 0), 0);
            }
        }

        const balanceUntilYesterday = {
            calories: consumedTillYesterday.calories - targetsTillYesterday.calories,
            protein: consumedTillYesterday.protein - targetsTillYesterday.protein,
            carbs: consumedTillYesterday.carbs - targetsTillYesterday.carbs,
            fat: consumedTillYesterday.fat - targetsTillYesterday.fat,
            fiber: consumedTillYesterday.fiber - targetsTillYesterday.fiber,
            na: consumedTillYesterday.na - targetsTillYesterday.na,
            k: consumedTillYesterday.k - targetsTillYesterday.k,
            ca: consumedTillYesterday.ca - targetsTillYesterday.ca,
            mg: consumedTillYesterday.mg - targetsTillYesterday.mg,
        };

        const consumedTotal = {
            calories: (weekLogs || []).reduce((a, b) => a + (Number(b.calories) || 0), 0),
            protein: (weekLogs || []).reduce((a, b) => a + (Number(b.protein) || 0), 0),
            carbs: (weekLogs || []).reduce((a, b) => a + (Number(b.carbs) || 0), 0),
            fat: (weekLogs || []).reduce((a, b) => a + (Number(b.fat) || 0), 0),
            fiber: (weekLogs || []).reduce((a, b) => a + (Number(b.fiber) || 0), 0),
            na: (weekLogs || []).reduce((a, b) => a + (Number(b.na) || 0), 0),
            k: (weekLogs || []).reduce((a, b) => a + (Number(b.k) || 0), 0),
            ca: (weekLogs || []).reduce((a, b) => a + (Number(b.ca) || 0), 0),
            mg: (weekLogs || []).reduce((a, b) => a + (Number(b.mg) || 0), 0),
        };

        const fullTargets = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 };
        typesOfDays.forEach(type => {
            const th = getHealthThresholds(type === 'bici' ? 100 : 0, type);
            if (th && th.calories) {
                fullTargets.calories += th.calories.optHigh || 0;
                fullTargets.protein += th.protein?.optHigh || 0;
                fullTargets.carbs += th.carbs?.optHigh || 0;
                fullTargets.fat += th.fat?.optHigh || 0;
                fullTargets.fiber += th.fiber?.optHigh || 0;
                fullTargets.na += th.sodium?.optHigh || 0;
                fullTargets.k += th.potassium?.optHigh || 0;
                fullTargets.ca += th.calcium?.optHigh || 0;
                fullTargets.mg += th.magnesium?.optHigh || 0;
            }
        });

        return { balanceUntilYesterday, consumedTotal, fullTargets, daysPassed, dailyStatuses };
    }, [weekLogs, logs]);

    // Use prop manualDayType (synced from Firestore) with localStorage fallback
    const [localManualDayType, setLocalManualDayType] = useState(() => {
        try {
            const saved = localStorage.getItem('manualDayType');
            return saved !== null ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    // Sync prop to local state and Firestore
    const manualDayType = propManualDayType !== undefined ? propManualDayType : localManualDayType;

    const handleSetDayType = (type) => {
        if (onSaveManualDayType) {
            onSaveManualDayType(type);
        }
        setLocalManualDayType(type);
        try {
            if (type === null) {
                localStorage.removeItem('manualDayType');
            } else {
                localStorage.setItem('manualDayType', JSON.stringify(type));
            }
        } catch (e) { console.error('Error saving manualDayType:', e); }
    };

    const todayISO = new Date().toISOString().slice(0, 10);
    const today = logs.filter(l => (l.dateISO || l.dateStr) === todayISO || l.dateStr === new Date().toLocaleDateString());

    // Dynamic thresholds based on training (with manual override)
    const thresholds = useMemo(() => getHealthThresholds(tssToday, manualDayType), [tssToday, manualDayType]);

    // Calculate totals
    const sum = (key) => today.reduce((a, b) => a + (Number(b[key]) || 0), 0);
    const na = sum('na');
    const k = sum('k');
    const ca = sum('ca');
    const mg = sum('mg');

    // Get foods contributing to a nutrient, sorted by contribution
    const getFoodsForNutrient = (nutrientKey) => {
        return today
            .filter(l => Number(l[nutrientKey]) > 0)
            .map(l => ({ name: l.name, value: Number(l[nutrientKey]) || 0 }))
            .sort((a, b) => b.value - a.value);
    };

    // Render expandable nutrient breakdown
    const NutrientDropdown = ({ nutrientKey, unit = 'g', color = 'indigo' }) => {
        const foods = getFoodsForNutrient(nutrientKey);
        const isExpanded = expandedNutrient === nutrientKey;
        if (foods.length === 0) return null;

        return (
            <div className="mt-1">
                <button
                    onClick={() => setExpandedNutrient(isExpanded ? null : nutrientKey)}
                    className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-all ${isExpanded ? `text-${color}-600` : 'text-secondary/60 hover:text-secondary'}`}
                >
                    {isExpanded ? <Icons.ChevronUp size={12} /> : <Icons.ChevronDown size={12} />}
                    Ver alimentos ({foods.length})
                </button>
                {isExpanded && (
                    <div className="mt-2 space-y-1 bg-card-alt/50 rounded-xl p-2 animate-fade-in">
                        {foods.map((f, i) => (
                            <div key={i} className="flex justify-between items-center text-[10px] py-1 border-b border-theme/20 last:border-0">
                                <span className="truncate max-w-[60%] text-primary font-medium">{f.name}</span>
                                <span className="font-mono font-black text-sm text-white">
                                    {unit === 'mg' ? Math.round(f.value) : f.value.toFixed(1)}{unit}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Suggestion Engine Logic
    const handleGenerateSuggestions = (type) => {
        // 1. Calculate current gaps
        const gaps = {
            calories: Math.max(0, (thresholds.calories?.optHigh || 2200) - sum('calories')),
            protein: Math.max(0, (thresholds.protein?.optHigh || 125) - sum('protein')),
            carbs: Math.max(0, (thresholds.carbs?.optHigh || 280) - sum('carbs')),
            na: Math.max(0, (thresholds.sodium?.optHigh || 2200) - sum('na')),
            k: Math.max(0, (thresholds.potassium?.optHigh || 4500) - sum('k')),
            ca: Math.max(0, (thresholds.calcium?.optHigh || 1200) - sum('ca')),
            mg: Math.max(0, (thresholds.magnesium?.optHigh || 700) - sum('mg')),
            fatGap: (thresholds.fat?.optHigh || 70) - sum('fat'),
        };

        // 2. Prepare Pool of Candidates (Catalog + Unique history)
        const historyFoods = logs.reduce((acc, log) => {
            if (!acc.find(f => f.name === log.name)) {
                acc.push({ ...log, isHistory: true });
            }
            return acc;
        }, []);

        const pool = [...myFoods, ...historyFoods];

        // 3. Filter by type and tolerance (if Cena)
        let candidates = pool.filter(f => {
            const name = f.name?.toLowerCase() || '';
            if (type === 'merienda') {
                const isHeavy = /hamburguesa|lomo|entrecot|filete|solomillo|pasta|arroz|guiso/i.test(name);
                return (f.timeBlock === 'merienda' || /yogur|fruta|frutos secos|avena|pan|queso|batido|leche|proteina/i.test(name)) && !isHeavy;
            } else {
                return f.timeBlock === 'noche' || /cena|verdura|pescado|pollo|arroz|tortilla/i.test(name);
            }
        });

        if (type === 'cena' && (dinnerFeedback || []).length > 0) {
            // Strong filter for cena: must have > 60% success rate if it has history
            candidates = candidates.filter(f => {
                const foodLogs = logs.filter(l => l.name === f.name && l.timeBlock === 'noche');
                if (foodLogs.length < 1) return true; // Keep if no history yet

                const datesWithFood = foodLogs.map(l => l.dateISO || l.dateStr);
                const feedbackForFood = dinnerFeedback.filter(df => datesWithFood.includes(df.dateISO || df.id));
                const stableCount = feedbackForFood.filter(df => df.symptoms?.includes('bien')).length;

                return feedbackForFood.length === 0 || (stableCount / feedbackForFood.length) >= 0.6;
            });
        }

        // 4. Score candidates based on gaps
        const scored = candidates.map(f => {
            let score = 0;
            // Heavy weights for macros
            if (gaps.protein > 5) score += (f.protein || 0) * 15.0;
            if (gaps.carbs > 10) score += (f.carbs || 0) * 1.2;
            if (gaps.calories > 100) score += (f.calories || 0) * 0.5;

            // Critical minerals weights (Increased for Intelligence)
            if (gaps.na > 100) score += (f.na || 0) * 0.2;
            if (gaps.k > 200) score += (f.k || 0) * 3.0;
            if (gaps.ca > 100) score += (f.ca || 0) * 10.0;
            if (gaps.mg > 50) score += (f.mg || 0) * 5.0;

            // Fat Control: Heavy penalty if we are at the limit
            if (gaps.fatGap < 10) {
                const penaltyFactor = gaps.fatGap < 0 ? 50.0 : 20.0;
                score -= (f.fat || 0) * penaltyFactor;
            }

            // Bonus for catalog items (more likely to be in the fridge)
            if (!f.isHistory) score *= 1.2;

            return { name: f.name, score };
        }).sort((a, b) => b.score - a.score);

        // 5. Pick top 4 unique items
        const selectedResults = [];
        const seenNames = new Set();
        for (const item of scored) {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                const original = candidates.find(c => c.name === item.name);
                selectedResults.push(original);
            }
            if (selectedResults.length === 4) break;
        }

        setSuggestions(selectedResults);
        setSuggestionOverlay(type);
        setExpandedSuggestion(null);
    };

    return (
        <div className="space-y-6 animate-fade-in px-2 pb-20">
            <div className="px-1 flex flex-col gap-3 mb-2">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-black tracking-tighter uppercase">Diario de Hoy</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowWeeklyBalance(true)}
                            className="bg-indigo-600/10 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-indigo-600/20 active:scale-95 transition-all"
                        >
                            <Icons.Calendar size={14} /> Balance Semanal
                        </button>
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
                            {thresholds.dayLabel}
                        </span>
                    </div>
                </div>

                {/* Day Type Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-theme shadow-sm">
                    {[
                        { id: 'gym', label: 'Gym', emoji: '🏋️' },
                        { id: 'bici', label: 'Bici', emoji: '🚴' },
                        { id: 'descanso', label: 'Rest', emoji: '🛑' },
                        { id: null, label: 'Auto', emoji: '🤖' }
                    ].map(type => (
                        <button
                            key={type.id || 'auto'}
                            onClick={() => handleSetDayType(type.id)}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 ${manualDayType === type.id
                                ? type.id === 'gym' ? 'bg-blue-600 text-white shadow-lg' :
                                    type.id === 'bici' ? 'bg-indigo-600 text-white shadow-lg' :
                                        type.id === 'descanso' ? 'bg-emerald-600 text-white shadow-lg' :
                                            'bg-slate-600 text-white shadow-lg'
                                : 'text-secondary hover:bg-white/50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <span className="text-sm">{type.emoji}</span>
                            <span className="hidden xs:inline">{type.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Weekly Balance Modal - Premium Redesign */}
            {showWeeklyBalance && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
                    <div className="bg-slate-900 w-full max-w-xl rounded-[3rem] border border-white/10 shadow-[0_0_50px_rgba(79,70,229,0.3)] flex flex-col max-h-[90vh] overflow-hidden text-white">

                        {/* Header Premium */}
                        <div className="p-8 border-b border-white/5 bg-gradient-to-br from-indigo-950 to-slate-900 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full" />
                            <div className="relative z-10">
                                <h3 className="text-xl font-black uppercase tracking-[0.3em] bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Balance Semanal</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                                    <p className="text-[10px] font-black text-teal-400/80 tracking-widest uppercase italic">The Week Rules</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowWeeklyBalance(false)}
                                className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 border border-white/10 transition-all active:scale-90"
                            >
                                <Icons.X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                            {/* GLOBAL STATUS - GLASS CARD */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-indigo-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                                <div className="relative bg-slate-800/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Estado del Sistema</p>
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-teal-500 blur-xl opacity-40 animate-pulse" />
                                            <span className="relative text-4xl">🟢</span>
                                        </div>
                                        <span className="text-3xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-white via-teal-100 to-slate-400 bg-clip-text text-transparent">Semana Estable</span>
                                    </div>
                                </div>
                            </div>

                            {/* SUGGESTED RANGE - NEON CARD */}
                            <div className="bg-indigo-600/10 p-8 rounded-[2.5rem] border border-indigo-500/30 text-center relative overflow-hidden shadow-inner">
                                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-3xl rounded-full" />
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-3">Energía Propuesta Hoy</p>
                                {(() => {
                                    const bal = Math.round(weeklyProgress.balanceUntilYesterday?.calories || 0);
                                    const base = thresholds.calories?.optHigh || 2200;
                                    const target = base - bal;
                                    return (
                                        <>
                                            <h4 className="text-5xl font-black text-white tracking-tighter drop-shadow-2xl">
                                                {target - 100}<span className="text-indigo-500/50 mx-2">—</span>{target + 100}
                                                <span className="text-sm font-bold ml-2 text-indigo-400/60 tracking-normal">KCAL</span>
                                            </h4>
                                            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                                                <Icons.Zap size={10} className="text-indigo-400" />
                                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Optimización Vagal</p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* CRITICAL NUTRIENTS - MINIMALIST TILES */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Magnesio', key: 'mg', color: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30' },
                                    { label: 'Potasio', key: 'k', color: 'from-teal-500/20 to-teal-600/5', border: 'border-teal-500/30' },
                                    { label: 'Sodio', key: 'na', color: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30' }
                                ].map(n => {
                                    const bal = weeklyProgress.balanceUntilYesterday[n.key] || 0;
                                    const target = weeklyProgress.fullTargets[n.key] || 1;
                                    const ratio = Math.abs(bal / target);
                                    let statusEmoji = '🟢';
                                    let statusLabel = 'EN RANGO';
                                    let dotColor = 'bg-teal-400';

                                    if (ratio > 0.2) {
                                        statusEmoji = '🔴';
                                        statusLabel = bal > 0 ? 'EXCESO' : 'FALTA';
                                        dotColor = 'bg-rose-500';
                                    } else if (ratio > 0.05) {
                                        statusEmoji = '🟡';
                                        statusLabel = bal > 0 ? 'SOBRA' : 'FALTA';
                                        dotColor = 'bg-amber-400';
                                    }

                                    return (
                                        <div key={n.key} className={`bg-gradient-to-b ${n.color} p-5 rounded-[2rem] border ${n.border} text-center group hover:scale-[1.02] transition-transform shadow-lg`}>
                                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-3">{n.label}</p>
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-2xl drop-shadow-md">{statusEmoji}</span>
                                                <p className="text-[10px] text-white uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                                    {statusLabel}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* CALENDAR - MODERN DOTS */}
                            <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                                <div className="flex justify-between items-center mb-6">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Trayectoria Semanal</p>
                                    <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[8px] font-black text-slate-400">
                                        W52_2026
                                    </div>
                                </div>
                                <div className="flex justify-between items-end gap-2 px-2">
                                    {weeklyProgress.dailyStatuses.map((d, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setModalSelectedDay(modalSelectedDay?.id === d.id ? null : d)}
                                            className="flex-1 flex flex-col items-center gap-4 group outline-none cursor-pointer"
                                        >
                                            <div className="text-[10px] font-black text-slate-500 transition-colors group-hover:text-white uppercase tracking-tighter">{d.day}</div>
                                            <div className={`w-10 h-10 rounded-2xl border transition-all duration-300 flex items-center justify-center text-sm
                                                ${modalSelectedDay?.id === d.id ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.8)] scale-110' :
                                                    d.status === '⭐' ? 'bg-indigo-600/30 border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.2)]' :
                                                        d.status === '—' ? 'bg-white/5 border-white/5 opacity-20' :
                                                            'bg-white/5 border-white/10 group-hover:bg-white/10 group-hover:border-white/20'}`}>
                                                {d.status === '⭐' && modalSelectedDay?.id !== d.id ? <Icons.Clock size={16} className="text-indigo-400 animate-spin-slow" /> : d.status === '—' ? '' : d.status}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* DAY DETAIL PLATEAU */}
                                {modalSelectedDay && modalSelectedDay.totals && (
                                    <div className="mt-8 p-6 bg-indigo-600/10 rounded-3xl border border-indigo-500/20 animate-slide-up">
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">{modalSelectedDay.type}</p>
                                            <button onClick={() => setModalSelectedDay(null)} className="text-white/20 hover:text-white transition-colors">
                                                <Icons.X size={14} />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                            {[
                                                { l: 'Calorías', k: 'calories', u: 'kcal' },
                                                { l: 'Proteína', k: 'protein', u: 'g' },
                                                { l: 'Carbos', k: 'carbs', u: 'g' },
                                                { l: 'Magnesio', k: 'mg', u: 'mg' },
                                                { l: 'Potasio', k: 'k', u: 'mg' },
                                                { l: 'Sodio', k: 'na', u: 'mg' }
                                            ].map(item => {
                                                const val = modalSelectedDay.totals[item.k];
                                                const th = modalSelectedDay.thresholds[item.k === 'na' ? 'sodium' : item.k === 'k' ? 'potassium' : item.k === 'mg' ? 'magnesium' : item.k];
                                                let symbol = '';
                                                if (th) {
                                                    if (val > (th.max || th.optHigh)) symbol = ' ↑';
                                                    else if (val < (th.min || th.optLow)) symbol = ' ↓';
                                                    else symbol = ' =';
                                                }

                                                return (
                                                    <div key={item.l} className="flex justify-between items-baseline border-b border-white/5 pb-1">
                                                        <span className="text-[10px] font-bold text-slate-400">{item.l}</span>
                                                        <span className="text-xs text-white">
                                                            {Math.round(val)}<span className="text-[10px] ml-1 opacity-60 font-black">{symbol}</span>
                                                            <span className="text-[8px] ml-1 opacity-40">{item.u}</span>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ANALYSIS DROPDOWN */}
                            <details className="group">
                                <summary className="flex items-center justify-center gap-3 text-[10px] font-black text-slate-500 uppercase cursor-pointer hover:text-white transition-all py-4 bg-white/5 rounded-2xl border border-white/5 group-open:bg-indigo-600/10 group-open:border-indigo-500/20">
                                    <Icons.BarChart3 size={14} className="text-indigo-400" />
                                    <span>Telemetría de Nutrientes</span>
                                    <Icons.ChevronDown size={14} className="group-open:rotate-180 transition-transform ml-2" />
                                </summary>
                                <div className="pt-6 grid grid-cols-1 gap-3 animate-slide-up">
                                    {[
                                        { label: 'Proteína', key: 'protein' },
                                        { label: 'Carbohidratos', key: 'carbs' },
                                        { label: 'Grasa', key: 'fat' },
                                        { label: 'Fibra', key: 'fiber' },
                                        { label: 'Calcio', key: 'ca' }
                                    ].map(n => {
                                        const bal = weeklyProgress.balanceUntilYesterday[n.key] || 0;
                                        const target = weeklyProgress.fullTargets[n.key] || 1;
                                        const ratio = bal / target;
                                        let statusText = 'BALANCE ÓPTIMO';
                                        let statusColor = 'text-teal-400';
                                        let bgBar = 'bg-teal-500/20';
                                        if (Math.abs(ratio) > 0.15) {
                                            statusText = ratio > 0 ? 'LIGERO EXCESO' : 'TENDRÍA DÉFICIT';
                                            statusColor = ratio > 0 ? 'text-blue-400' : 'text-amber-400';
                                            bgBar = ratio > 0 ? 'bg-blue-500/20' : 'bg-amber-500/20';
                                        }
                                        return (
                                            <div key={n.key} className="p-5 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-black text-white uppercase tracking-widest">{n.label}</span>
                                                    <span className={`text-[9px] font-black uppercase ${statusColor}`}>{statusText}</span>
                                                </div>
                                                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                                    <div className={`h-full ${bgBar} rounded-full transition-all duration-1000`} style={{ width: `${Math.min(100, (1 + ratio) * 50)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        </div>

                        {/* Footer Intelligence */}
                        <div className="p-8 border-t border-white/5 bg-slate-900/80 backdrop-blur-md space-y-6">
                            <div className="relative">
                                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.8)]" />
                                <p className="text-xs font-bold text-slate-100 leading-relaxed italic pl-6 py-1">
                                    " {(() => {
                                        const calDiff = weeklyProgress.balanceUntilYesterday?.calories || 0;
                                        if (calDiff < -100) return "Sistema equilibrado con margen positivo. El ahorro acumulado permite flexibilidad sin estrés metabólico.";
                                        if (calDiff > 100) return "Tendencia estable. No se requiere intervención inmediata para mantener la coherencia semanal.";
                                        return "Arquitectura semanal impecable. Mantén la inercia actual sin ajustes numéricos reactivos.";
                                    })()} "
                                </p>
                            </div>

                            <button
                                onClick={() => setShowWeeklyBalance(false)}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-[0_10px_30px_rgba(79,70,229,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 border border-indigo-400/30"
                            >
                                <Icons.CheckCircle size={18} /> Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MACROS + FIBER - Expandable Progress Bars */}
            <div className="bg-card p-4 rounded-3xl border border-theme mb-4">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-black text-secondary uppercase tracking-widest">Macros</p>
                </div>
                <div className="space-y-2">
                    {[
                        { key: 'calories', label: 'Calorías', value: sum('calories'), target: thresholds.calories?.optHigh || 2200, color: 'orange', unit: '' },
                        { key: 'protein', label: 'Proteína', value: sum('protein'), target: thresholds.protein?.optHigh || 125, color: 'blue', unit: 'g' },
                        { key: 'carbs', label: 'Carbohidratos', value: sum('carbs'), target: thresholds.carbs?.optHigh || 280, color: 'yellow', unit: 'g' },
                        { key: 'fat', label: 'Grasa', value: sum('fat'), target: thresholds.fat?.optHigh || 75, color: 'red', unit: 'g' },
                        { key: 'fiber', label: 'Fibra', value: sum('fiber'), target: thresholds.fiber?.optHigh || 30, color: 'green', unit: 'g' }
                    ].map(n => {
                        const percentage = Math.min(Math.round((n.value / n.target) * 100), 100);
                        const isExpanded = expandedNutrient === n.key;
                        const foods = getFoodsForNutrient(n.key);
                        const barColor = '#b35a66'; // Light maroon for all bars

                        return (
                            <div key={n.key}>
                                <button
                                    onClick={() => setExpandedNutrient(isExpanded ? null : n.key)}
                                    className="w-full text-left"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-primary">{n.label}</span>
                                        <span className="text-xs font-black text-secondary">
                                            {Math.round(n.value)}{n.unit} / {n.target}{n.unit}
                                        </span>
                                    </div>
                                    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${percentage}%`, backgroundColor: barColor }}
                                        />
                                    </div>
                                </button>
                                {isExpanded && foods.length > 0 && (
                                    <div className="mt-2 space-y-1 bg-card-alt/50 rounded-xl p-2 animate-fade-in">
                                        {foods.map((f, i) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] py-1 border-b border-theme/20 last:border-0">
                                                <span className="truncate max-w-[65%] text-primary font-medium">{f.name}</span>
                                                <span className="font-mono font-black text-sm text-white">
                                                    {n.unit === 'mg' ? Math.round(f.value) : f.value.toFixed(1)}{n.unit}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MICROS - Expandable Progress Bars */}
            <div className="bg-card p-4 rounded-3xl border border-theme">
                <p className="text-xs font-black text-secondary uppercase tracking-widest mb-3">Minerales</p>
                <div className="space-y-2">
                    {[
                        { key: 'na', label: 'Sodio (Na)', value: na, target: thresholds.sodium?.optHigh || 2200 },
                        { key: 'k', label: 'Potasio (K)', value: k, target: thresholds.potassium?.optHigh || 4500 },
                        { key: 'ca', label: 'Calcio (Ca)', value: ca, target: thresholds.calcium?.optHigh || 1200 },
                        { key: 'mg', label: 'Magnesio (Mg)', value: mg, target: thresholds.magnesium?.optHigh || 700 }
                    ].map(n => {
                        const percentage = Math.min(Math.round((n.value / n.target) * 100), 100);
                        const isExpanded = expandedNutrient === n.key;
                        const foods = getFoodsForNutrient(n.key);
                        const barColor = '#b35a66'; // Light maroon for all bars

                        return (
                            <div key={n.key}>
                                <button
                                    onClick={() => setExpandedNutrient(isExpanded ? null : n.key)}
                                    className="w-full text-left"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-primary">{n.label}</span>
                                        <span className="text-xs font-black text-secondary">
                                            {Math.round(n.value)}mg / {n.target}mg
                                        </span>
                                    </div>
                                    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${percentage}%`, backgroundColor: barColor }}
                                        />
                                    </div>
                                </button>
                                {isExpanded && foods.length > 0 && (
                                    <div className="mt-2 space-y-1 bg-card-alt/50 rounded-xl p-2 animate-fade-in">
                                        {foods.map((f, i) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] py-1 border-b border-theme/20 last:border-0">
                                                <span className="truncate max-w-[65%] text-primary font-medium">{f.name}</span>
                                                <span className="font-mono font-black text-sm text-white">
                                                    {Math.round(f.value)}mg
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ACCIONES DE CIERRE (Merienda y Cena) */}
            <div className="flex gap-3 px-1 mt-6 mb-8">
                <button
                    onClick={() => handleGenerateSuggestions('merienda')}
                    className="flex-1 py-4 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2 shadow-xl"
                >
                    <Icons.Coffee size={14} /> Merienda
                </button>
                <button
                    onClick={() => handleGenerateSuggestions('cena')}
                    className="flex-1 py-4 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2 shadow-xl"
                >
                    <Icons.Moon size={14} /> Cena
                </button>
            </div>

            {/* OVERLAY DE SUGERENCIAS (Deep Dark Premium) */}
            {suggestionOverlay && (
                <div className="fixed inset-0 z-[1000] bg-[#020617] p-8 flex flex-col animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">
                                Opciones para <span className="text-indigo-400">{suggestionOverlay}</span>
                            </h2>
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Propuestas según gaps nutricionales</p>
                        </div>
                        <button
                            onClick={() => { setSuggestionOverlay(null); setExpandedSuggestion(null); }}
                            className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 border border-white/10"
                        >
                            <Icons.X size={22} />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
                        {suggestions.map((food, i) => {
                            const isExpanded = expandedSuggestion === i;
                            const currentGaps = {
                                protein: Math.max(0, (thresholds.protein?.optHigh || 125) - sum('protein')),
                                k: Math.max(0, (thresholds.potassium?.optHigh || 4500) - sum('k')),
                                mg: Math.max(0, (thresholds.magnesium?.optHigh || 700) - sum('mg')),
                            };

                            return (
                                <div
                                    key={i}
                                    onClick={() => setExpandedSuggestion(isExpanded ? null : i)}
                                    className={`bg-slate-900/40 rounded-[2.5rem] border transition-all duration-500 overflow-hidden ${isExpanded ? 'border-indigo-500/50 ring-4 ring-indigo-500/5' : 'border-white/5'}`}
                                >
                                    <div className="p-7 flex items-center justify-between cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black text-indigo-500/40">0{i + 1}</span>
                                            <h4 className="text-base font-black text-white/90 uppercase tracking-tight">{food.name}</h4>
                                        </div>
                                        <div className={`p-1.5 rounded-lg transition-transform duration-300 ${isExpanded ? 'bg-indigo-600 text-white rotate-180' : 'bg-white/5 text-white/20'}`}>
                                            <Icons.ChevronDown size={14} />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-500">
                                            <div className="grid grid-cols-2 gap-x-12 gap-y-6 pt-4 border-t border-white/5">
                                                {/* Composición Visual */}
                                                <div className="space-y-4">
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 opacity-60">Composición Plato</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {[
                                                            { label: 'CAL', val: food.calories, unit: 'kcal', color: 'text-white' },
                                                            { label: 'PRO', val: food.protein, unit: 'g', color: 'text-emerald-400' },
                                                            { label: 'MG', val: food.mg, unit: 'mg', color: 'text-purple-400' },
                                                            { label: 'CA', val: food.ca, unit: 'mg', color: 'text-rose-400' }
                                                        ].map(n => (
                                                            <div key={n.label} className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                                                <span className="block text-[7px] font-black text-white/30 uppercase mb-1">{n.label}</span>
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className={`text-2xl font-black ${n.color}`}>{Math.round(n.val)}</span>
                                                                    <span className="text-[9px] font-bold text-white/20">{n.unit}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Impacto en Gaps */}
                                                <div className="space-y-4">
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 opacity-60">Impacto en día</p>
                                                    <div className="space-y-3">
                                                        {[
                                                            { label: 'Proteína', val: food.protein, gap: currentGaps.protein },
                                                            { label: 'Potasio', val: food.k, gap: currentGaps.k },
                                                            { label: 'Magnesio', val: food.mg, gap: currentGaps.mg }
                                                        ].map(n => {
                                                            const impact = n.gap > 0 ? Math.min(100, Math.round((n.val / n.gap) * 100)) : 0;
                                                            return (
                                                                <div key={n.label}>
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <span className="text-[9px] font-black text-white/30 uppercase">{n.label}</span>
                                                                        <span className="text-[10px] font-black text-emerald-400">+{impact}%</span>
                                                                    </div>
                                                                    <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: `${impact}%` }} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20">
                            {suggestionOverlay === 'cena' ? "Basado en tu historial de alta tolerancia" : "Equilibrio calculado para hoy"}
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <button
                    onClick={() => setShowPlatos(!showPlatos)}
                    className="w-full flex justify-between items-center px-5 py-4 bg-card rounded-[1.5rem] border border-theme shadow-sm group active:scale-[0.98] transition-all"
                >
                    <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-3">
                        🍽️ Platos del Día
                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black shadow-md shadow-indigo-500/20">{today.length}</span>
                    </h3>
                    <div className={`p-1.5 rounded-xl transition-all ${showPlatos ? 'bg-indigo-600 text-white shadow-lg' : 'bg-card-alt text-secondary group-hover:text-primary'}`}>
                        {showPlatos ? <Icons.ChevronUp size={18} /> : <Icons.ChevronDown size={18} />}
                    </div>
                </button>

                {showPlatos && (
                    <div className="space-y-3 animate-fade-in pl-1 pr-1">
                        {today.length === 0 ? (
                            <div className="text-center py-12 bg-card rounded-3xl border-2 border-dashed border-theme opacity-50">
                                <p className="text-3xl mb-3">🥣</p>
                                <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">Sin platos registrados</p>
                            </div>
                        ) : today.map(l => (
                            <div key={l._docId || l.id} className={`bg-card rounded-3xl border border-theme overflow-hidden transition-all shadow-sm ${expanded === (l._docId || l.id) ? 'ring-4 ring-indigo-500/10' : ''}`}>
                                <div
                                    className="p-4 flex items-center justify-between cursor-pointer active:bg-card-alt transition-colors"
                                    onClick={() => setExpanded(expanded === (l._docId || l.id) ? null : (l._docId || l.id))}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[11px] uppercase tracking-tight text-primary truncate flex items-center gap-2">
                                            {l.name}
                                            {(() => {
                                                const src = l.dataSource || (l.confidence || (l.name && l.name.split(' ').length > 3) ? 'estimado' : (l.foodId || l.id?.startsWith('food_') ? 'local' : 'manual'));
                                                if (src === 'local') return <span title="Base local" className="text-[9px]">🧪</span>;
                                                if (src === 'estimado') return <span title="Estimado" className="text-[9px]">🤖</span>;
                                                return null;
                                            })()}
                                        </p>
                                        <p className="text-[8px] font-bold text-secondary mt-1 flex flex-wrap gap-x-2 opacity-80">
                                            <span className="text-primary">{Math.round(l.calories || 0)} <span className="text-[7px] opacity-60">KCAL</span></span>
                                            <span className="text-blue-500">NA {Math.round(l.na || 0)}</span>
                                            <span className="text-emerald-500">K {Math.round(l.k || 0)}</span>
                                            <span className="text-rose-500">CA {Math.round(l.ca || 0)}</span>
                                            <span className="text-purple-500">MG {Math.round(l.mg || 0)}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3">
                                        <div className={`p-2 rounded-xl transition-all shadow-sm ${expanded === (l._docId || l.id) ? 'bg-indigo-600 text-white' : 'bg-card-alt text-secondary'}`}>
                                            {expanded === (l._docId || l.id) ? <Icons.ChevronUp size={16} /> : <Icons.ChevronDown size={16} />}
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); onDelete(l._docId || l.id); }} className="p-2 text-secondary/40 hover:text-rose-500 bg-card-alt rounded-xl transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/10 border border-theme/50">
                                            <Icons.Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                {expanded === (l._docId || l.id) && (
                                    <div className="px-4 pb-6">
                                        <FoodDetail
                                            food={l}
                                            onSaveFood={onSaveFood}
                                            isSaved={myFoods?.some(f => f.name === l.name && Math.round(f.calories) === Math.round(l.calories))}
                                            impactStats={(() => {
                                                if (!logs || logs.length === 0) return null;

                                                // 1. Get all symptom days from localStorage
                                                const symptomDays = {};
                                                const daysWithLogs = [...new Set(logs.map(log => log.dateISO || log.dateStr))];

                                                daysWithLogs.forEach(date => {
                                                    try {
                                                        const saved = localStorage.getItem(`dinner_feedback_${date}`);
                                                        if (saved) {
                                                            const feedback = JSON.parse(saved);
                                                            if (feedback.symptoms && feedback.symptoms.length > 0 && !feedback.symptoms.includes('bien')) {
                                                                symptomDays[date] = feedback.symptoms;
                                                            }
                                                        }
                                                    } catch (e) { }
                                                });

                                                // 2. Count occurrences of this food in dinner vs symptoms
                                                const foodLogs = logs.filter(log => log.name === l.name && log.timeBlock === 'noche');
                                                const totalOccurrences = foodLogs.length;
                                                const occurrencesWithSymptoms = foodLogs.filter(log => symptomDays[log.dateISO || log.dateStr]).length;

                                                if (totalOccurrences < 2) return null; // Only show if eaten at least twice

                                                return {
                                                    total: totalOccurrences,
                                                    symptomCount: occurrencesWithSymptoms,
                                                    rate: Math.round((occurrencesWithSymptoms / totalOccurrences) * 100),
                                                    verdict: (occurrencesWithSymptoms / totalOccurrences) > 0.6 ? 'evitar' :
                                                        (occurrencesWithSymptoms / totalOccurrences) > 0.3 ? 'moderado' : 'seguro'
                                                };
                                            })()}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
};

export default DiaryView;
