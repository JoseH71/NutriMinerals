import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';
import FoodDetail from '../Common/FoodDetail';
import NutrientSummary from '../Common/NutrientSummary';
import { ATHLETE_ID, INTERVALS_API_KEY, SHARED_USER_ID } from '../../config/firebase';

const HistoryView = ({ logs, onExport, onImport, user, onSaveFood, myFoods }) => {
    const [open, setOpen] = useState(null);
    const [copied, setCopied] = useState(null);
    const [historyTab, setHistoryTab] = useState('intervals'); // Default to Wellness
    const [intervalsData, setIntervalsData] = useState([]);
    const [intervalsLoading, setIntervalsLoading] = useState(false);
    const [intervalsError, setIntervalsError] = useState(null);
    const [expandedItem, setExpandedItem] = useState(null);
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30); // Load last 30 days by default
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);

    const importRef = useRef(null);

    // Helper to normalize any date format to ISO (YYYY-MM-DD)
    const normalizeToISO = (log) => {
        if (log.dateISO) return log.dateISO;
        if (log.dateStr) {
            const parts = log.dateStr.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }
        return log.dateStr;
    };

    const groups = useMemo(() => logs.reduce((acc, l) => {
        const key = normalizeToISO(l);
        if (!acc[key]) acc[key] = [];
        acc[key].push(l);
        return acc;
    }, {}), [logs]);

    const sortedDates = Object.keys(groups).sort((a, b) => {
        if (a.includes('-') && b.includes('-')) return b.localeCompare(a);
        const parseOld = (s) => new Date(s.split('/').reverse().join('-'));
        return parseOld(b) - parseOld(a);
    });

    // Fetch Intervals data
    useEffect(() => {
        const fetchIntervals = async () => {
            // Always fetch to ensure data availability
            setIntervalsLoading(true);
            setIntervalsError(null);
            try {
                // Fetch extra days back to ensure 60-day baseline availability
                const loadFrom = new Date(dateFrom);
                loadFrom.setDate(loadFrom.getDate() - 90); // Load 90 days explicitly for baselines
                const fromStr = loadFrom.toISOString().split('T')[0];

                const apiUrl = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=${fromStr}&newest=${dateTo}`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
                const res = await fetch(proxyUrl, {
                    headers: { 'Authorization': 'Basic ' + btoa('API_KEY:' + INTERVALS_API_KEY) }
                });
                if (!res.ok) throw new Error('Error: ' + res.status);
                const data = await res.json();
                const sorted = data.sort((a, b) => new Date(b.id) - new Date(a.id));
                setIntervalsData(sorted);
            } catch (e) {
                setIntervalsError(e.message);
            } finally {
                setIntervalsLoading(false);
            }
        };
        fetchIntervals();
    }, [dateFrom, dateTo]);

    // Calculate Normality Bands (matching Streamlit Python code exactly)
    const calculateNormalityBands = (data) => {
        // Use last 60 days for bands calculation (matching Streamlit)
        const last60Days = data.slice(0, 60);

        if (!last60Days || last60Days.length < 21) {
            return {
                hrv_mean: null, hrv_std: null, hrv_upper: null, hrv_lower: null,
                rhr_mean: null, rhr_std: null, rhr_upper: null, rhr_lower: null
            };
        }

        const bands = {};

        // HRV Bands
        const hrvData = last60Days.filter(d => d.hrv).map(d => d.hrv);
        if (hrvData.length >= 21) {
            const hrvMean = hrvData.reduce((sum, val) => sum + val, 0) / hrvData.length;
            // Use N-1 (sample variance) to match Pandas default behavior
            const denominator = hrvData.length > 1 ? hrvData.length - 1 : 1;
            const hrvVariance = hrvData.reduce((sum, val) => sum + Math.pow(val - hrvMean, 2), 0) / denominator;
            const hrvStd = Math.sqrt(hrvVariance);

            bands.hrv_mean = hrvMean;
            bands.hrv_std = hrvStd;

            if (hrvStd > 0) {
                bands.hrv_lower = hrvMean - (0.75 * hrvStd);
                bands.hrv_upper = hrvMean + (0.75 * hrvStd);
            } else {
                bands.hrv_lower = hrvMean * 0.9;
                bands.hrv_upper = hrvMean * 1.1;
            }
        } else {
            bands.hrv_mean = null;
            bands.hrv_std = null;
            bands.hrv_upper = null;
            bands.hrv_lower = null;
        }

        // RHR Bands
        const rhrData = last60Days.filter(d => d.restingHR).map(d => d.restingHR);
        if (rhrData.length >= 21) {
            const rhrMean = rhrData.reduce((sum, val) => sum + val, 0) / rhrData.length;
            // Use N-1 (sample variance) to match Pandas default behavior
            const denominator = rhrData.length > 1 ? rhrData.length - 1 : 1;
            const rhrVariance = rhrData.reduce((sum, val) => sum + Math.pow(val - rhrMean, 2), 0) / denominator;
            const rhrStd = Math.sqrt(rhrVariance);

            bands.rhr_mean = rhrMean;
            bands.rhr_std = rhrStd;

            if (rhrStd > 0) {
                bands.rhr_lower = rhrMean - (0.75 * rhrStd);
                bands.rhr_upper = rhrMean + (0.75 * rhrStd);
            } else {
                bands.rhr_lower = rhrMean * 0.9;
                bands.rhr_upper = rhrMean * 1.1;
            }
        } else {
            bands.rhr_mean = null;
            bands.rhr_std = null;
            bands.rhr_upper = null;
            bands.rhr_lower = null;
        }

        return bands;
    };

    // Calendar Helper
    const renderCalendar = (recordedDates, onDateClick, colorTheme = 'indigo') => {
        const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const getFirstDayOfMonth = (date) => {
            const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
            return day === 0 ? 6 : day - 1; // Adjust for Monday start
        };

        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);
        const days = [];

        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 md:h-10" />);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            const dateStr = date.toISOString().split('T')[0];
            const hasData = recordedDates.includes(dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isSelected = selectedDate === dateStr;

            let bgClass = 'bg-card-alt text-secondary opacity-50';
            if (hasData) {
                if (colorTheme === 'indigo') bgClass = 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800';
                if (colorTheme === 'emerald') bgClass = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800';
            }
            if (isSelected) bgClass = 'bg-primary text-white shadow-lg scale-110 z-10';
            if (isToday && !isSelected) bgClass += ' ring-2 ring-primary ring-offset-2 ring-offset-card';

            days.push(
                <button
                    key={d}
                    onClick={() => hasData && onDateClick(dateStr)}
                    disabled={!hasData}
                    className={`h-8 md:h-10 rounded-xl flex items-center justify-center text-xs transition-all ${bgClass}`}
                >
                    {d}
                </button>
            );
        }

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        return (
            <div className="bg-card p-4 rounded-3xl border border-theme shadow-sm select-none">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 hover:bg-card-alt rounded-full text-secondary"><Icons.ChevronLeft size={16} /></button>
                    <span className="font-black uppercase tracking-widest text-xs text-primary">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 hover:bg-card-alt rounded-full text-secondary"><Icons.ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                        <div key={d} className="text-center text-[9px] font-black text-secondary opacity-40">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days}
                </div>
            </div>
        );
    };

    const copyDayData = (date, dayLogs) => {
        const totals = dayLogs.reduce((acc, l) => ({
            calories: acc.calories + Number(l.calories || 0),
            protein: acc.protein + Number(l.protein || 0),
            carbs: acc.carbs + Number(l.carbs || 0),
            fat: acc.fat + Number(l.fat || 0),
            na: acc.na + Number(l.na || 0),
            k: acc.k + Number(l.k || 0),
            ca: acc.ca + Number(l.ca || 0),
            mg: acc.mg + Number(l.mg || 0)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0, na: 0, k: 0, ca: 0, mg: 0 });

        let text = `📅 NUTRICIÓN ${date}\n\n`;
        text += `🍽️ ALIMENTOS:\n`;
        dayLogs.forEach(l => {
            text += `• ${l.name}: ${Math.round(l.calories || 0)} kcal | P${Math.round(l.protein || 0)}g C${Math.round(l.carbs || 0)}g G${Math.round(l.fat || 0)}g | Na${Math.round(l.na || 0)} K${Math.round(l.k || 0)} Ca${Math.round(l.ca || 0)} Mg${Math.round(l.mg || 0)}\n`;
        });
        text += `\n📊 TOTALES:\n`;
        text += `Calorías: ${Math.round(totals.calories)} kcal\n`;
        text += `Proteína: ${Math.round(totals.protein)}g | Carbos: ${Math.round(totals.carbs)}g | Grasa: ${Math.round(totals.fat)}g\n`;
        text += `Na: ${Math.round(totals.na)}mg | K: ${Math.round(totals.k)}mg | Ca: ${Math.round(totals.ca)}mg | Mg: ${Math.round(totals.mg)}mg\n`;
        text += `Ratio Na:K = 1:${(totals.k / (totals.na || 1)).toFixed(1)}`;

        navigator.clipboard.writeText(text).then(() => {
            setCopied(date);
            setTimeout(() => setCopied(null), 2000);
        });
    };

    return (
        <div className="space-y-4 animate-fade-in pb-10 px-2">
            <div className="flex justify-between items-center px-1 mb-2">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Historial</h2>
                <div className="flex gap-2">
                    <button onClick={() => importRef.current.click()} className="p-3 bg-card border border-theme rounded-2xl text-emerald-600 shadow-sm active:scale-95 transition-all"><Icons.Upload size={20} /></button>
                    <button onClick={onExport} className="p-3 bg-card border border-theme rounded-2xl text-indigo-600 shadow-sm active:scale-95 transition-all"><Icons.Download size={20} /></button>
                </div>
            </div>
            <input type="file" accept=".json" className="hidden" ref={importRef} onChange={e => { if (e.target.files[0]) { onImport(e.target.files[0]); e.target.value = ''; } }} />

            {/* Tabs - Reduced Size */}
            <div className="flex bg-card rounded-2xl p-1 border border-theme shadow-sm">
                <button
                    onClick={() => setHistoryTab('food')}
                    className={`flex-1 py-1.5 px-2 rounded-xl font-black text-[10px] transition-all uppercase tracking-widest ${historyTab === 'food' ? 'bg-indigo-600 text-white shadow-lg' : 'text-secondary hover:text-primary'}`}
                >🍽️ Nutrición</button>
                <button
                    onClick={() => setHistoryTab('intervals')}
                    className={`flex-1 py-1.5 px-2 rounded-xl font-black text-[10px] transition-all uppercase tracking-widest ${historyTab === 'intervals' ? 'bg-emerald-600 text-white shadow-lg' : 'text-secondary hover:text-primary'}`}
                >📡 Wellness</button>
            </div>

            {/* Morning Summary Button - Reduced Size */}
            {(() => {
                // Get yesterday's date
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayISO = yesterday.toISOString().split('T')[0];

                // Get yesterday's nutrition logs
                const yesterdayLogs = groups[yesterdayISO] || [];
                const dinnerLogs = yesterdayLogs.filter(l => l.timeBlock === 'noche');

                // Calculate nutrition totals
                const totals = yesterdayLogs.reduce((acc, l) => ({
                    calories: acc.calories + Number(l.calories || 0),
                    protein: acc.protein + Number(l.protein || 0),
                    carbs: acc.carbs + Number(l.carbs || 0),
                    fat: acc.fat + Number(l.fat || 0),
                    fiber: acc.fiber + Number(l.fiber || 0),
                    na: acc.na + Number(l.na || 0),
                    k: acc.k + Number(l.k || 0),
                    ca: acc.ca + Number(l.ca || 0),
                    mg: acc.mg + Number(l.mg || 0)
                }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 });

                // Get today's wellness data (preferred) or find yesterday's
                const todayISO = new Date().toISOString().split('T')[0];
                const todayWellness = intervalsData.find(d => d.id === todayISO);

                // For TSB we rely on whatever data we have
                const tss = todayWellness?.trainingLoad || '-'; // If today has no load yet, it might be 0
                // Ideally look for yesterday's load for the summary
                const yesterdayWellness = intervalsData.find(d => d.id === yesterdayISO);
                const tssYesterday = yesterdayWellness?.icu_training_load || yesterdayWellness?.trainingLoad || '-';

                // TSB (Form) usually from today or yesterday
                const tsb = todayWellness ? (todayWellness.ctl - todayWellness.atl).toFixed(0) : '-';

                const copyMorningSummary = () => {
                    let text = `🌅 RESUMEN MATINAL - ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}\n`;
                    text += `📅 Datos del día anterior (${yesterdayISO})\n\n`;

                    // Health Metrics (from TODAY if available, or fallback)
                    text += `❤️ MÉTRICAS DE SALUD:\n`;
                    text += `• RHR: ${todayWellness?.restingHR || '-'} bpm\n`;
                    text += `• HRV: ${todayWellness?.hrv || '-'} ms\n`;
                    text += `• Sueño: ${todayWellness?.sleepScore || '-'}/100\n`;
                    text += `• TSS (ayer): ${tssYesterday}\n`;
                    text += `• TSB (forma): ${tsb}\n\n`;

                    // Macro Summary
                    text += `🍽️ MACROS DEL DÍA:\n`;
                    text += `• Calorías: ${Math.round(totals.calories)} kcal\n`;
                    text += `• Proteína: ${Math.round(totals.protein)}g\n`;
                    text += `• Carbohidratos: ${Math.round(totals.carbs)}g\n`;
                    text += `• Grasas: ${Math.round(totals.fat)}g\n`;
                    text += `• Fibra: ${Math.round(totals.fiber)}g\n\n`;

                    // Micro Summary
                    text += `💎 MINERALES DEL DÍA:\n`;
                    text += `• Sodio (Na): ${Math.round(totals.na)} mg\n`;
                    text += `• Potasio (K): ${Math.round(totals.k)} mg\n`;
                    text += `• Calcio (Ca): ${Math.round(totals.ca)} mg\n`;
                    text += `• Magnesio (Mg): ${Math.round(totals.mg)} mg\n`;
                    text += `• Ratio Na:K = 1:${(totals.k / (totals.na || 1)).toFixed(1)}\n\n`;

                    // Dinner Composition
                    text += `🌙 CENA DE ANOCHE:\n`;
                    if (dinnerLogs.length === 0) {
                        text += `• Sin registros de cena\n`;
                    } else {
                        dinnerLogs.forEach(l => {
                            text += `• ${l.name}: ${Math.round(l.calories || 0)} kcal (P${Math.round(l.protein || 0)}g C${Math.round(l.carbs || 0)}g G${Math.round(l.fat || 0)}g)\n`;
                        });
                        const dinnerTotals = dinnerLogs.reduce((acc, l) => ({
                            calories: acc.calories + Number(l.calories || 0),
                            fat: acc.fat + Number(l.fat || 0),
                            fiber: acc.fiber + Number(l.fiber || 0)
                        }), { calories: 0, fat: 0, fiber: 0 });
                        text += `📊 Total cena: ${Math.round(dinnerTotals.calories)} kcal | Grasa: ${Math.round(dinnerTotals.fat)}g | Fibra: ${Math.round(dinnerTotals.fiber)}g\n`;
                    }

                    // Dinner Feedback (Punto 5)
                    try {
                        const feedbackKey = `dinner_feedback_${yesterdayISO}`;
                        const savedFeedback = localStorage.getItem(feedbackKey);
                        if (savedFeedback) {
                            const feedback = JSON.parse(savedFeedback);
                            text += `\n🩺 FEEDBACK DE CENA:\n`;

                            const symptomLabels = {
                                'gases': '💨 Gases',
                                'pulso_alto': '❤️ Pulso alto',
                                'hrv_bajo': '📉 HRV bajo',
                                'fa': '⚡ FA (CRÍTICO)',
                                'reflujo': '🔥 Reflujo',
                                'bien': '💤 Sin síntomas'
                            };

                            const symptoms = feedback.symptoms || [];
                            if (symptoms.length > 0) {
                                text += `• Sensaciones: ${symptoms.map(s => symptomLabels[s] || s).join(', ')}\n`;
                            } else {
                                text += `• Sin feedback registrado\n`;
                            }
                        }
                    } catch (e) {
                        // Ignore localStorage errors
                    }

                    // Training Suggestion based on HRV and symptoms
                    text += `\n💡 SUGERENCIA DE ENTRENO:\n`;
                    const hrvToday = todayWellness?.hrv;

                    try {
                        const feedbackKey = `dinner_feedback_${yesterdayISO}`;
                        const savedFeedback = localStorage.getItem(feedbackKey);
                        const hasFASymptom = savedFeedback && JSON.parse(savedFeedback).symptoms?.includes('fa');
                        const hasNegativeSymptoms = savedFeedback && JSON.parse(savedFeedback).symptoms?.some(s => ['gases', 'pulso_alto', 'hrv_bajo', 'fa', 'reflujo'].includes(s));

                        if (hasFASymptom) {
                            text += `⚠️ DESCANSO TOTAL - Detectada FA anoche. Consultar médico.\n`;
                        } else if (hrvToday && intervalsData.length > 1) {
                            const last7Days = intervalsData.slice(0, 7).filter(d => d.hrv);
                            const avgHRV = last7Days.reduce((sum, d) => sum + d.hrv, 0) / last7Days.length;
                            const hrvDelta = ((hrvToday - avgHRV) / avgHRV) * 100;

                            if (hrvDelta < -15 || hasNegativeSymptoms) {
                                text += `• HRV bajo (${hrvDelta.toFixed(0)}%) ${hasNegativeSymptoms ? '+ síntomas digestivos' : ''}\n`;
                                text += `• Recomendación: Entreno Z1 o Descanso activo\n`;
                            } else if (hrvDelta < -5) {
                                text += `• HRV ligeramente bajo (${hrvDelta.toFixed(0)}%)\n`;
                                text += `• Recomendación: Entreno moderado, evitar alta intensidad\n`;
                            } else {
                                text += `• HRV normal (${hrvDelta.toFixed(0)}%)\n`;
                                text += `• Recomendación: Entreno según planificación\n`;
                            }
                        } else {
                            text += `• Sin datos de HRV para hoy\n`;
                        }
                    } catch (e) {
                        text += `• Entreno según planificación\n`;
                    }

                    navigator.clipboard.writeText(text).then(() => {
                        setCopied('morning');
                        setTimeout(() => setCopied(null), 3000);
                    });
                };

                return (
                    <button
                        onClick={copyMorningSummary}
                        className={`w-full p-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 ${copied === 'morning'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                            }`}
                    >
                        {copied === 'morning' ? (
                            <><Icons.Check size={14} /> ¡Copiado!</>
                        ) : (
                            <><Icons.ClipboardCopy size={14} /> 📋 Resumen Matinal</>
                        )}
                    </button>
                );
            })()}

            {/* Content Tabs */}
            {historyTab === 'food' && (
                <div className="space-y-4">
                    {!selectedDate ? (
                        <>
                            {/* Calendar for Food */}
                            <div className="scale-90 origin-top">
                                {renderCalendar(sortedDates, (d) => setSelectedDate(d), 'indigo')}
                            </div>
                            <div className="text-center py-6 bg-card rounded-2xl border border-theme">
                                <p className="text-xs font-bold text-secondary">Selecciona un día del calendario</p>
                            </div>
                        </>
                    ) : (
                        <div className="animate-slide-up">
                            <button onClick={() => setSelectedDate(null)} className="mb-4 flex items-center gap-2 text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-2 rounded-xl">
                                <Icons.ArrowLeft size={14} /> Volver al calendario
                            </button>
                            {(() => {
                                const date = selectedDate;
                                const dayLogs = groups[date] || [];
                                const cals = Math.round(dayLogs.reduce((s, l) => s + Number(l.calories || 0), 0));

                                return (
                                    <div className="bg-card rounded-3xl border border-theme overflow-hidden shadow-md">
                                        <div className="p-6 flex justify-between items-center border-b border-theme/20 bg-card-alt/20">
                                            <div>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                                                    {date === new Date().toISOString().split('T')[0] ? 'HOY' : date}
                                                </span>
                                                <p className="text-3xl font-black mt-2 tracking-tighter">{cals} <small className="text-sm font-bold opacity-30 tracking-widest">KCAL</small></p>
                                                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-1">{dayLogs.length} platos registrados</p>
                                            </div>
                                            <button
                                                onClick={() => copyDayData(date, dayLogs)}
                                                className={`p-3 rounded-xl transition-all shadow-sm ${copied === date ? 'bg-emerald-500 text-white' : 'bg-card-alt text-secondary hover:text-indigo-600 border border-theme/50'}`}
                                            >
                                                {copied === date ? <Icons.Check size={20} /> : <Icons.Copy size={20} />}
                                            </button>
                                        </div>
                                        <div className="px-6 pb-8 pt-6">
                                            <div className="space-y-2 mb-8 bg-card-alt/30 p-2 rounded-2xl">
                                                {dayLogs.map((l, i) => {
                                                    const itemId = `${date}_${i}`;
                                                    const isExpanded = expandedItem === itemId;
                                                    return (
                                                        <div key={itemId} className="last:border-b-0 border-b border-theme/20 pb-1">
                                                            <button
                                                                onClick={() => setExpandedItem(isExpanded ? null : itemId)}
                                                                className={`w-full flex justify-between items-center py-3 px-3 rounded-xl transition-all ${isExpanded ? 'bg-card shadow-sm ring-1 ring-theme' : 'hover:bg-card-alt'}`}
                                                            >
                                                                <span className="truncate max-w-[55%] font-black uppercase text-[11px] tracking-tight text-primary flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                                    {l.name}
                                                                </span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="font-black text-xs text-indigo-600 dark:text-indigo-400">{Math.round(l.calories)} <span className="text-[9px] font-bold opacity-60 uppercase">Kcal</span></span>
                                                                    <div className={`p-1 rounded-lg transition-all ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-card-alt text-secondary'}`}>
                                                                        {isExpanded ? <Icons.ChevronUp className="w-3 h-3" /> : <Icons.ChevronDown className="w-3 h-3" />}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            {isExpanded && (
                                                                <div className="px-2 pb-2">
                                                                    <FoodDetail
                                                                        food={l}
                                                                        onSaveFood={onSaveFood}
                                                                        isSaved={myFoods?.some(f => f.name === l.name && Math.round(f.calories) === Math.round(l.calories))}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <NutrientSummary dayLogs={dayLogs} title={`Balance nutricional (${date})`} />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {historyTab === 'intervals' && (
                <div className="space-y-4">
                    {!selectedDate ? (
                        <>
                            {intervalsLoading && (
                                <div className="text-center py-6">
                                    <Icons.Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 opacity-50" />
                                </div>
                            )}

                            {intervalsError && (
                                <div className="text-center py-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-200">
                                    <p className="text-xs font-black text-rose-500">{intervalsError}</p>
                                </div>
                            )}

                            {/* Today's Metrics - Shows first */}
                            {(() => {
                                // Find today's data or most recent
                                const todayISO = new Date().toISOString().split('T')[0];
                                const today = intervalsData.find(d => d.id === todayISO);

                                if (!today && intervalsData.length === 0 && !intervalsLoading) {
                                    return (
                                        <div className="text-center py-6 bg-card rounded-2xl border border-theme">
                                            <p className="text-xs font-bold text-secondary">Sin datos de hoy</p>
                                            <p className="text-[10px] text-secondary mt-2">Sincroniza tu reloj/dispositivo</p>
                                        </div>
                                    );
                                }

                                // Used for display logic - if today is missing, show most recent to avoid blank screen
                                const displayData = today || intervalsData[0];
                                if (!displayData) return null;

                                const isRealToday = displayData.id === todayISO;

                                // Calculate indices relative to the displayed date
                                const displayIdx = intervalsData.findIndex(d => d.id === displayData.id);
                                const yesterday = intervalsData[displayIdx + 1];

                                // BASELINE CALCULATION - INCLUDE TODAY (matching Python's df_including_today)
                                const dataIncludingToday = [displayData, ...intervalsData.slice(displayIdx + 1)];

                                // Helper for Independent Record-Based Averages (Matches Streamlit's tail(N))
                                const getMetricAvg = (data, window, metric) => {
                                    const subset = data.slice(0, window).filter(d => d[metric] != null && !isNaN(d[metric]));
                                    if (subset.length === 0) return null;
                                    return subset.reduce((sum, d) => sum + d[metric], 0) / subset.length;
                                };

                                const avgHRV = getMetricAvg(dataIncludingToday, 7, 'hrv');
                                const avgHRV21 = getMetricAvg(dataIncludingToday, 21, 'hrv');
                                const avgRHR21 = getMetricAvg(dataIncludingToday, 21, 'restingHR');
                                const avgSleep7 = getMetricAvg(dataIncludingToday, 7, 'sleepScore');
                                const avgSleep21 = getMetricAvg(dataIncludingToday, 21, 'sleepScore');

                                // HRV Score (40%) - v4.8 Linear 72.5-Base
                                let hrvScore = 72.5;
                                if (avgHRV && avgHRV21) {
                                    const trendRatio = avgHRV / avgHRV21;
                                    hrvScore = 72.5 + (trendRatio - 1) * 50;
                                }
                                hrvScore = Math.max(0, Math.min(100, hrvScore));

                                // RHR Score (20%) - v4.8 Linear 72.5-Base
                                let rhrScore = 72.5;
                                if (displayData.restingHR && avgRHR21) {
                                    const deviation = displayData.restingHR - avgRHR21;
                                    rhrScore = 72.5 - (deviation * 4); // Continuous linear logic
                                }
                                rhrScore = Math.max(0, Math.min(100, rhrScore));

                                // Sleep Score (25%) - v4.8 Linear 72.5-Base
                                let sleepScore = 72.5;
                                if (avgSleep7 && avgSleep21) {
                                    const ratio = avgSleep7 / avgSleep21;
                                    sleepScore = 72.5 + (ratio - 1) * 40;
                                }
                                sleepScore = Math.max(0, Math.min(100, sleepScore));

                                // TSB Score (15%) - v4.8 Linear 72.5-Base
                                const tsb = (yesterday?.ctl != null && yesterday?.atl != null) ? yesterday.ctl - yesterday.atl : null;
                                let tsbScore = 72.5;
                                if (tsb != null) {
                                    tsbScore = 72.5 + tsb;
                                }
                                tsbScore = Math.max(0, Math.min(100, tsbScore));

                                const ier = (0.40 * hrvScore + 0.20 * rhrScore + 0.25 * sleepScore + 0.15 * tsbScore);

                                // READINESS CALCULATION (Python "Points" logic)
                                // 1. Calculate Baselines (Recovery Baseline for RHR)
                                let rhrBaselineRec = null;
                                let hrvMeanHist = null;
                                let hrvStdHist = null;

                                // History for baseline (last 60 days FROM YESTERDAY - effectively excluding today for baseline establishment per v4.4 spec)
                                // Python: calculate_baselines(past_df) where past_df = df_including_today.iloc[:-1]
                                // So baselines use data up to Yesterday.
                                // History for baseline (60 records effectively excluding today)
                                const history60 = dataIncludingToday.slice(1, 61);

                                if (history60.length >= 7) {
                                    // HRV Historic Baseline
                                    const hrvVals = history60.filter(d => d.hrv).map(d => d.hrv);
                                    if (hrvVals.length > 0) {
                                        hrvMeanHist = hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length;
                                        // Use N-1 (Bessel's correction) to match Pandas default std()
                                        const denominator = hrvVals.length > 1 ? hrvVals.length - 1 : 1;
                                        const variance = hrvVals.reduce((a, b) => a + Math.pow(b - hrvMeanHist, 2), 0) / denominator;
                                        hrvStdHist = Math.sqrt(variance);
                                    }

                                    // RHR Recovery Baseline (Days where ATL is < 40th percentile)
                                    // Filter out days without ATL
                                    const atlVals = history60.filter(d => d.atl !== undefined).map(d => d.atl).sort((a, b) => a - b);
                                    if (atlVals.length > 0) {
                                        const q40Idx = Math.floor(atlVals.length * 0.4);
                                        const atlThreshold = atlVals[q40Idx];

                                        // Get days with low ATL (Recovery days)
                                        const recoveryDays = history60.filter(d => d.atl !== undefined && d.atl < atlThreshold && d.restingHR);
                                        if (recoveryDays.length > 0) {
                                            rhrBaselineRec = recoveryDays.reduce((sum, d) => sum + d.restingHR, 0) / recoveryDays.length;
                                        }
                                    }
                                }

                                // 2. Calculate Points
                                let readiness = 0;
                                let debugPoints = { sleep: 0, rhr: 0, hrv: 0 };

                                // Sleep Points: compare MA7 vs MA28 (Python uses tail(28))
                                // v4.6 fix: Record-based independent averages
                                const avgSleep28 = getMetricAvg(dataIncludingToday, 28, 'sleepScore');

                                if (avgSleep7 && avgSleep28) {
                                    if (avgSleep7 >= avgSleep28) { readiness += 15; debugPoints.sleep = 15; }
                                    else if (avgSleep7 > avgSleep28 * 0.95) { readiness += 12; debugPoints.sleep = 12; }
                                    else if (avgSleep7 >= avgSleep28 * 0.90) { readiness += 7; debugPoints.sleep = 7; }
                                }

                                // RHR Points (vs Recovery Baseline)
                                if (displayData.restingHR && rhrBaselineRec) {
                                    const rhrDev = displayData.restingHR - rhrBaselineRec;
                                    if (rhrDev <= 1) { readiness += 35; debugPoints.rhr = 35; }
                                    else if (rhrDev <= 2) { readiness += 25; debugPoints.rhr = 25; }
                                    else if (rhrDev <= 3) { readiness += 15; debugPoints.rhr = 15; }
                                }

                                // HRV Points (Z-Score vs Historic)
                                if (avgHRV && hrvMeanHist && hrvStdHist > 0) {
                                    // avgHRV is rolling mean of 7 days including today
                                    const zScore = (avgHRV - hrvMeanHist) / hrvStdHist;
                                    if (zScore >= 0.5) { readiness += 50; debugPoints.hrv = 50; }
                                    else if (zScore >= -0.5) { readiness += 35; debugPoints.hrv = 35; }
                                    else if (zScore >= -1.0) { readiness += 20; debugPoints.hrv = 20; }
                                }

                                readiness = Math.max(0, Math.min(100, readiness));

                                // Colors
                                const getColor = (val) => {
                                    if (val >= 70) return { bg: 'bg-emerald-500', ring: 'ring-emerald-500' };
                                    if (val >= 50) return { bg: 'bg-yellow-500', ring: 'ring-yellow-500' };
                                    return { bg: 'bg-rose-500', ring: 'ring-rose-500' };
                                };
                                const ierColor = getColor(ier);
                                const readinessColor = getColor(readiness);

                                return (
                                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10">
                                            <Icons.Activity size={120} />
                                        </div>

                                        <div className="relative z-10">
                                            <p className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-6 border-b border-white/10 pb-4 text-center">
                                                {isRealToday ? 'Métricas de Hoy' : `Datos del ${displayData.id}`}
                                            </p>

                                            {/* Circles - Swapped: Readiness LEFT, IER RIGHT */}
                                            <div className="flex justify-center gap-8 mb-8">
                                                <div className="relative">
                                                    <div className={`w-24 h-24 rounded-full ${readinessColor.bg} flex flex-col items-center justify-center shadow-lg ring-4 ${readinessColor.ring} ring-opacity-30`}>
                                                        <span className="text-2xl font-black text-black">{Math.round(readiness)}</span>
                                                        <span className="text-[8px] font-bold uppercase tracking-wider opacity-80 text-black">Ready</span>
                                                    </div>
                                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                                        <p className="text-[9px] font-black text-indigo-200 uppercase tracking-tight">Preparación</p>
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    <div className={`w-24 h-24 rounded-full ${ierColor.bg} flex flex-col items-center justify-center shadow-lg ring-4 ${ierColor.ring} ring-opacity-30`}>
                                                        <span className="text-2xl font-black text-black">{Math.round(ier)}</span>
                                                        <span className="text-[8px] font-bold uppercase tracking-wider opacity-80 text-black">IER</span>
                                                    </div>
                                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                                        <p className="text-[9px] font-black text-indigo-200 uppercase tracking-tight">Recuperación</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Metrics Grid */}
                                            <div className="grid grid-cols-3 gap-4 mt-12 mb-6">
                                                <div className="text-center bg-white/5 p-3 rounded-2xl backdrop-blur-sm border border-white/5">
                                                    <p className="text-[9px] text-indigo-300 uppercase font-black tracking-tighter mb-1">RHR</p>
                                                    <p className="text-3xl font-black">{displayData.restingHR || '-'}<span className="text-[10px] ml-0.5 opacity-50">bpm</span></p>
                                                </div>
                                                <div className="text-center bg-white/5 p-3 rounded-2xl backdrop-blur-sm border border-white/5">
                                                    <p className="text-[9px] text-indigo-300 uppercase font-black tracking-tighter mb-1">HRV</p>
                                                    <p className="text-3xl font-black text-emerald-400">{displayData.hrv || '-'}<span className="text-[10px] ml-0.5 opacity-50 text-white">ms</span></p>
                                                </div>
                                                <div className="text-center bg-white/5 p-3 rounded-2xl backdrop-blur-sm border border-white/5">
                                                    <p className="text-[9px] text-indigo-300 uppercase font-black tracking-tighter mb-1">Sueño</p>
                                                    <p className="text-3xl font-black text-purple-400">{displayData.sleepScore || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Training Load */}
                                            {(() => {
                                                const ctlAyer = yesterday?.ctl;
                                                const atlAyer = yesterday?.atl;
                                                const tsbAyer = (ctlAyer != null && atlAyer != null) ? ctlAyer - atlAyer : null;

                                                return (
                                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                                                        <p className="text-[9px] font-black w-full text-center uppercase tracking-widest mb-3 opacity-50">Carga Externa (Ayer)</p>
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="text-center">
                                                                <p className="text-[9px] text-emerald-300 uppercase font-black tracking-tighter mb-1">CTL</p>
                                                                <p className="text-xl font-black text-emerald-300">{ctlAyer?.toFixed(0) || '-'}</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-[9px] text-rose-300 uppercase font-black tracking-tighter mb-1">ATL</p>
                                                                <p className="text-xl font-black text-rose-300">{atlAyer?.toFixed(0) || '-'}</p>
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-[9px] text-indigo-200 uppercase font-black tracking-tighter mb-1">TSB</p>
                                                                <p className={`text-xl font-black ${tsbAyer != null && tsbAyer >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                    {tsbAyer != null ? tsbAyer.toFixed(0) : '-'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Normality Bands - NEW */}
                            {(() => {
                                // Calculate bands using last 60 days (excluding today)
                                const todayISO = new Date().toISOString().split('T')[0];
                                const displayIdx = intervalsData.findIndex(d => d.id === todayISO);
                                const baselineStart = displayIdx >= 0 ? displayIdx + 1 : 1;
                                const last60Days = intervalsData.slice(baselineStart, baselineStart + 60);

                                const bands = calculateNormalityBands(last60Days);
                                const today = intervalsData.find(d => d.id === todayISO);

                                // Calculate MA7 (7-day moving average INCLUDING today) - matching Streamlit
                                const last7DaysIncludingToday = intervalsData.slice(displayIdx, displayIdx + 7);
                                const hrvValues7d = last7DaysIncludingToday.filter(d => d.hrv).map(d => d.hrv);
                                const rhrValues7d = last7DaysIncludingToday.filter(d => d.restingHR).map(d => d.restingHR);

                                const hrv_ma7 = hrvValues7d.length > 0 ? hrvValues7d.reduce((sum, v) => sum + v, 0) / hrvValues7d.length : null;
                                const rhr_ma7 = rhrValues7d.length > 0 ? rhrValues7d.reduce((sum, v) => sum + v, 0) / rhrValues7d.length : null;

                                // Check if we have enough data
                                if (!bands.hrv_mean && !bands.rhr_mean) {
                                    return (
                                        <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm">
                                            <p className="text-xs font-black text-secondary uppercase tracking-widest text-center">
                                                Bandas de Normalidad
                                            </p>
                                            <p className="text-[10px] text-secondary text-center mt-2">
                                                Datos insuficientes (mínimo 21 días)
                                            </p>
                                        </div>
                                    );
                                }

                                // Helper to render a band bar
                                const renderBand = (label, ma7Value, todayValue, mean, lower, upper, unit, isLowerAlarm) => {
                                    if (mean === null || lower === null || upper === null) return null;

                                    // Determine if MA7 is outside bands
                                    const isOutside = isLowerAlarm
                                        ? (ma7Value && ma7Value < lower)
                                        : (ma7Value && ma7Value > upper);

                                    const valueColor = isOutside ? 'text-rose-400' : 'text-emerald-400';
                                    const markerColor = isOutside ? 'bg-rose-500' : 'bg-emerald-400';
                                    const bandRangeColor = isOutside ? 'bg-rose-500/20' : 'bg-emerald-500/20';
                                    const bandBorderColor = isOutside ? 'border-rose-500/40' : 'border-emerald-500/40';

                                    // Calculate ranges for visualization
                                    const bandWidth = upper - lower;
                                    const viewMin = lower - (bandWidth * 0.5);
                                    const viewMax = upper + (bandWidth * 0.5);
                                    const totalRange = viewMax - viewMin;

                                    // Position calculations (0-100%)
                                    const getPos = (val) => Math.max(0, Math.min(100, ((val - viewMin) / totalRange) * 100));

                                    const posLower = getPos(lower);
                                    const posUpper = getPos(upper);
                                    const posMean = getPos(mean);
                                    const posMA7 = ma7Value ? getPos(ma7Value) : 50;
                                    const posToday = todayValue ? getPos(todayValue) : null;

                                    return (
                                        <div className="py-4">
                                            {/* Header: Label and Values */}
                                            <div className="flex justify-between items-center mb-4">
                                                <p className="text-sm font-black text-indigo-300 uppercase tracking-wider">{label}</p>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xs text-white/40">MA7:</span>
                                                        <span className={`text-4xl font-black ${valueColor}`}>
                                                            {ma7Value ? ma7Value.toFixed(0) : '-'}
                                                        </span>
                                                        <span className="text-xs font-bold text-white/50 uppercase">{unit}</span>
                                                    </div>
                                                    {todayValue && (
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xs text-white/40">Hoy:</span>
                                                            <span className="text-xl font-bold text-white/60">
                                                                {todayValue.toFixed(0)}
                                                            </span>
                                                            <span className="text-xs font-bold text-white/40 uppercase">{unit}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Band Visualization Container - INCREASED HEIGHT */}
                                            <div className="relative h-16 w-full mt-2">
                                                {/* Full Track */}
                                                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-2 bg-white/10 rounded-full" />

                                                {/* Normal Range Band */}
                                                <div
                                                    className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-full ${bandRangeColor} border-2 ${bandBorderColor}`}
                                                    style={{
                                                        left: `${posLower}%`,
                                                        width: `${posUpper - posLower}%`
                                                    }}
                                                />

                                                {/* Mean Marker */}
                                                <div
                                                    className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white/30"
                                                    style={{ left: `${posMean}%` }}
                                                />
                                                <span
                                                    className="absolute top-10 -translate-x-1/2 text-xs font-bold text-white/40"
                                                    style={{ left: `${posMean}%` }}
                                                >
                                                    μ
                                                </span>

                                                {/* Limits Labels */}
                                                <span
                                                    className="absolute -top-5 -translate-x-1/2 text-xs font-bold text-emerald-400/60"
                                                    style={{ left: `${posLower}%` }}
                                                >
                                                    {lower.toFixed(0)}
                                                </span>
                                                <span
                                                    className="absolute -top-5 -translate-x-1/2 text-xs font-bold text-emerald-400/60"
                                                    style={{ left: `${posUpper}%` }}
                                                >
                                                    {upper.toFixed(0)}
                                                </span>

                                                {/* MA7 Value Marker (Diamond) */}
                                                {ma7Value && (
                                                    <>
                                                        <div
                                                            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 ${markerColor} shadow-lg ring-2 ring-black/50 transform -translate-x-1/2 z-10`}
                                                            style={{ left: `${posMA7}%` }}
                                                        />
                                                        <span
                                                            className="absolute -bottom-5 -translate-x-1/2 text-xs font-bold text-white/50"
                                                            style={{ left: `${posMA7}%` }}
                                                        >
                                                            MA7
                                                        </span>
                                                    </>
                                                )}

                                                {/* Today's Value Marker (Circle) */}
                                                {posToday && (
                                                    <>
                                                        <div
                                                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/80 shadow-md ring-2 ring-indigo-400/60 transform -translate-x-1/2 z-10"
                                                            style={{ left: `${posToday}%` }}
                                                        />
                                                        <span
                                                            className="absolute -bottom-5 -translate-x-1/2 text-xs font-bold text-indigo-300/70"
                                                            style={{ left: `${posToday}%` }}
                                                        >
                                                            Hoy
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-3xl border border-white/10 shadow-2xl space-y-4">
                                        <p className="text-sm font-black text-indigo-300 uppercase tracking-wider text-center border-b border-white/10 pb-4">
                                            📊 Bandas de Normalidad
                                        </p>

                                        {/* RHR Band (First) - Using MA7 + Today */}
                                        {bands.rhr_mean && renderBand(
                                            'FC Reposo',
                                            rhr_ma7,
                                            today?.restingHR,
                                            bands.rhr_mean,
                                            bands.rhr_lower,
                                            bands.rhr_upper,
                                            'bpm',
                                            false // alarm if upper (> limit is worse)
                                        )}

                                        {/* Separator */}
                                        <div className="h-px bg-white/10 w-full" />

                                        {/* HRV Band (Second) - Using MA7 + Today */}
                                        {bands.hrv_mean && renderBand(
                                            'VFC (HRV)',
                                            hrv_ma7,
                                            today?.hrv,
                                            bands.hrv_mean,
                                            bands.hrv_lower,
                                            bands.hrv_upper,
                                            'ms',
                                            true // alarm if lower (< limit is worse)
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Calendar at BOTTOM - 65% scale */}
                            <div className="scale-[0.65] origin-top -mb-16">
                                {renderCalendar(intervalsData.map(d => d.id), (d) => setSelectedDate(d), 'emerald')}
                            </div>
                        </>
                    ) : (
                        <div className="animate-slide-up">
                            <button onClick={() => setSelectedDate(null)} className="mb-4 flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-3 py-2 rounded-xl">
                                <Icons.ArrowLeft size={14} /> Volver al calendario
                            </button>
                            {(() => {
                                const data = intervalsData.find(d => d.id === selectedDate);
                                if (!data) return null;
                                return (
                                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
                                        <p className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">{data.id}</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] opacity-70">RHR</p>
                                                <p className="text-xl font-bold">{data.restingHR || '-'} <small>bpm</small></p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] opacity-70">HRV</p>
                                                <p className="text-xl font-bold">{data.hrv || '-'} <small>ms</small></p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] opacity-70">Sueño</p>
                                                <p className="text-xl font-bold">{data.sleepScore || '-'}</p>
                                            </div>
                                        </div>
                                        {data.comments && (
                                            <div className="mt-4 p-3 bg-white/10 rounded-xl text-sm italic">
                                                {data.comments}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HistoryView;
