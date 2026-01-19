import React, { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';

const CoachCorrelationsView = ({ historyData = [] }) => {
    const [copied, setCopied] = useState(false);
    const [weeks, setWeeks] = useState(12);

    // Group data into weekly summaries
    const weeklyData = useMemo(() => {
        if (historyData.length === 0) return [];

        const endDate = new Date();
        const startDate = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

        const summaries = [];
        for (let i = 0; i < weeks; i++) {
            const weekEnd = new Date(endDate.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const weekStart = new Date(weekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);

            const weekData = historyData.filter(d => {
                const date = new Date(d.id);
                return date >= weekStart && date <= weekEnd;
            });

            if (weekData.length === 0) continue;

            const avg = (arr, key) => {
                const valid = arr.filter(d => d[key] != null);
                return valid.length ? valid.reduce((s, d) => s + d[key], 0) / valid.length : null;
            };

            const totalTSS = weekData.reduce((s, d) => s + (d.dailyTSS || 0), 0);

            summaries.push({
                label: `${weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}-${weekEnd.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`,
                tss: totalTSS,
                atl: avg(weekData, 'atl'),
                ctl: avg(weekData, 'ctl'),
                rhr: avg(weekData, 'restingHR'),
                hrv: avg(weekData, 'hrv'),
                sleep: avg(weekData, 'sleepScore')
            });
        }
        return summaries.reverse(); // Oldest first
    }, [historyData, weeks]);

    // Calculate correlation matrix
    const correlationMatrix = useMemo(() => {
        if (weeklyData.length < 3) return null;

        const metrics = ['tss', 'atl', 'ctl', 'rhr', 'hrv', 'sleep'];
        const labels = ['TSS', 'ATL', 'CTL', 'RHR', 'HRV', 'Sueño'];

        // Pearson correlation function
        const pearson = (x, y) => {
            const validPairs = x.map((xi, i) => [xi, y[i]]).filter(([a, b]) => a != null && b != null);
            if (validPairs.length < 3) return null;
            const xs = validPairs.map(p => p[0]);
            const ys = validPairs.map(p => p[1]);
            const n = xs.length;
            const sumX = xs.reduce((a, b) => a + b, 0);
            const sumY = ys.reduce((a, b) => a + b, 0);
            const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
            const sumX2 = xs.reduce((s, x) => s + x * x, 0);
            const sumY2 = ys.reduce((s, y) => s + y * y, 0);
            const num = n * sumXY - sumX * sumY;
            const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
            return den === 0 ? 0 : num / den;
        };

        const matrix = [];
        for (let i = 0; i < metrics.length; i++) {
            const row = [];
            for (let j = 0; j < metrics.length; j++) {
                const xVals = weeklyData.map(w => w[metrics[i]]);
                const yVals = weeklyData.map(w => w[metrics[j]]);
                row.push(pearson(xVals, yVals));
            }
            matrix.push(row);
        }
        return { matrix, labels };
    }, [weeklyData]);

    // Calculate baselines
    const baselines = useMemo(() => {
        if (weeklyData.length < 4) return null;

        const avg = (arr, key) => {
            const valid = arr.filter(w => w[key] != null);
            return valid.length ? valid.reduce((s, w) => s + w[key], 0) / valid.length : null;
        };

        const avgATL = avg(weeklyData, 'atl');
        const lowLoadWeeks = weeklyData.filter(w => w.atl != null && w.atl <= avgATL);

        const recovery = {
            rhr: avg(lowLoadWeeks, 'rhr'),
            hrv: avg(lowLoadWeeks, 'hrv')
        };

        const last4 = weeklyData.slice(-4);
        const chronic = {
            rhr: avg(last4, 'rhr'),
            hrv: avg(last4, 'hrv')
        };

        const last8 = weeklyData.slice(-8);
        const historic = {
            rhr: avg(last8, 'rhr'),
            hrv: avg(last8, 'hrv')
        };

        return { recovery, chronic, historic };
    }, [weeklyData]);

    const getCorrelationColor = (val) => {
        if (val === null) return 'bg-gray-200 dark:bg-gray-700 text-gray-400';
        if (val >= 0.7) return 'bg-emerald-600 text-white';
        if (val >= 0.4) return 'bg-emerald-400 text-emerald-900 dark:bg-emerald-600 dark:text-white';
        if (val >= 0.1) return 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100';
        if (val >= -0.1) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
        if (val >= -0.4) return 'bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-100';
        if (val >= -0.7) return 'bg-rose-400 text-rose-900 dark:bg-rose-600 dark:text-white';
        return 'bg-rose-600 text-white';
    };

    const copyCorrelations = () => {
        if (!correlationMatrix) return;
        let text = `🔬 MATRIZ DE CORRELACIONES (${weeks} semanas)\n\n`;
        text += `Métrica\t\t${correlationMatrix.labels.join('\t')}\n`;
        text += `${'─'.repeat(60)}\n`;
        correlationMatrix.labels.forEach((label, i) => {
            text += `${label}\t\t${correlationMatrix.matrix[i].map(v => v != null ? v.toFixed(2) : '-').join('\t')}\n`;
        });
        if (baselines) {
            text += `\n📈 LÍNEAS BASALES:\n`;
            text += `\n🛌 Recuperación (baja carga):\n• RHR: ${baselines.recovery.rhr?.toFixed(1) || '-'} | HRV: ${baselines.recovery.hrv?.toFixed(1) || '-'}\n`;
            text += `\n🗓️ Crónica (28d):\n• RHR: ${baselines.chronic.rhr?.toFixed(1) || '-'} | HRV: ${baselines.chronic.hrv?.toFixed(1) || '-'}\n`;
        }
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    if (weeklyData.length < 3) {
        return (
            <div className="text-center py-12 bg-card rounded-3xl border border-theme mx-2 shadow-sm">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-bold text-secondary uppercase tracking-widest text-xs">Datos insuficientes</p>
                <p className="text-[10px] text-secondary mt-1">Se necesitan al menos 3 semanas de datos</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in pb-12">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black text-primary tracking-tighter uppercase">Correlaciones</h2>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={copyCorrelations}
                        className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg' : 'bg-card border border-theme text-secondary hover:text-indigo-600'}`}
                    >
                        {copied ? <Icons.Check size={18} /> : <Icons.Copy size={18} />}
                    </button>
                    <select
                        value={weeks}
                        onChange={(e) => setWeeks(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-card border border-theme text-primary shadow-sm outline-none"
                    >
                        <option value={8}>8 SEM</option>
                        <option value={12}>12 SEM</option>
                        <option value={16}>16 SEM</option>
                    </select>
                </div>
            </div>

            {/* Baselines */}
            {baselines && (
                <div className="grid grid-cols-3 gap-2 px-1">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-2xl text-white shadow-md">
                        <p className="text-[8px] font-black uppercase opacity-80 tracking-widest mb-1.5 flex items-center gap-1">🛌 <span className="truncate">Recuperación</span></p>
                        <p className="text-sm font-black">{baselines.recovery.rhr?.toFixed(0) || '-'} <span className="text-[9px] font-bold opacity-70 ml-0.5">RHR</span></p>
                        <p className="text-sm font-black">{baselines.recovery.hrv?.toFixed(0) || '-'} <span className="text-[9px] font-bold opacity-70 ml-0.5">HRV</span></p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-3 rounded-2xl text-white shadow-md">
                        <p className="text-[8px] font-black uppercase opacity-80 tracking-widest mb-1.5 flex items-center gap-1">🗓️ <span className="truncate">Crónica 28d</span></p>
                        <p className="text-sm font-black">{baselines.chronic.rhr?.toFixed(0) || '-'} <span className="text-[9px] font-bold opacity-70 ml-0.5">RHR</span></p>
                        <p className="text-sm font-black">{baselines.chronic.hrv?.toFixed(0) || '-'} <span className="text-[9px] font-bold opacity-70 ml-0.5">HRV</span></p>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-3 rounded-2xl text-white shadow-md">
                        <p className="text-[8px] font-black uppercase opacity-80 tracking-widest mb-1.5 flex items-center gap-1">📚 <span className="truncate">Histórica 60d</span></p>
                        <p className="text-sm font-black">{baselines.historic.rhr?.toFixed(0) || '-'} <span className="text-[9px] font-bold opacity-70 ml-0.5">RHR</span></p>
                        <p className="text-sm font-black">{baselines.historic.hrv?.toFixed(0) || '-'} <span className="text-[9px] font-bold opacity-70 ml-0.5">HRV</span></p>
                    </div>
                </div>
            )}

            {/* Correlation Heatmap */}
            {correlationMatrix && (
                <div className="bg-card p-4 rounded-3xl border border-theme shadow-sm overflow-hidden">
                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-4 text-center">🔥 Mapa de Correlaciones</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[10px] border-separate border-spacing-0.5">
                            <thead>
                                <tr>
                                    <th className="p-1"></th>
                                    {correlationMatrix.labels.map(l => (
                                        <th key={l} className="p-1 font-black text-secondary uppercase tracking-tighter">{l}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {correlationMatrix.labels.map((rowLabel, i) => (
                                    <tr key={rowLabel}>
                                        <td className="p-1 font-black text-secondary uppercase text-[9px] whitespace-nowrap">{rowLabel}</td>
                                        {correlationMatrix.matrix[i].map((val, j) => (
                                            <td key={j} className={`p-2 text-center font-mono font-black rounded-lg transition-colors ${getCorrelationColor(val)}`}>
                                                {val != null ? val.toFixed(2) : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 mt-4 text-[8px] font-black uppercase tracking-widest text-secondary opacity-70">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Positiva</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 rounded-sm"></span> Neutra</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> Negativa</span>
                    </div>
                </div>
            )}

            {/* Weekly Summary Table */}
            <div className="bg-card rounded-3xl border border-theme overflow-hidden shadow-sm">
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest p-4 border-b border-theme bg-secondary/5">📋 Resumen Semanal</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                        <thead className="bg-secondary/5 border-b border-theme font-black text-secondary uppercase tracking-widest">
                            <tr>
                                <th className="px-3 py-3 text-left">Semana</th>
                                <th className="px-3 py-3 text-center">TSS</th>
                                <th className="px-3 py-3 text-center">ATL</th>
                                <th className="px-3 py-3 text-center">CTL</th>
                                <th className="px-3 py-3 text-center">RHR</th>
                                <th className="px-3 py-3 text-center">HRV</th>
                                <th className="px-3 py-3 text-center">Sueño</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-theme/30">
                            {weeklyData.map((w, i) => (
                                <tr key={i} className="hover:bg-secondary/5 transition-colors">
                                    <td className="px-3 py-3 font-bold text-primary whitespace-nowrap">{w.label}</td>
                                    <td className="px-3 py-3 text-center font-mono font-black text-purple-600">{Math.round(w.tss)}</td>
                                    <td className="px-3 py-3 text-center font-mono font-medium">{w.atl?.toFixed(0) || '-'}</td>
                                    <td className="px-3 py-3 text-center font-mono font-medium">{w.ctl?.toFixed(0) || '-'}</td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-rose-500">{w.rhr?.toFixed(0) || '-'}</td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-emerald-500">{w.hrv?.toFixed(0) || '-'}</td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-violet-500">{w.sleep?.toFixed(0) || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CoachCorrelationsView;
