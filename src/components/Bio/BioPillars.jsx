import React, { useState } from 'react';
import { Icons } from '../Icons';

const BioPillars = ({ pillars }) => {
    const [selectedPillar, setSelectedPillar] = useState(null);

    const pillarExplanations = {
        regulation: {
            title: "La Calle Regula",
            desc: "Este es el regulador más potente de tu sistema nervioso autónomo. La bici en exterior, con luz solar y estímulo visual de profundidad, compensa el estrés del rodillo y el gym.",
            key: "Regla Antigravity: Al menos 1 salida > 2h en calle a la semana para mantener el 'colchón' vagal."
        },
        energy: {
            title: "Balance Energético",
            desc: "Analiza tu ingesta de ayer. Tu metabolismo necesita un mínimo de sustrato para reparar tejidos y mantener la HRV alta.",
            key: "Umbral Crítico: < 1900 kcal activa el modo 'Supervivencia/Cuidado', lo que deprime la recuperación."
        },
        rest: {
            title: "Descanso Vagal",
            desc: "Es la medición pura de tu recuperación nocturna (HRV). Indica si tu corazón tiene margen de maniobra o está rígido por la fatiga.",
            key: "Target: > 45 ms indica que tu sistema parasimpático ha tomado el control y estás listo para cargar."
        }
    };

    const getStatusColor = (state) => {
        if (state === 'green') return 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-400/30 shadow-lg shadow-emerald-500/20';
        if (state === 'amber') return 'bg-gradient-to-br from-amber-400 to-amber-500 text-white border-amber-300/30 shadow-lg shadow-amber-500/20';
        return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-300';
    };

    const getIconBg = (state) => {
        if (state === 'green') return 'bg-white/20 backdrop-blur-md border border-white/30';
        if (state === 'amber') return 'bg-white/20 backdrop-blur-md border border-white/30';
        return 'bg-slate-100 dark:bg-slate-700';
    };

    return (
        <div className="grid grid-cols-1 gap-4 relative">
            {/* Modal de Explicación */}
            {selectedPillar && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedPillar(null)}>
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16"></div>

                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">{pillarExplanations[selectedPillar].title}</h4>
                            <button onClick={() => setSelectedPillar(null)} className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-500 hover:rotate-90 transition-transform"><Icons.X size={20} /></button>
                        </div>
                        <p className="text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed mb-8 relative z-10">{pillarExplanations[selectedPillar].desc}</p>
                        <div className="p-5 bg-indigo-50 dark:bg-indigo-500/10 rounded-[2rem] border border-indigo-100 dark:border-indigo-400/20 relative z-10">
                            <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 italic flex items-center gap-2">
                                <Icons.Sparkles size={14} /> Clave del Éxito
                            </p>
                            <p className="text-[13px] font-bold text-indigo-900 dark:text-indigo-100 leading-snug">{pillarExplanations[selectedPillar].key}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Regulación */}
            <button
                onClick={() => setSelectedPillar('regulation')}
                className={`w-full text-left p-6 rounded-[2.5rem] border ${getStatusColor(pillars.regulation.state)} transition-all hover:scale-[1.03] hover:rotate-1 active:scale-95 group`}>
                <div className="flex items-center gap-5 mb-3">
                    <div className={`p-3.5 rounded-2xl ${getIconBg(pillars.regulation.state)} shadow-sm group-hover:scale-110 transition-transform`}>
                        <Icons.Activity size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-[13px] font-black uppercase tracking-[0.2em] opacity-70">Regulación</p>
                        <h3 className="font-black text-2xl leading-none">{pillars.regulation.status}</h3>
                    </div>
                </div>
                <p className="text-sm font-bold ml-1 opacity-90 pl-14">{pillars.regulation.detail}</p>
            </button>

            <div className="grid grid-cols-2 gap-4">
                {/* Energía */}
                <button
                    onClick={() => setSelectedPillar('energy')}
                    className={`p-6 rounded-[2.5rem] border ${getStatusColor(pillars.energy.state)} transition-all hover:scale-105 hover:-rotate-1 active:scale-95 flex flex-col gap-4 text-left group`}>
                    <div className="flex justify-between items-start">
                        <div className={`p-3 rounded-2xl ${getIconBg(pillars.energy.state)} shadow-sm group-hover:rotate-12 transition-transform`}>
                            <Icons.Zap size={22} className="text-white" />
                        </div>
                        <div className="bg-white/30 p-1.5 rounded-full backdrop-blur-sm">
                            <div className="bg-white w-2 h-2 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <div>
                        <p className="text-[13px] font-black uppercase tracking-[0.2em] opacity-70">Energía</p>
                        <h3 className="font-black text-lg leading-tight">{pillars.energy.status}</h3>
                    </div>
                </button>

                {/* Descanso */}
                <button
                    onClick={() => setSelectedPillar('rest')}
                    className={`p-6 rounded-[2.5rem] border ${getStatusColor(pillars.rest.state)} transition-all hover:scale-105 hover:rotate-1 active:scale-95 flex flex-col gap-4 text-left group`}>
                    <div className="flex justify-between items-start">
                        <div className={`p-3 rounded-2xl ${getIconBg(pillars.rest.state)} shadow-sm group-hover:-rotate-12 transition-transform`}>
                            <Icons.Moon size={22} className="text-white" />
                        </div>
                        <div className="bg-white/30 p-1.5 rounded-full backdrop-blur-sm">
                            <div className="bg-white w-2 h-2 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <div>
                        <p className="text-[13px] font-black uppercase tracking-[0.2em] opacity-70">Descanso</p>
                        <h3 className="font-black text-lg leading-tight">{pillars.rest.status}</h3>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default BioPillars;
