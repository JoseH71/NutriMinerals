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
    const { hrvPath, rhrPath } = useMemo(() => {
        if (!data?.days || data.days.length < 2) return { hrvPath: '', rhrPath: '' };

        const hrvs = data.days.map(d => Number(d.hrv)).filter(v => !isNaN(v) && v > 0);
        const rhrs = data.days.map(d => Number(d.rhr)).filter(v => !isNaN(v) && v > 0);

        if (hrvs.length < 2 || rhrs.length < 2) return { hrvPath: '', rhrPath: '' };

        // "Aire" visual para que no toquen los bordes
        const maxHrv = Math.max(...hrvs) * 1.1;
        const minHrv = Math.min(...hrvs) * 0.9;
        const maxRhr = Math.max(...rhrs) * 1.05;
        const minRhr = Math.min(...rhrs) * 0.95;

        return {
            hrvPath: getPath(hrvs, 100, maxHrv, minHrv),
            rhrPath: getPath(rhrs, 100, maxRhr, minRhr)
        };
    }, [data]);

    return (
        <div className="bg-card rounded-[2.5rem] p-6 shadow-sm border border-theme relative overflow-hidden">
            {/* Background Phases Layer */}
            <div className="absolute inset-0 flex opacity-20 pointer-events-none">
                {data?.days?.map((d, i) => (
                    <div key={i} className={`flex-1 transition-colors duration-1000 ${d.phase === 'active_cushion' ? 'bg-gradient-to-b from-emerald-100 to-transparent' :
                            d.phase === 'accumulation' ? 'bg-gradient-to-b from-amber-100 to-transparent' :
                                'bg-transparent'
                        }`} />
                ))}
            </div>

            {/* Header / Interaction Layer */}
            <div className="relative z-10 flex justify-between items-start mb-8">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-60">Tendencia Biológica</p>
                    <h3 className="text-primary font-bold text-lg">7 Días</h3>
                </div>

                {/* Manual Check Button */}
                {!setPointChecked ? (
                    <button
                        onClick={() => setSetPointChecked(true)}
                        className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 transition-all active:scale-95"
                    >
                        ¿Pulso Rápido?
                    </button>
                ) : (
                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-100">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Estable</span>
                    </div>
                )}
            </div>

            {/* SVG Graph Layer */}
            <div className="h-32 w-full relative">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    {/* HRV Line (Primary) */}
                    <path d={hrvPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" className="drop-shadow-sm opacity-90" />
                    <path d={hrvPath} fill="none" stroke="#10b981" strokeWidth="10" strokeLinecap="round" className="opacity-10 blur-sm" />

                    {/* RHR Line (Secondary, thinner) */}
                    <path d={rhrPath} fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" className="opacity-40" />
                </svg>

                {/* Legend Overlay */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] font-bold text-secondary opacity-40 px-1">
                    <span>Hace 7 días</span>
                    <span>Hoy</span>
                </div>
            </div>

            <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[9px] font-black text-secondary uppercase tracking-widest">HRV</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 opacity-50 border border-indigo-200 border-dashed"></span>
                    <span className="text-[9px] font-black text-secondary uppercase tracking-widest">Pulso</span>
                </div>
            </div>
        </div>
    );
};

export default BioGraph;
