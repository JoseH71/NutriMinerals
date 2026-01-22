import React from 'react';
import { Icons } from '../Icons';

const BioPillars = ({ pillars }) => {
    // Helper para mapas de color silenciosos
    const getStatusColor = (state) => {
        if (state === 'green') return 'bg-emerald-50/50 text-emerald-800 border-emerald-100';
        if (state === 'amber') return 'bg-amber-50/50 text-amber-800 border-amber-100';
        return 'bg-slate-50 text-slate-600 border-slate-100'; // Neutral
    };

    return (
        <div className="grid grid-cols-1 gap-3">
            {/* Regulación: El pilar central */}
            <div className={`p-4 rounded-3xl border ${getStatusColor(pillars.regulation.state)} transition-all duration-700 ease-out`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-2xl bg-white/60 shadow-sm`}>
                        <Icons.Activity size={20} className={pillars.regulation.state === 'green' ? 'text-emerald-600' : 'text-amber-600'} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Regulación</p>
                        <h3 className="font-bold text-lg leading-none">{pillars.regulation.status}</h3>
                    </div>
                </div>
                <p className="text-xs font-medium ml-1 opacity-80 pl-12">{pillars.regulation.detail}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Energía */}
                <div className={`p-4 rounded-3xl border ${getStatusColor(pillars.energy.state)} transition-all duration-700 delay-100 ease-out`}>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                            <div className={`p-2 rounded-2xl bg-white/60 shadow-sm w-fit`}>
                                <Icons.Zap size={18} className={pillars.energy.state === 'green' ? 'text-emerald-600' : 'text-amber-600'} />
                            </div>
                            <span className={`h-2 w-2 rounded-full ${pillars.energy.state === 'green' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Energía</p>
                            <h3 className="font-bold text-sm leading-tight">{pillars.energy.status}</h3>
                        </div>
                    </div>
                </div>

                {/* Descanso */}
                <div className={`p-4 rounded-3xl border ${getStatusColor(pillars.rest.state)} transition-all duration-700 delay-200 ease-out`}>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                            <div className={`p-2 rounded-2xl bg-white/60 shadow-sm w-fit`}>
                                <Icons.Moon size={18} className={pillars.rest.state === 'green' ? 'text-emerald-600' : 'text-amber-600'} />
                            </div>
                            <span className={`h-2 w-2 rounded-full ${pillars.rest.state === 'green' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Descanso</p>
                            <h3 className="font-bold text-sm leading-tight">{pillars.rest.status}</h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BioPillars;
