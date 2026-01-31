import React, { useMemo, useState } from 'react';

// Utility for smooth curves
const getPath = (points, height, maxVal, minVal) => {
    if (!points || points.length < 2) return '';
    const range = (maxVal - minVal) || 1;
    const getX = (i) => (i / (points.length - 1)) * 100;
    const getY = (val) => 100 - ((val - minVal) / range) * 100;

    let d = `M ${getX(0)} ${getY(points[0])}`;
    for (let i = 1; i < points.length; i++) {
        const x0 = getX(i - 1);
        const y0 = getY(points[i - 1]);
        const x1 = getX(i);
        const y1 = getY(points[i]);
        const cpX1 = x0 + (x1 - x0) * 0.5;
        const cpX2 = x1 - (x1 - x0) * 0.5;
        d += ` C ${cpX1} ${y0} ${cpX2} ${y1} ${x1} ${y1}`;
    }
    return d;
};

const BioGraph = ({ data }) => {
    // Estado para "Set-Point" manual
    const [setPointChecked, setSetPointChecked] = useState(false);

    // Cálculos de rangos para escalar (con margen de "aire")
    const { hrvPath, rhrPath, baselineY, currentHRV, diffFromBaseline } = useMemo(() => {
        if (!data?.days || data.days.length < 2) return { hrvPath: '', rhrPath: '', baselineY: 50 };

        const hrvs = data.days.map(d => Number(d.hrv)).filter(v => !isNaN(v) && v > 0);
        const rhrs = data.days.map(d => Number(d.rhr)).filter(v => !isNaN(v) && v > 0);

        if (hrvs.length < 2 || rhrs.length < 2) return { hrvPath: '', rhrPath: '', baselineY: 50 };

        const maxHrv = Math.max(...hrvs) * 1.1;
        const minHrv = Math.min(...hrvs) * 0.9;
        const maxRhr = Math.max(...rhrs) * 1.05;
        const minRhr = Math.min(...rhrs) * 0.95;

        const range = (maxHrv - minHrv) || 1;
        const getYLocal = (val) => 100 - ((val - minHrv) / range) * 100;

        const avgHrv = hrvs.reduce((a, b) => a + b, 0) / hrvs.length;

        return {
            hrvPath: getPath(hrvs, 100, maxHrv, minHrv),
            rhrPath: getPath(rhrs, 100, maxRhr, minRhr),
            baselineY: getYLocal(avgHrv),
            currentHRV: hrvs[hrvs.length - 1],
            diffFromBaseline: hrvs[hrvs.length - 1] - avgHrv
        };
    }, [data]);

    return (
        <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-black rounded-[2.5rem] p-7 shadow-xl border border-slate-300 dark:border-indigo-900/30 relative overflow-hidden group">
            {/* Background Kinetic Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] group-hover:bg-emerald-500/10 transition-all duration-1000"></div>

            <div className="absolute inset-0 flex opacity-25 pointer-events-none">
                {data?.days?.map((d, i) => (
                    <div key={i} className={`flex-1 transition-colors duration-1000 ${d.phase === 'active_cushion' ? 'bg-emerald-500/40' :
                        d.phase === 'accumulation' ? 'bg-amber-500/30' : 'bg-transparent'}`} />
                ))}
            </div>

            <div className="relative z-10 flex justify-between items-center mb-8">
                <div>
                    <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-indigo-400 mb-1">Tendencia Biológica</p>
                    <div className="flex items-center gap-3">
                        <h3 className="text-slate-900 dark:text-white font-black text-2xl uppercase tracking-tight">7 Días</h3>
                        <span className={`text-[11px] font-black px-3 py-1 rounded-full shadow-md ${diffFromBaseline > 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                            {diffFromBaseline > 0 ? '↑' : '↓'} {Math.abs(Math.round(diffFromBaseline))}ms
                        </span>
                    </div>
                </div>

                <div className="text-right bg-white/40 dark:bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-slate-300 dark:border-white/5 shadow-sm">
                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1">HRV Actual</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">{Math.round(currentHRV || 0)}</p>
                </div>
            </div>

            <div className="h-44 w-full relative pt-4">
                {/* Horizontal Baseline Band (Target Zone) - MORE VISIBLE */}
                <div className="absolute left-0 right-0 h-10 bg-emerald-500/15 dark:bg-emerald-400/15 border-y border-emerald-500/40 dark:border-emerald-400/40 pointer-events-none" style={{ top: `${baselineY - 5}%` }}>
                    <div className="absolute -top-3 right-0 flex items-center gap-1">
                        <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest bg-white/90 dark:bg-black px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">Zona Óptima</span>
                    </div>
                </div>

                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="hrvGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#059669" />
                            <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                    </defs>

                    {/* RHR Line (Indigo) */}
                    <path d={rhrPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="1 4" strokeLinecap="round" className="opacity-40" />

                    {/* HRV Line (Emerald - THINNER) */}
                    <path d={hrvPath} fill="none" stroke="url(#hrvGradient)" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-sm" />
                </svg>

                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[11px] font-black text-slate-500 opacity-80 px-1 border-t border-slate-300 dark:border-white/10 pt-3">
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Hace 1 semana</span>
                    <span className="flex items-center gap-1">Hoy <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div></span>
                </div>
            </div>

            <div className="flex justify-center gap-12 mt-8 pt-5 border-t border-slate-100 dark:border-white/5">
                <div className="flex flex-col items-center group/leg">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="w-4 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]"></span>
                        <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-widest">HRV</span>
                    </div>
                    <span className="text-[10px] font-bold text-secondary opacity-50 uppercase tracking-tighter">Variabilidad</span>
                </div>
                <div className="flex flex-col items-center group/leg">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="w-4 h-1.5 rounded-full bg-indigo-500 opacity-40 border-b border-indigo-300 border-dashed"></span>
                        <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-widest">Pulso</span>
                    </div>
                    <span className="text-[10px] font-bold text-secondary opacity-50 uppercase tracking-tighter">Estrés Basal</span>
                </div>
            </div>
        </div>
    );
};

export default BioGraph;
