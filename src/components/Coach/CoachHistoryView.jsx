import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import * as Icons from 'lucide-react';

const CoachHistoryView = ({ historyData = [] }) => {
    const [dateRange, setDateRange] = useState(14);
    const [copied, setCopied] = useState(false);
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const filteredData = [...historyData].slice(-dateRange).reverse();
    const chartData = [...historyData].slice(-dateRange);

    // Copy metrics to clipboard
    const copyMetrics = () => {
        if (filteredData.length === 0) return;
        let text = `📊 HISTORIAL DE MÉTRICAS (${dateRange} días)\n\n`;
        text += `Fecha\t\tRHR\tHRV\tSueño\tTSS\tTSB\n`;
        text += `${'─'.repeat(50)}\n`;
        filteredData.forEach(d => {
            const date = new Date(d.id).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
            const tsb = ((d.ctl || 0) - (d.atl || 0)).toFixed(0);
            text += `${date}\t\t${d.restingHR || '-'}\t${d.hrv || '-'}\t${d.sleepScore || '-'}\t${d.dailyTSS || 0}\t${tsb}\n`;
        });
        // Add averages
        const avgTotal = (arr, key) => {
            const valid = arr.filter(d => d[key]);
            return valid.length ? valid.reduce((s, d) => s + d[key], 0) / valid.length : 0;
        };
        text += `\n📈 PROMEDIOS:\n`;
        text += `• RHR: ${avgTotal(filteredData, 'restingHR').toFixed(0)} bpm\n`;
        text += `• HRV: ${avgTotal(filteredData, 'hrv').toFixed(0)} ms\n`;
        text += `• Sueño: ${avgTotal(filteredData, 'sleepScore').toFixed(0)}\n`;
        text += `• TSS/día: ${avgTotal(filteredData, 'dailyTSS').toFixed(0)}\n`;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    // Chart effect
    useEffect(() => {
        if (!chartRef.current || chartData.length === 0) return;
        if (chartInstance.current) chartInstance.current.destroy();

        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const textColor = isDark ? '#94a3b8' : '#64748b';

        chartInstance.current = new Chart(chartRef.current, {
            type: 'line',
            data: {
                labels: chartData.map(d => new Date(d.id).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })),
                datasets: [
                    { label: 'HRV', data: chartData.map(d => d.hrv || null), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, yAxisID: 'y' },
                    { label: 'RHR', data: chartData.map(d => d.restingHR || null), borderColor: '#f43f5e', backgroundColor: 'transparent', tension: 0.4, yAxisID: 'y' },
                    { label: 'Sueño', data: chartData.map(d => d.sleepScore || null), borderColor: '#8b5cf6', backgroundColor: 'transparent', tension: 0.4, yAxisID: 'y' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: textColor,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 10, weight: 'bold' }
                        }
                    }
                },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 } } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 } }, min: 0 }
                }
            }
        });
        return () => { if (chartInstance.current) chartInstance.current.destroy(); };
    }, [chartData, dateRange]);

    // Calculate averages for summary cards
    const getAvg = (key) => {
        const valid = filteredData.filter(d => d[key] != null);
        return valid.length ? (valid.reduce((s, d) => s + d[key], 0) / valid.length).toFixed(0) : '-';
    };
    const getAvgTSB = () => {
        const valid = filteredData.filter(d => d.ctl != null && d.atl != null);
        return valid.length ? (valid.reduce((s, d) => s + (d.ctl - d.atl), 0) / valid.length).toFixed(1) : '-';
    };

    return (
        <div className="space-y-4 animate-fade-in pb-12">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-xl font-black text-primary tracking-tighter uppercase">Historial de Métricas</h2>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={copyMetrics}
                        className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg' : 'bg-card border border-theme text-secondary hover:text-indigo-600'}`}
                        title="Copiar métricas"
                    >
                        {copied ? <Icons.Check size={18} /> : <Icons.Copy size={18} />}
                    </button>
                    <div className="flex gap-1">
                        {[7, 14, 30].map(r => (
                            <button key={r} onClick={() => setDateRange(r)} className={`px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${dateRange === r ? 'bg-indigo-600 text-white shadow-md' : 'bg-card border border-theme text-secondary hover:bg-card-alt'}`}>
                                {r}D
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-1.5 px-1">
                <div className="bg-card p-2 rounded-xl border border-theme text-center shadow-sm">
                    <p className="text-[8px] font-black text-secondary uppercase tracking-tighter mb-1">RHR</p>
                    <p className="text-sm font-black text-rose-500">{getAvg('restingHR')}</p>
                </div>
                <div className="bg-card p-2 rounded-xl border border-theme text-center shadow-sm">
                    <p className="text-[8px] font-black text-secondary uppercase tracking-tighter mb-1">HRV</p>
                    <p className="text-sm font-black text-emerald-500">{getAvg('hrv')}</p>
                </div>
                <div className="bg-card p-2 rounded-xl border border-theme text-center shadow-sm">
                    <p className="text-[8px] font-black text-secondary uppercase tracking-tighter mb-1">Sueño</p>
                    <p className="text-sm font-black text-violet-500">{getAvg('sleepScore')}</p>
                </div>
                <div className="bg-card p-2 rounded-xl border border-theme text-center shadow-sm">
                    <p className="text-[8px] font-black text-secondary uppercase tracking-tighter mb-1">TSS/D</p>
                    <p className="text-sm font-black text-purple-500">{getAvg('dailyTSS')}</p>
                </div>
                <div className="bg-card p-2 rounded-xl border border-theme text-center shadow-sm">
                    <p className="text-[8px] font-black text-secondary uppercase tracking-tighter mb-1">TSB</p>
                    <p className={`text-sm font-black ${parseFloat(getAvgTSB()) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{getAvgTSB()}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-card p-4 rounded-3xl border border-theme shadow-sm overflow-hidden" style={{ height: '240px' }}>
                <canvas ref={chartRef}></canvas>
            </div>

            {/* Data Table */}
            <div className="bg-card rounded-3xl border border-theme overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border-collapse">
                        <thead className="bg-secondary/5 text-secondary uppercase font-black border-b border-theme tracking-widest">
                            <tr>
                                <th className="px-3 py-3">Fecha</th>
                                <th className="px-3 py-3 text-center">RHR</th>
                                <th className="px-3 py-3 text-center">HRV</th>
                                <th className="px-3 py-3 text-center">Sueño</th>
                                <th className="px-3 py-3 text-center">TSS</th>
                                <th className="px-3 py-3 text-center">TSB</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-theme/50">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-3 py-8 text-center text-secondary italic">No hay datos disponibles</td>
                                </tr>
                            ) : filteredData.map((d, i) => (
                                <tr key={i} className="hover:bg-secondary/5 transition-colors">
                                    <td className="px-3 py-3 font-bold text-primary whitespace-nowrap">
                                        {new Date(d.id).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                    </td>
                                    <td className="px-3 py-3 text-center font-mono font-medium">{d.restingHR || '-'}</td>
                                    <td className="px-3 py-3 text-center font-mono font-medium">{d.hrv || '-'}</td>
                                    <td className="px-3 py-3 text-center font-mono font-medium">{d.sleepScore || '-'}</td>
                                    <td className="px-3 py-3 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                                        {d.dailyTSS || 0}
                                    </td>
                                    <td className={`px-3 py-3 text-center font-mono font-black ${d.ctl - d.atl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {((d.ctl || 0) - (d.atl || 0))?.toFixed(0) || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CoachHistoryView;
