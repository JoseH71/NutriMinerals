import { useState } from 'react';

const NutrientSummary = ({ dayLogs, title }) => {
    const [expandedNutrient, setExpandedNutrient] = useState(null);
    const sum = (k) => dayLogs.reduce((a, b) => a + (Number(b[k]) || 0), 0);

    const macros = [
        { key: 'protein', label: 'Prot', val: sum('protein'), unit: 'g', color: 'bg-orange-500' },
        { key: 'carbs', label: 'Carbs', val: sum('carbs'), unit: 'g', color: 'bg-blue-500' },
        { key: 'fat', label: 'Grasa', val: sum('fat'), unit: 'g', color: 'bg-yellow-500' },
        { key: 'fiber', label: 'Fibra', val: sum('fiber'), unit: 'g', color: 'bg-green-500' },
    ];

    const minerals = [
        { key: 'na', label: 'Na', val: sum('na'), color: 'text-blue-400' },
        { key: 'k', label: 'K', val: sum('k'), color: 'text-emerald-400' },
        { key: 'ca', label: 'Ca', val: sum('ca'), color: 'text-rose-400' },
        { key: 'mg', label: 'Mg', val: sum('mg'), color: 'text-purple-400' },
    ];

    const toggleExpand = (key) => {
        setExpandedNutrient(expandedNutrient === key ? null : key);
    };

    const FoodList = ({ nutrientKey }) => {
        const contributingFoods = dayLogs.filter(f => Number(f[nutrientKey]) > 0);
        if (contributingFoods.length === 0) return null;

        return (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-2 animate-fade-in">
                <p className="text-[10px] font-black uppercase opacity-60">Contribución de alimentos:</p>
                {contributingFoods.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                        <span className="opacity-80 truncate max-w-[70%]">{f.name}</span>
                        <span className="font-bold">{Math.round(f[nutrientKey])}{['na', 'k', 'ca', 'mg'].includes(nutrientKey) ? 'mg' : 'g'}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
            {/* Background elements for rich aesthetics */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-500/10 rounded-full -ml-12 -mb-12 blur-2xl"></div>

            <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{title || 'Resumen Diario'}</p>
                <div className="flex items-baseline gap-2 mb-6">
                    <p className="text-5xl font-black tracking-tighter">{Math.round(sum('calories'))}</p>
                    <p className="text-xl font-black opacity-30 uppercase">Kcal</p>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                    {macros.map(m => (
                        <button
                            key={m.key}
                            onClick={() => toggleExpand(m.key)}
                            className={`text-center transition-all ${expandedNutrient === m.key ? 'scale-110 drop-shadow-lg' : 'opacity-80 hover:opacity-100'}`}
                        >
                            <div className={`h-1.5 ${m.color} rounded-full mb-2 w-full mx-auto shadow-sm`}></div>
                            <p className="text-lg font-black">{Math.round(m.val)}<span className="text-[10px] ml-0.5">{m.unit}</span></p>
                            <p className="text-[10px] font-bold opacity-50 uppercase">{m.label}</p>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-4 gap-4 py-6 border-y border-white/10">
                    {minerals.map(m => (
                        <button
                            key={m.key}
                            onClick={() => toggleExpand(m.key)}
                            className={`text-center transition-all ${expandedNutrient === m.key ? 'scale-110 drop-shadow-lg' : 'opacity-80 hover:opacity-100'}`}
                        >
                            <p className={`text-xl font-black ${m.color}`}>{Math.round(m.val)}</p>
                            <p className="text-[10px] font-bold opacity-50 uppercase">{m.label} <span className="text-[8px]">mg</span></p>
                        </button>
                    ))}
                </div>

                {expandedNutrient && <FoodList nutrientKey={expandedNutrient} />}
            </div>
        </div>
    );
};

export default NutrientSummary;
