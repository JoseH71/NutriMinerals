import React, { useState, useMemo, useEffect } from 'react';
import * as Icons from 'lucide-react';
import FoodDetail from '../Common/FoodDetail';
import { getHealthThresholds, getZoneStatus, getZoneEmoji, getDayStatus, getDayStatusType, CRITICAL_NUTRIENTS, CONTEXT_NUTRIENTS, getZoneEmojiForDay } from '../../utils/healthThresholds';

const DiaryView = ({ logs, onDelete, tssToday = 0, onSaveFood, myFoods, manualDayType: propManualDayType, onSaveManualDayType }) => {
    const [expanded, setExpanded] = useState(null);
    const [showPlatos, setShowPlatos] = useState(false);
    const [expandedNutrient, setExpandedNutrient] = useState(null);
    const [displayMode, setDisplayMode] = useState({}); // true = %, false = value

    // Use prop manualDayType (synced from Firestore) with localStorage fallback
    const [localManualDayType, setLocalManualDayType] = useState(() => {
        try {
            const saved = localStorage.getItem('manualDayType');
            return saved !== null ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    // Sync prop to local state and Firestore
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

    const todayISO = new Date().toISOString().slice(0, 10);
    const today = logs.filter(l => (l.dateISO || l.dateStr) === todayISO || l.dateStr === new Date().toLocaleDateString());

    // Dynamic thresholds based on training (with manual override)
    const isTrainingDay = manualDayType !== null ? manualDayType : tssToday >= 40;
    const thresholds = useMemo(() => getHealthThresholds(isTrainingDay ? 100 : 0), [isTrainingDay]);

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
                                <span className={`font-mono font-bold text-${color}-600`}>
                                    {unit === 'mg' ? Math.round(f.value) : f.value.toFixed(1)}{unit}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in px-2 pb-20">
            <div className="px-1 flex justify-between items-center mb-2">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Diario de Hoy</h2>
                <div className="flex gap-1">
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full text-[10px] font-black border border-indigo-200 dark:border-indigo-800 uppercase tracking-widest">{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                </div>
            </div>

            {/* MACROS + FIBER - Expandable Progress Bars */}
            <div className="bg-card p-4 rounded-3xl border border-theme mb-4">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-black text-secondary uppercase tracking-widest">Macros</p>
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
                                                <span className="font-mono font-bold text-gray-600 dark:text-gray-400">
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
                                                <span className="font-mono font-bold text-gray-600 dark:text-gray-400">
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
        </div>
    );
};

export default DiaryView;
