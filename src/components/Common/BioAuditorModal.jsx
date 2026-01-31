import React from 'react';
import { Icons } from '../Icons';

const BioAuditorModal = ({ isOpen, onClose, type, data, dataPoints }) => {
    if (!isOpen) return null;

    const isHRV = type === 'hrv';
    const title = isHRV ? 'Auditor Pro: Impacto HRV' : 'Auditor Pro: Impacto FC (Basal)';
    const accentColor = isHRV ? 'emerald' : 'rose';
    const unit = isHRV ? 'ms' : 'lpm';

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto pt-4 pb-20">
            <div className="fixed inset-0" onClick={onClose} />

            <div className="relative bg-[#020617] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in duration-300 mt-10 mb-10">
                {/* Technical Header */}
                <div className={`p-8 border-b border-white/5 bg-gradient-to-r from-${accentColor}-500/10 to-transparent`}>
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full bg-${accentColor}-500 animate-pulse`} />
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">{title}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                            <Icons.X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span>Análisis de Correlación Directa</span>
                        <span>•</span>
                        <span>DataSet: {dataPoints} días útiles</span>
                    </div>
                </div>

                <div className="p-8 space-y-6">
                    {/* Auditor Grid */}
                    <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                            <span>Nutriente / Ratio</span>
                            <span>Impacto Relativo</span>
                        </div>

                        <div className="space-y-3">
                            {data.map((item, i) => {
                                // Logic for colors: 
                                // HRV: Positive is GOOD (Green), Negative is BAD (Red)
                                // FC: Positive is BAD (Red), Negative is GOOD (Green)
                                const isPositive = item.impact > 0;
                                const isGood = isHRV ? isPositive : !isPositive;
                                const colorClass = isGood ? 'emerald' : 'rose';

                                // Scale bar for UI (max 30% for visual normalization)
                                const visualPercent = Math.min(Math.abs(item.impact) * 3, 100);

                                return (
                                    <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-white uppercase tracking-tight">{item.label}</span>
                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Base: {item.count} días</span>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-sm font-black text-${colorClass}-400`}>
                                                    {isPositive ? '+' : ''}{item.impact.toFixed(1)}%
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400">
                                                    {isPositive ? '+' : ''}{item.absChange.toFixed(1)} {unit}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Dual Direction Bar */}
                                        <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            {/* Center Marker */}
                                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 z-10" />

                                            {/* Fill Bar */}
                                            <div
                                                className={`absolute h-full bg-${colorClass}-500 transition-all duration-700`}
                                                style={{
                                                    width: `${visualPercent / 2}%`,
                                                    left: isPositive ? '50%' : `calc(50% - ${visualPercent / 2}%)`
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Technical Footer */}
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 text-[10px] text-slate-500 leading-relaxed font-medium italic">
                        Nota: Los días con carga de entrenamiento extrema (TSS &gt; 150) han sido excluidos automáticamente para centrar el análisis exclusivamente en la respuesta nutricional.
                    </div>

                    <button
                        onClick={onClose}
                        className={`w-full py-4 bg-${accentColor}-600/20 hover:bg-${accentColor}-600/30 text-${accentColor}-400 border border-${accentColor}-500/20 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all active:scale-95`}
                    >
                        Cerrar Auditoría
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BioAuditorModal;
