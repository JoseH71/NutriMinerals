import React from 'react';
import * as Icons from 'lucide-react';

const mfiOptions = [
    { val: 0, icon: '💪', label: 'Motivado' },
    { val: 1, icon: '😐', label: 'Neutro' },
    { val: 2, icon: '😩', label: 'Saturado' },
    { val: 3, icon: '🧠', label: 'Bloqueado' }
];

const CoachView = ({ logs = [], data }) => {
    const {
        loading, error, todayData, results, mfi, setMfi, activityData,
        copyDayReport, copied
    } = data;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <Icons.Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
                <p className="text-lg font-bold">Conectando con Intervals.icu...</p>
                <p className="text-sm text-secondary">Cargando datos automáticamente</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20 animate-fade-in px-4">
                <Icons.AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <p className="text-lg font-bold text-rose-500">Error de conexión</p>
                <p className="text-sm text-secondary mt-2 break-words">{error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold active:scale-95">
                    Reintentar
                </button>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="text-center py-20 animate-fade-in bg-card rounded-3xl border border-theme mx-2">
                <p className="text-4xl mb-3">😴</p>
                <p className="font-bold text-secondary">Sin datos de hoy</p>
                <p className="text-xs text-secondary mt-1">Sincroniza tu HRV/RHR en Intervals.icu</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-2xl font-black text-primary tracking-tighter">Coach IA <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase ml-2">Auto</span></h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={copyDayReport}
                        disabled={!results}
                        className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-card border border-theme text-secondary hover:text-indigo-600'} ${!results ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Copiar informe para entrenador"
                    >
                        {copied ? <Icons.Check size={20} /> : <Icons.Copy size={20} />}
                    </button>
                    <span className="text-[10px] text-secondary font-bold">📡 Intervals.icu</span>
                </div>
            </div>

            {/* Today's Metrics Display */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl shadow-xl text-white mx-2">
                <p className="text-[10px] text-indigo-300 uppercase font-black tracking-widest mb-4 text-center">📊 Datos de hoy ({todayData?.id || 'N/A'})</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                        <p className="text-[10px] text-indigo-200 uppercase font-bold">RHR</p>
                        <p className="text-2xl font-black">{Math.round(results?.rhr || 0)}<span className="text-[10px] ml-0.5">bpm</span></p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-indigo-200 uppercase font-bold">HRV</p>
                        <p className="text-2xl font-black">{Math.round(results?.hrv || 0)}<span className="text-[10px] ml-0.5">ms</span></p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-indigo-200 uppercase font-bold">Sueño</p>
                        <p className="text-2xl font-black">{Math.round(results?.sleep || 0)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
                    <div className="text-center">
                        <p className="text-[10px] text-indigo-200 uppercase font-bold">CTL</p>
                        <p className="text-lg font-bold text-indigo-300">{Math.round(results?.ctl || 0)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-indigo-200 uppercase font-bold">ATL</p>
                        <p className="text-lg font-bold text-indigo-300">{Math.round(results?.atl || 0)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-indigo-200 uppercase font-bold">TSB</p>
                        <p className={`text-lg font-bold ${results?.tsb >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{results?.tsb?.toFixed(0) || '-'}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                    <div className="text-center">
                        <p className="text-[10px] text-purple-300 uppercase font-bold">🏋️ TSS (ayer)</p>
                        <p className="text-lg font-bold text-purple-300">{activityData.tss}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] text-cyan-300 uppercase font-bold">🔥 IF (ayer)</p>
                        <p className="text-lg font-bold text-cyan-300">{(activityData.intensity).toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* MFI Selector */}
            <div className="space-y-2 px-2">
                <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-2">Fatiga Mental (MFI)</label>
                <div className="grid grid-cols-4 gap-2">
                    {mfiOptions.map(opt => (
                        <button
                            key={opt.val}
                            onClick={() => setMfi(opt.val)}
                            className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all active:scale-95 ${mfi === opt.val ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-card border-theme text-secondary hover:bg-card-alt'}`}
                        >
                            <span className="text-xl">{opt.icon}</span>
                            <span className="text-[9px] font-bold uppercase">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Results */}
            {results && (
                <div className="space-y-4 pt-4 animate-fade-in px-2">
                    <div className={`bg-card p-6 rounded-3xl border-2 ${results.verdict === 'ALARMA' ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/10' : results.verdict === 'ÓPTIMO' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'} text-center shadow-lg`}>
                        <h1 className={`text-4xl font-black ${results.color} mb-2 tracking-tight`}>{results.emoji} {results.verdict}</h1>
                        <p className="font-bold text-gray-900 dark:text-gray-100 leading-tight">{results.recommendation}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-card p-4 rounded-2xl border border-theme text-center relative overflow-hidden">
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-4">Pilar 1: Agudo (R)</p>
                            <div className="relative h-24 flex items-center justify-center">
                                <svg viewBox="0 0 36 36" className="w-24 h-24 transform -rotate-90">
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-800" strokeWidth="3" />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={results.readiness >= 70 ? '#10b981' : results.readiness >= 45 ? '#f59e0b' : '#e11d48'} strokeWidth="3" strokeDasharray={`${results.readiness}, 100`} strokeLinecap="round" className="transition-all duration-1000" />
                                </svg>
                                <span className="absolute text-3xl font-black">{Math.round(results.readiness)}</span>
                            </div>
                        </div>
                        <div className="bg-card p-4 rounded-2xl border border-theme text-center">
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-4">Pilar 2: Tendencia (IER)</p>
                            <div className="relative h-24 flex items-center justify-center">
                                <svg viewBox="0 0 36 36" className="w-24 h-24 transform -rotate-90">
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-800" strokeWidth="3" />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={results.ier >= 70 ? '#10b981' : results.ier >= 50 ? '#f59e0b' : '#e11d48'} strokeWidth="3" strokeDasharray={`${results.ier}, 100`} strokeLinecap="round" className="transition-all duration-1000" />
                                </svg>
                                <span className="absolute text-2xl font-black">{results.ier.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Pilar 3: Estabilidad - Bandas de Normalidad */}
                    <div className="bg-card p-5 rounded-3xl border border-theme shadow-sm">
                        <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-4 text-center">Pilar 3: Estabilidad (Bandas)</p>

                        {/* HRV Band */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-black text-primary uppercase">HRV <span className="text-[9px] text-secondary font-normal">(MA7)</span></span>
                                <span className={`text-sm font-black ${results.hrvMA7 && results.hrvMA7 < results.hrvLower ? 'text-rose-500' : results.hrvMA7 && results.hrvMA7 > results.hrvUpper ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {results.hrvMA7 ? `${results.hrvMA7.toFixed(1)} ms` : 'N/A'}
                                </span>
                            </div>
                            {results.hrvLower && results.hrvUpper ? (() => {
                                const rangeMin = Math.min(results.hrvLower * 0.85, results.hrvMA7 || results.hrvLower);
                                const rangeMax = Math.max(results.hrvUpper * 1.15, results.hrvMA7 || results.hrvUpper);
                                const totalRange = rangeMax - rangeMin;
                                const bandStart = ((results.hrvLower - rangeMin) / totalRange) * 100;
                                const bandWidth = ((results.hrvUpper - results.hrvLower) / totalRange) * 100;
                                const markerPos = results.hrvMA7 ? ((results.hrvMA7 - rangeMin) / totalRange) * 100 : 50;
                                const isOutside = results.hrvMA7 && (results.hrvMA7 < results.hrvLower || results.hrvMA7 > results.hrvUpper);
                                return (
                                    <div className="relative h-6 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                        <div className="absolute inset-y-0 left-0 bg-rose-500/10" style={{ width: `${bandStart}%` }} />
                                        <div className="absolute inset-y-0 right-0 bg-amber-500/10" style={{ width: `${100 - bandStart - bandWidth}%` }} />
                                        <div className="absolute inset-y-0 bg-emerald-500/30" style={{ left: `${bandStart}%`, width: `${bandWidth}%` }} />
                                        <div
                                            className={`absolute top-0 bottom-0 w-1.5 -ml-0.75 rounded-full shadow-lg transition-all duration-700 ${isOutside ? 'bg-rose-500 ring-4 ring-rose-500/20' : 'bg-emerald-600 ring-4 ring-emerald-500/20'}`}
                                            style={{ left: `${Math.max(2, Math.min(98, markerPos))}%` }}
                                        />
                                    </div>
                                );
                            })() : <p className="text-xs text-secondary text-center py-2 italic">Datos insuficientes</p>}
                            <div className="flex justify-between mt-1.5 text-[10px] font-bold text-secondary">
                                <span className="flex items-center gap-1">⬇️ {results.hrvLower?.toFixed(0) || '-'}</span>
                                <span className="flex items-center gap-1">⬆️ {results.hrvUpper?.toFixed(1) || '-'}</span>
                            </div>
                        </div>

                        {/* RHR Band */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-black text-primary uppercase">RHR <span className="text-[9px] text-secondary font-normal">(MA7)</span></span>
                                <span className={`text-sm font-black ${results.rhrMA7 && results.rhrMA7 > results.rhrUpper ? 'text-rose-500' : results.rhrMA7 && results.rhrMA7 < results.rhrLower ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {results.rhrMA7 ? `${results.rhrMA7.toFixed(0)} bpm` : 'N/A'}
                                </span>
                            </div>
                            {results.rhrLower && results.rhrUpper ? (() => {
                                const rangeMin = Math.min(results.rhrLower * 0.9, results.rhrMA7 || results.rhrLower);
                                const rangeMax = Math.max(results.rhrUpper * 1.1, results.rhrMA7 || results.rhrUpper);
                                const totalRange = rangeMax - rangeMin;
                                const bandStart = ((results.rhrLower - rangeMin) / totalRange) * 100;
                                const bandWidth = ((results.rhrUpper - results.rhrLower) / totalRange) * 100;
                                const markerPos = results.rhrMA7 ? ((results.rhrMA7 - rangeMin) / totalRange) * 100 : 50;
                                const isOutside = results.rhrMA7 && (results.rhrMA7 < results.rhrLower || results.rhrMA7 > results.rhrUpper);
                                return (
                                    <div className="relative h-6 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                        <div className="absolute inset-y-0 left-0 bg-amber-500/10" style={{ width: `${bandStart}%` }} />
                                        <div className="absolute inset-y-0 right-0 bg-rose-500/10" style={{ width: `${100 - bandStart - bandWidth}%` }} />
                                        <div className="absolute inset-y-0 bg-emerald-500/30" style={{ left: `${bandStart}%`, width: `${bandWidth}%` }} />
                                        <div
                                            className={`absolute top-0 bottom-0 w-1.5 -ml-0.75 rounded-full shadow-lg transition-all duration-700 ${isOutside ? 'bg-rose-500 ring-4 ring-rose-500/20' : 'bg-emerald-600 ring-4 ring-emerald-500/20'}`}
                                            style={{ left: `${Math.max(2, Math.min(98, markerPos))}%` }}
                                        />
                                    </div>
                                );
                            })() : <p className="text-xs text-secondary text-center py-2 italic">Datos insuficientes</p>}
                            <div className="flex justify-between mt-1.5 text-[10px] font-bold text-secondary">
                                <span className="flex items-center gap-1">⬇️ {results.rhrLower?.toFixed(0) || '-'}</span>
                                <span className="flex items-center gap-1">⬆️ {results.rhrUpper?.toFixed(0) || '-'}</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex justify-center gap-4 mt-6 pt-3 border-t border-theme text-[9px] font-black uppercase tracking-widest text-secondary">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Estable</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> Atención</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> Alarma</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoachView;
