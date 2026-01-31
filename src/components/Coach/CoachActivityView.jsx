import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { ATHLETE_ID, INTERVALS_API_KEY } from '../../config/firebase';
import { fetchIntervalsActivities } from '../../utils/intervalsData';

const CoachActivityView = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [copied, setCopied] = useState(false);
    const [dateRange, setDateRange] = useState(7);

    // Fetch activities
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                setLoading(true);
                const today = new Date().toISOString().split('T')[0];
                const oldestDate = new Date();
                oldestDate.setDate(oldestDate.getDate() - dateRange);
                const oldest = oldestDate.toISOString().split('T')[0];

                const data = await fetchIntervalsActivities(oldest, today);
                if (data) {
                    const filtered = data.filter(a => ['Ride', 'VirtualRide', 'Run', 'WeightTraining', 'Swim', 'Walk'].includes(a.type));
                    const sorted = filtered.sort((a, b) => new Date(b.start_date_local) - new Date(a.start_date_local));
                    setActivities(sorted);
                    if (sorted.length > 0) setSelectedActivity(sorted[0]);
                }
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
    }, [dateRange]);

    // Format duration
    const formatDuration = (secs) => {
        if (!secs) return '-';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // Analyze performance patterns
    const analyzePerformance = (a) => {
        if (!a) return null;
        const vi = a.icu_variability_index || 0;
        const ifVal = (a.icu_intensity || 0) / 100;
        const decoupling = a.decoupling || a.icu_aerobic_decoupling || 0;
        const avgPower = a.average_watts || 0;
        const np = a.icu_weighted_avg_watts || 0;

        // Pacing analysis
        let pacing = { text: 'Variable', color: 'text-amber-500' };
        if (vi > 0 && vi <= 1.05) pacing = { text: 'Muy Estable', color: 'text-emerald-500' };
        else if (vi <= 1.15) pacing = { text: 'Estable', color: 'text-emerald-400' };
        else if (vi <= 1.25) pacing = { text: 'Moderado', color: 'text-amber-400' };
        else if (vi > 1.35) pacing = { text: 'Muy Variable', color: 'text-rose-500' };

        // Intensity zone
        let zone = { text: 'Aeróbico', color: 'text-emerald-500' };
        if (ifVal >= 1.05) zone = { text: 'Neuromuscular', color: 'text-rose-600' };
        else if (ifVal >= 0.95) zone = { text: 'VO2max', color: 'text-rose-500' };
        else if (ifVal >= 0.85) zone = { text: 'Umbral', color: 'text-amber-500' };
        else if (ifVal >= 0.70) zone = { text: 'Tempo', color: 'text-amber-400' };

        // Coupling analysis
        let coupling = { text: 'Excelente', color: 'text-emerald-500' };
        if (decoupling > 12) coupling = { text: 'Deterioro Alto', color: 'text-rose-500' };
        else if (decoupling > 8) coupling = { text: 'Deterioro Mod.', color: 'text-amber-500' };
        else if (decoupling > 5) coupling = { text: 'Aceptable', color: 'text-amber-400' };
        else if (decoupling > 2) coupling = { text: 'Bueno', color: 'text-emerald-400' };

        // Efficiency
        let efficiency = null;
        if (avgPower > 0 && np > 0) {
            const ratio = avgPower / np;
            efficiency = { ratio, text: ratio >= 0.95 ? 'Muy Eficiente' : ratio >= 0.90 ? 'Eficiente' : ratio >= 0.85 ? 'Moderado' : 'Poco Eficiente' };
        }

        // Recommendations
        const recs = [];
        if (vi > 1.3) recs.push('🎯 Trabajar control de ritmo');
        if (decoupling > 8) recs.push('💪 Mejorar resistencia aeróbica');
        if (ifVal > 1.0 && vi > 1.2) recs.push('📋 Revisar estrategia de carrera');
        if (recs.length === 0) recs.push('✅ Buena ejecución');

        return { vi, ifVal, decoupling, pacing, zone, coupling, efficiency, recommendations: recs };
    };

    const copyReport = () => {
        if (!selectedActivity) return;
        const a = selectedActivity;
        const perf = analyzePerformance(a);

        let text = `📊 ANÁLISIS COMPLETO DE ACTIVIDAD\n${'═'.repeat(30)}\n\n`;
        text += `🏷️ ${a.name || 'Sin nombre'}\n`;
        text += `📅 Fecha: ${new Date(a.start_date_local).toLocaleDateString('es-ES')} ${a.start_date_local?.slice(11, 16) || ''}\n`;
        text += `🏃 Tipo: ${a.type}\n`;
        text += `⏱️ Duración: ${formatDuration(a.moving_time)}\n`;
        text += `📏 Distancia: ${((a.distance || 0) / 1000).toFixed(2)} km\n`;
        if (a.total_elevation_gain) text += `⛰️ Desnivel: +${Math.round(a.total_elevation_gain)}m\n`;

        text += `\n--- CARGA ---\n`;
        text += `• TSS: ${Math.round(a.icu_training_load || 0)}\n`;
        text += `• IF: ${perf?.ifVal?.toFixed(2) || '-'}\n`;
        text += `• NP: ${a.icu_weighted_avg_watts || '-'}W\n`;
        if (a.average_heartrate) text += `• HR Avg: ${Math.round(a.average_heartrate)} bpm\n`;

        text += `\n--- ANÁLISIS ---\n`;
        text += `• Patrón: ${perf?.pacing?.text || '-'}\n`;
        text += `• Intensidad: ${perf?.zone?.text || '-'}\n`;
        text += `• Coupling: ${perf?.coupling?.text || '-'}\n`;

        text += `\n--- RECOMENDACIONES ---\n`;
        perf?.recommendations?.forEach(r => text += `${r}\n`);

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    const a = selectedActivity;
    const perf = analyzePerformance(a);

    return (
        <div className="space-y-4 animate-fade-in pb-12">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black text-primary tracking-tighter uppercase">Análisis Actividad</h2>
                <div className="flex gap-2 items-center">
                    <button onClick={copyReport} className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg' : 'bg-card border border-theme text-secondary hover:text-indigo-600'}`} title="Copiar informe">
                        {copied ? <Icons.Check size={20} /> : <Icons.Copy size={20} />}
                    </button>
                    <select value={dateRange} onChange={(e) => setDateRange(Number(e.target.value))} className="px-2 py-1.5 rounded-xl text-[10px] font-black bg-card border border-theme text-primary shadow-sm outline-none">
                        <option value={7}>7D</option>
                        <option value={14}>14D</option>
                        <option value={30}>30D</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-theme mx-2">
                    <Icons.Loader2 className="animate-spin mx-auto text-indigo-600 mb-3" size={32} />
                    <p className="text-xs font-black text-secondary uppercase tracking-widest">Cargando actividades...</p>
                </div>
            ) : error ? (
                <div className="text-center py-20 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-500/30 mx-2">
                    <Icons.AlertTriangle className="mx-auto text-rose-500 mb-2" size={32} />
                    <p className="text-sm font-bold text-rose-600">{error}</p>
                </div>
            ) : activities.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-3xl border border-theme mx-2 shadow-sm">
                    <p className="text-4xl mb-3">🚴</p>
                    <p className="font-bold text-secondary uppercase tracking-widest text-xs">Sin actividades</p>
                    <p className="text-[10px] text-secondary mt-1">No hay entrenos registrados en los últimos {dateRange} días</p>
                </div>
            ) : (
                <>
                    {/* Activity selector */}
                    <div className="flex gap-2 overflow-x-auto pb-4 px-2 scrollbar-hide">
                        {activities.slice(0, 15).map((act, i) => (
                            <button key={i} onClick={() => setSelectedActivity(act)}
                                className={`flex-shrink-0 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm ${selectedActivity?.id === act.id ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-card border border-theme text-secondary hover:bg-card-alt'}`}>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-base">{act.type === 'Ride' || act.type === 'VirtualRide' ? '🚴' : act.type === 'Run' ? '🏃' : act.type === 'Swim' ? '🏊' : act.type === 'WeightTraining' ? '🏋️' : '👟'}</span>
                                    <span>{new Date(act.start_date_local).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {a && (
                        <div className="space-y-4 px-2">
                            {/* Activity Header */}
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-3xl text-white shadow-xl">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{a.type}</p>
                                <p className="font-black text-xl mb-3 leading-tight">{a.name || 'Actividad sin nombre'}</p>
                                <div className="flex gap-4 text-[10px] font-bold uppercase overflow-hidden">
                                    <span className="flex items-center gap-1.5 whitespace-nowrap"><Icons.Calendar size={12} /> {new Date(a.start_date_local).toLocaleDateString('es-ES')}</span>
                                    <span className="flex items-center gap-1.5 whitespace-nowrap"><Icons.Clock size={12} /> {formatDuration(a.moving_time)}</span>
                                    {a.distance > 0 && <span className="flex items-center gap-1.5 whitespace-nowrap"><Icons.MapPin size={12} /> {((a.distance || 0) / 1000).toFixed(1)}km</span>}
                                </div>
                            </div>

                            {/* Notes if available */}
                            {(a.description || a.notes) && (
                                <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                                    <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1.5">📝 Notas del Atleta</p>
                                    <p className="text-xs text-amber-800 dark:text-amber-200 whitespace-pre-wrap font-medium leading-relaxed italic">
                                        "{a.description || a.notes}"
                                    </p>
                                </div>
                            )}

                            {/* Key metrics grid */}
                            <div className="grid grid-cols-4 gap-2">
                                <div className="bg-card p-3 rounded-2xl border border-theme text-center shadow-sm">
                                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">TSS</p>
                                    <p className="text-lg font-black text-purple-600 dark:text-purple-400">{Math.round(a.icu_training_load || 0)}</p>
                                </div>
                                <div className="bg-card p-3 rounded-2xl border border-theme text-center shadow-sm">
                                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">IF</p>
                                    <p className="text-lg font-black text-amber-500">{perf?.ifVal?.toFixed(2) || '-'}</p>
                                </div>
                                <div className="bg-card p-3 rounded-2xl border border-theme text-center shadow-sm">
                                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">NP</p>
                                    <p className="text-base font-black text-indigo-500">{a.icu_weighted_avg_watts || '-'}W</p>
                                </div>
                                <div className="bg-card p-3 rounded-2xl border border-theme text-center shadow-sm">
                                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-1">HR Avg</p>
                                    <p className="text-lg font-black text-rose-500">{Math.round(a.average_heartrate) || '-'}</p>
                                </div>
                            </div>

                            {/* Advanced analysis cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${perf.pacing.color.replace('text-', 'bg-')}`}></div>
                                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-2">🔭 Patrón de Ritmo</p>
                                    <div className="flex justify-between items-baseline">
                                        <p className={`text-sm font-black ${perf.pacing.color}`}>{perf.pacing.text}</p>
                                        <p className="text-[10px] font-mono font-bold text-secondary">VI: {perf.vi.toFixed(2)}</p>
                                    </div>
                                </div>
                                <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${perf.zone.color.replace('text-', 'bg-')}`}></div>
                                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-2">🔥 Zona Principal</p>
                                    <p className={`text-sm font-black ${perf.zone.color}`}>{perf.zone.text}</p>
                                </div>
                                <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${perf.coupling.color.replace('text-', 'bg-')}`}></div>
                                    <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-2">🧬 Acoplamiento Pw:HR</p>
                                    <div className="flex justify-between items-baseline">
                                        <p className={`text-sm font-black ${perf.coupling.color}`}>{perf.coupling.text}</p>
                                        <p className="text-[10px] font-mono font-bold text-secondary">{perf.decoupling.toFixed(1)}%</p>
                                    </div>
                                </div>
                                {perf.efficiency && (
                                    <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500"></div>
                                        <p className="text-[8px] font-black text-secondary uppercase tracking-widest mb-2">⚙️ Eficiencia Pedaleo</p>
                                        <div className="flex justify-between items-baseline">
                                            <p className="text-sm font-black text-primary">{perf.efficiency.text}</p>
                                            <p className="text-[10px] font-mono font-bold text-secondary">{perf.efficiency.ratio.toFixed(2)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Zones distribution - simplified for mobile */}
                            {(a.icu_zone_times || a.icu_hr_zone_times) && (
                                <div className="bg-card p-4 rounded-3xl border border-theme shadow-sm">
                                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-4">📊 Distribución de Zonas</p>
                                    <div className="space-y-4">
                                        {a.icu_zone_times && a.icu_zone_times.length > 0 && (
                                            <div>
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">⚡ Potencia</p>
                                                </div>
                                                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                    {a.icu_zone_times.map((secs, i) => {
                                                        const time = typeof secs === 'object' ? secs.secs : secs;
                                                        if (!time || time < 10) return null;
                                                        const pct = (time / a.moving_time) * 100;
                                                        const colors = ['#94a3b8', '#10b981', '#22c55e', '#facc15', '#f59e0b', '#f43f5e', '#e11d48'];
                                                        return (
                                                            <div key={i} className="h-full" style={{ width: `${pct}%`, backgroundColor: colors[i] || '#8b5cf6' }} title={`Z${i + 1}: ${Math.round(pct)}%`}></div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {a.icu_hr_zone_times && a.icu_hr_zone_times.length > 0 && (
                                            <div>
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">❤️ FC</p>
                                                </div>
                                                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                    {a.icu_hr_zone_times.map((secs, i) => {
                                                        if (!secs || secs < 10) return null;
                                                        const pct = (secs / a.moving_time) * 100;
                                                        const colors = ['#94a3b8', '#10b981', '#22c55e', '#facc15', '#f59e0b', '#f43f5e'];
                                                        return (
                                                            <div key={i} className="h-full" style={{ width: `${pct}%`, backgroundColor: colors[i] || '#8b5cf6' }} title={`Z${i + 1}: ${Math.round(pct)}%`}></div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Recommendations */}
                            {perf && (
                                <div className="bg-indigo-600 p-5 rounded-3xl text-white shadow-lg ring-4 ring-indigo-500/10">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2">💡 Recomendaciones Pro</p>
                                    <div className="space-y-2">
                                        {perf.recommendations.map((r, i) => (
                                            <p key={i} className="text-sm font-bold flex items-start gap-2">
                                                <span className="opacity-70 mt-0.5">•</span>
                                                {r}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CoachActivityView;
