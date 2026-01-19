import React from 'react';

const NutrientSummary = ({ dayLogs, title }) => {
    const sum = (k) => dayLogs.reduce((a, b) => a + (Number(b[k]) || 0), 0);
    const calories = sum('calories');

    const macros = [
        { label: 'Prot', val: sum('protein'), unit: 'g', color: 'bg-orange-500', icon: '🥩' },
        { label: 'Carbs', val: sum('carbs'), unit: 'g', color: 'bg-blue-500', icon: '🍚' },
        { label: 'Grasa', val: sum('fat'), unit: 'g', color: 'bg-yellow-500', icon: '🥑' },
        { label: 'Fibra', val: sum('fiber'), unit: 'g', color: 'bg-green-500', icon: '🥦' },
    ];

    const minerals = [
        { label: 'Na', val: sum('na'), color: 'text-blue-500', darkColor: 'dark:text-blue-400' },
        { label: 'K', val: sum('k'), color: 'text-emerald-500', darkColor: 'dark:text-emerald-400' },
        { label: 'Ca', val: sum('ca'), color: 'text-rose-500', darkColor: 'dark:text-rose-400' },
        { label: 'Mg', val: sum('mg'), color: 'text-purple-500', darkColor: 'dark:text-purple-400' },
    ];

    return (
        <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-700 p-6 rounded-[2rem] text-white shadow-xl ring-4 ring-indigo-500/10 mb-4 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>

            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">{title || 'Resumen Energético'}</p>
            <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-black tracking-tighter">{Math.round(calories)}</span>
                <span className="text-lg font-bold opacity-60 uppercase tracking-widest">Kcal</span>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-6">
                {macros.map(m => (
                    <div key={m.label} className="text-center group">
                        <div className="h-1 w-full bg-white/10 rounded-full mb-2 overflow-hidden">
                            <div className={`h-full ${m.color} transition-all duration-1000`} style={{ width: '100%' }}></div>
                        </div>
                        <p className="text-sm font-black tracking-tighter">{Math.round(m.val)}<span className="text-[10px] lowercase opacity-70 ml-0.5">{m.unit}</span></p>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-0.5 group-hover:opacity-100 transition-opacity">{m.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-4 gap-2 pt-6 border-t border-white/10">
                {minerals.map(m => (
                    <div key={m.label} className="text-center group">
                        <p className={`text-lg font-black tracking-tighter ${m.color.replace('text-', 'text-indigo-200')} transition-colors`}>{Math.round(m.val)}</p>
                        <div className="flex flex-col items-center">
                            <span className={`text-[9px] font-black uppercase tracking-widest opacity-70`}>{m.label}</span>
                            <span className="text-[7px] font-bold opacity-40 uppercase">mg</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NutrientSummary;
