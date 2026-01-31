import React, { useState, useMemo, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { ATHLETE_ID, INTERVALS_API_KEY } from '../../config/firebase';
import { fetchIntervalsActivities } from '../../utils/intervalsData';

const METRICS_CONFIG = {
    // Wellness / Performance
    rhr: { label: 'RHR (Pulso)', icon: <Icons.HeartPulse size={14} />, color: 'text-rose-500', unit: 'bpm', category: 'wellness' },
    hrv: { label: 'HRV (VFC)', icon: <Icons.Activity size={14} />, color: 'text-emerald-500', unit: 'ms', category: 'wellness' },
    sleepScore: { label: 'Sueño', icon: <Icons.Moon size={14} />, color: 'text-indigo-500', unit: '%', category: 'wellness' },
    tss: { label: 'TSS (Carga)', icon: <Icons.Zap size={14} />, color: 'text-amber-500', unit: '', category: 'wellness' },
    tsb: { label: 'TSB (Forma)', icon: <Icons.TrendingUp size={14} />, color: 'text-cyan-500', unit: '', category: 'wellness' },
    activityType: { label: 'Tipo', icon: <Icons.Bike size={14} />, color: 'text-slate-500', unit: '', category: 'wellness' },
    activityName: { label: 'Descripción', icon: <Icons.FileText size={14} />, color: 'text-violet-500', unit: '', category: 'wellness' },
    taurinaNoche: { label: 'Taurina Noche', icon: <Icons.Pill size={14} />, color: 'text-pink-500', unit: '', category: 'wellness' },

    // Nutrition - Macros
    calories: { label: 'Calorías', icon: <Icons.Flame size={14} />, color: 'text-orange-500', unit: 'kcal', category: 'nutrition' },
    protein: { label: 'Proteína', icon: <Icons.Beef size={14} />, color: 'text-red-500', unit: 'g', category: 'nutrition' },
    carbs: { label: 'Carbos', icon: <Icons.Wheat size={14} />, color: 'text-yellow-500', unit: 'g', category: 'nutrition' },
    fat: { label: 'Grasas', icon: <Icons.Droplet size={14} />, color: 'text-yellow-600', unit: 'g', category: 'nutrition' },
    fiber: { label: 'Fibra', icon: <Icons.Sprout size={14} />, color: 'text-green-600', unit: 'g', category: 'nutrition' },

    // Nutrition - Micros
    na: { label: 'Sodio (Na)', icon: <Icons.Beaker size={14} />, color: 'text-slate-400', unit: 'mg', category: 'micros' },
    k: { label: 'Potasio (K)', icon: <Icons.Banana size={14} />, color: 'text-purple-400', unit: 'mg', category: 'micros' },
    ca: { label: 'Calcio (Ca)', icon: <Icons.Milk size={14} />, color: 'text-blue-300', unit: 'mg', category: 'micros' },
    mg: { label: 'Magnesio', icon: <Icons.Gem size={14} />, color: 'text-emerald-300', unit: 'mg', category: 'micros' },
};

const HistoryAnalysisView = ({ logs, intervalsData, onClose }) => {
    // Default range: last 30 days
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

    const [showFilters, setShowFilters] = useState(false);
    const [selectedMetrics, setSelectedMetrics] = useState([
        'calories', 'protein', 'hrv', 'sleepScore', 'mg'
    ]);
    const [copied, setCopied] = useState(false);
    const [activitiesData, setActivitiesData] = useState([]);

    // Fetch activities for TSS and type
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const data = await fetchIntervalsActivities(dateFrom, dateTo);
                if (data) {
                    setActivitiesData(data);
                }
            } catch (e) {
                console.error('Error fetching activities:', e);
            }
        };
        fetchActivities();
    }, [dateFrom, dateTo]);

    // Data Fusion Logic
    const dailyData = useMemo(() => {
        const data = [];
        const start = new Date(dateFrom);
        const end = new Date(dateTo);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];

            // 1. Get Nutrition Data
            const dayLogs = logs.filter(l => {
                const logDate = l.dateISO || (l.dateStr ? l.dateStr.split('/').reverse().join('-') : '');
                return logDate === dateStr;
            });

            const nutrition = dayLogs.reduce((acc, l) => ({
                calories: acc.calories + (Number(l.calories) || 0),
                protein: acc.protein + (Number(l.protein) || 0),
                carbs: acc.carbs + (Number(l.carbs) || 0),
                fat: acc.fat + (Number(l.fat) || 0),
                fiber: acc.fiber + (Number(l.fiber) || 0),
                na: acc.na + (Number(l.na) || 0),
                k: acc.k + (Number(l.k) || 0),
                ca: acc.ca + (Number(l.ca) || 0),
                mg: acc.mg + (Number(l.mg) || 0),
            }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 });

            // Check for Taurina at night
            const taurinaAtNight = dayLogs.some(l =>
                l.timeBlock === 'noche' &&
                l.name?.toLowerCase().includes('taurina')
            );

            // 2. Get Intervals Data
            const wellness = intervalsData.find(w => w.id === dateStr) || {};
            // Calculate TSB manually if needed
            const tsb = (wellness.ctl !== undefined && wellness.atl !== undefined) ? (wellness.ctl - wellness.atl) : null;

            // 3. Get Activities for this day
            const dayActivities = activitiesData.filter(a => a.start_date_local?.startsWith(dateStr));
            const dailyTSS = dayActivities.reduce((sum, a) => sum + (a.icu_training_load || 0), 0);
            const activityTypes = dayActivities.length > 0
                ? [...new Set(dayActivities.map(a => a.type || 'Actividad'))].join(', ')
                : '';

            // Get activity names/descriptions (e.g., "Gym Upper", "Z2 Recovery", etc.)
            const activityNames = dayActivities.length > 0
                ? dayActivities.map(a => a.name || a.description || a.type || 'Actividad').join(', ')
                : '';

            // Manual date formatting to avoid locale issues
            const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

            data.push({
                date: dateStr,
                displayDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
                dayName: dayNames[d.getDay()],
                ...nutrition,
                rhr: wellness.restingHR || null,
                hrv: wellness.hrv || null,
                sleepScore: wellness.sleepScore || null,
                tss: dailyTSS || 0,
                tsb: tsb,
                activityType: activityTypes,
                activityName: activityNames,
                taurinaNoche: taurinaAtNight ? 'Sí' : 'No',
            });
        }
        return data.reverse(); // Newest first
    }, [dateFrom, dateTo, logs, intervalsData, activitiesData]);

    // Stats calculation
    const averages = useMemo(() => {
        const avgs = {};
        selectedMetrics.forEach(key => {
            const validValues = dailyData.map(d => d[key]).filter(v => v !== null && !isNaN(v) && v !== 0);
            if (validValues.length > 0) {
                avgs[key] = validValues.reduce((a, b) => a + b, 0) / validValues.length;
            } else {
                avgs[key] = 0;
            }
        });
        return avgs;
    }, [dailyData, selectedMetrics]);

    const toggleMetric = (key) => {
        if (selectedMetrics.includes(key)) {
            setSelectedMetrics(selectedMetrics.filter(k => k !== key));
        } else {
            setSelectedMetrics([...selectedMetrics, key]);
        }
    };

    const copyAnalysis = () => {
        let text = `📊 ANÁLISIS PRO - ${dateFrom} a ${dateTo}\n\n`;

        // Averages
        text += `📈 PROMEDIOS DEL PERIODO:\n`;
        selectedMetrics.forEach(key => {
            const cfg = METRICS_CONFIG[key];
            text += `• ${cfg.label}: ${Math.round(averages[key] || 0)} ${cfg.unit}\n`;
        });
        text += `\n`;

        // Helper for fixed width columns (20 chars) for better alignment
        const pad = (str, len = 20) => str.toString().substring(0, len).padEnd(len, ' ');

        // Table header
        text += `📋 DATOS DIARIOS:\n`;
        text += `${pad('Fecha')}${selectedMetrics.map(k => pad(METRICS_CONFIG[k].label)).join('')}\n`;
        text += `${'─'.repeat(20 + (20 * selectedMetrics.length))}\n`;

        // Table rows
        dailyData.forEach(day => {
            const values = selectedMetrics.map(key => {
                const val = day[key];
                if (val === null || val === undefined || val === '') return pad('-');
                return pad(typeof val === 'number' ? Math.round(val) : val);
            });
            // Clean date display for copy (remove leading non-alphanumeric chars)
            const cleanDate = day.displayDate.replace(/^[^\w\d]+/, '').trim();
            text += `${pad(cleanDate)}${values.join('')}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-theme bg-card/50">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 hover:bg-card-alt rounded-full">
                        <Icons.X size={20} />
                    </button>
                    <h2 className="text-xl font-black uppercase tracking-tighter">Análisis Pro</h2>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={copyAnalysis}
                        className={`p-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-card border border-theme'}`}
                    >
                        {copied ? <Icons.Check size={16} /> : <Icons.Copy size={16} />}
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${showFilters ? 'bg-primary text-white' : 'bg-card border border-theme'}`}
                    >
                        <Icons.SlidersHorizontal size={16} />
                        Métricas ({selectedMetrics.length})
                    </button>
                </div>
            </div>

            {/* Date Range & Summary */}
            <div className="p-4 bg-card-alt border-b border-theme/50 flex flex-col gap-4">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-[9px] font-bold uppercase text-secondary mb-1 block">Desde</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full bg-card border border-theme rounded-lg px-2 py-1 text-xs font-bold"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-[9px] font-bold uppercase text-secondary mb-1 block">Hasta</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full bg-card border border-theme rounded-lg px-2 py-1 text-xs font-bold"
                        />
                    </div>
                </div>

                {/* Averages Cards */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {selectedMetrics.map(key => (
                        <div key={key} className="flex-shrink-0 bg-card border border-theme rounded-xl p-3 min-w-[100px]">
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className={METRICS_CONFIG[key].color}>{METRICS_CONFIG[key].icon}</span>
                                <span className="text-[10px] uppercase font-bold text-secondary">{METRICS_CONFIG[key].label}</span>
                            </div>
                            <p className="text-lg font-black">
                                {Math.round(averages[key] || 0)}
                                <span className="text-[10px] ml-1 font-normal opacity-50">{METRICS_CONFIG[key].unit}</span>
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters Drawer (Overlay) */}
            {showFilters && (
                <div className="p-4 bg-card border-b border-theme animate-in slide-in-from-top-2">
                    <p className="text-xs font-black uppercase tracking-widest text-secondary mb-3">Selecciona Métricas</p>

                    {['wellness', 'nutrition', 'micros'].map(cat => (
                        <div key={cat} className="mb-4 last:mb-0">
                            <p className="text-[9px] font-bold uppercase opacity-50 mb-2">{cat}</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(METRICS_CONFIG).filter(([_, cfg]) => cfg.category === cat).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => toggleMetric(key)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all flex items-center gap-2 ${selectedMetrics.includes(key)
                                            ? `bg-primary/10 border-primary text-primary ring-1 ring-primary`
                                            : 'bg-card-alt border-transparent text-secondary hover:bg-card-alt/80'
                                            }`}
                                    >
                                        <span className={selectedMetrics.includes(key) ? 'text-primary' : config.color}>{config.icon}</span>
                                        {config.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setShowFilters(false)} className="w-full py-2 bg-card-alt hover:bg-card text-xs font-bold rounded-xl mt-2">Cerrar Filtros</button>
                </div>
            )}

            {/* Data Table */}
            <div className="flex-1 overflow-auto p-2 bg-background">
                <div className="bg-card rounded-2xl border border-theme overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-card-alt/50 border-b border-theme/50">
                                    <th className="p-3 text-[10px] font-black uppercase text-secondary sticky left-0 bg-card z-10">Fecha</th>
                                    {selectedMetrics.map(key => (
                                        <th key={key} className="p-3 text-[10px] font-black uppercase text-secondary whitespace-nowrap text-center">
                                            {METRICS_CONFIG[key].label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-theme/20">
                                {dailyData.map(day => (
                                    <tr key={day.date} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3 text-xs font-bold sticky left-0 bg-card/95 backdrop-blur-sm z-10 border-r border-theme/20">
                                            <div className="flex flex-col">
                                                <span>{day.displayDate}</span>
                                                <span className="text-[9px] font-normal opacity-50 uppercase">{day.dayName}</span>
                                            </div>
                                        </td>
                                        {selectedMetrics.map(key => (
                                            <td key={key} className="p-3 text-xs text-center font-mono tabular-nums whitespace-nowrap">
                                                {day[key] !== null && day[key] !== undefined && day[key] !== '' ? (
                                                    typeof day[key] === 'number' ? Math.round(day[key]) : <span className="text-[10px] uppercase font-bold text-secondary">{day[key]}</span>
                                                ) : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoryAnalysisView;
