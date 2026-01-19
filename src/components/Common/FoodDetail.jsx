import React from 'react';
import * as Icons from 'lucide-react';

const FoodDetail = ({ food, onSaveFood, isSaved, impactStats }) => {
    if (!food) return null;
    const extraMinerals = (food.extraMinerals || []).filter(m => Number(m.value) > 0);

    return (
        <div className="mt-4 pt-4 border-t border-theme animate-fade-in">
            {/* Reliability Badge */}
            <div className="mb-3 flex justify-center">
                {(() => {
                    const source = food.dataSource || (food.confidence || (food.name && food.name.split(' ').length > 3) ? 'estimado' : (food.foodId || food.id?.startsWith('food_') ? 'local' : 'manual'));
                    if (source === 'local') return (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-black border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                            🧪 Base local
                        </span>
                    );
                    if (source === 'estimado') return (
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black border border-indigo-300 dark:border-indigo-700 flex items-center gap-1">
                            🤖 Estimado
                        </span>
                    );
                    return (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-black border border-theme flex items-center gap-1">
                            ✍️ Manual
                        </span>
                    );
                })()}
            </div>

            {/* Macros */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center p-3 bg-card-alt rounded-2xl shadow-sm">
                    <p className="text-[9px] font-black text-secondary uppercase tracking-tighter">Kcal</p>
                    <p className="text-base font-black text-orange-500">{Math.round(food.calories || 0)}</p>
                </div>
                <div className="text-center p-3 bg-card-alt rounded-2xl shadow-sm">
                    <p className="text-[9px] font-black text-secondary uppercase tracking-tighter">Prot</p>
                    <p className="text-base font-black">{Math.round(food.protein || 0)}g</p>
                </div>
                <div className="text-center p-3 bg-card-alt rounded-2xl shadow-sm">
                    <p className="text-[9px] font-black text-secondary uppercase tracking-tighter">Carbs</p>
                    <p className="text-base font-black">{Math.round(food.carbs || 0)}g</p>
                </div>
                <div className="text-center p-3 bg-card-alt rounded-2xl shadow-sm">
                    <p className="text-[9px] font-black text-secondary uppercase tracking-tighter">Grasa</p>
                    <p className="text-base font-black">{Math.round(food.fat || 0)}g</p>
                </div>
            </div>

            {/* Minerales principales */}
            <div className={`grid gap-2 ${(() => {
                const count = [food.na, food.k, food.ca, food.mg].filter(v => Math.round(v || 0) > 0).length;
                return count > 3 ? 'grid-cols-4' : count === 3 ? 'grid-cols-3' : 'grid-cols-2';
            })()}`}>
                {[
                    { key: 'na', label: 'Na', color: 'blue' },
                    { key: 'k', label: 'K', color: 'emerald' },
                    { key: 'ca', label: 'Ca', color: 'rose' },
                    { key: 'mg', label: 'Mg', color: 'violet' }
                ].filter(m => Math.round(food[m.key] || 0) > 0).map(m => (
                    <div key={m.key} className={`text-center p-2 bg-${m.color}-50 dark:bg-${m.color}-900/30 rounded-2xl border-l-4 border-${m.color}-500 shadow-sm transition-all`}>
                        <p className={`text-[9px] font-black text-${m.color}-600 dark:text-${m.color}-400 uppercase tracking-tighter`}>{m.label}</p>
                        <p className={`text-sm font-black text-${m.color}-700 dark:text-${m.color}-300`}>{Math.round(food[m.key] || 0)} <span className="text-[8px] font-normal">mg</span></p>
                    </div>
                ))}
            </div>

            {/* Historial de Impacto (Punto 3) */}
            {impactStats && (
                <div className="mt-4 p-3 rounded-2xl border border-theme bg-card shadow-sm animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-[9px] font-black text-secondary uppercase tracking-widest">Historial de Impacto</p>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${impactStats.verdict === 'evitar' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' :
                                impactStats.verdict === 'moderado' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' :
                                    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                            }`}>
                            {impactStats.verdict.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex-1 text-center border-r border-theme/50">
                            <p className="text-secondary text-[8px] uppercase font-bold">Veces cenado</p>
                            <p className="text-sm font-black text-primary">{impactStats.total}</p>
                        </div>
                        <div className="flex-[2] text-center">
                            <p className="text-secondary text-[8px] uppercase font-bold">Tasa de síntomas</p>
                            <div className="flex items-center justify-center gap-2">
                                <p className={`text-base font-black ${impactStats.rate > 60 ? 'text-rose-600' :
                                        impactStats.rate > 30 ? 'text-amber-600' :
                                            'text-emerald-600'
                                    }`}>{impactStats.rate}%</p>
                                <span className="text-[10px] opacity-60">({impactStats.symptomCount}/{impactStats.total})</span>
                            </div>
                        </div>
                    </div>
                    {impactStats.verdict === 'evitar' && (
                        <p className="mt-2 text-[8px] text-rose-600 dark:text-rose-400 font-bold text-center uppercase tracking-tighter italic">
                            ⚠️ Este alimento suele sentarte mal por la noche.
                        </p>
                    )}
                </div>
            )}

            {/* Otros minerales */}
            {extraMinerals.length > 0 && (
                <div className="mt-3">
                    <p className="text-[9px] font-black text-secondary uppercase tracking-widest mb-2 opacity-70">Otros Minerales</p>
                    <div className="flex flex-wrap gap-2">
                        {extraMinerals.map((m, i) => (
                            <span key={i} className="px-3 py-1 bg-card-alt rounded-full text-[10px] font-black shadow-sm border border-theme/30 uppercase tracking-tighter">
                                {m.label}: {Math.round(m.value)}mg
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Botón Guardar en Mis Alimentos */}
            {onSaveFood && (
                <div className="mt-6">
                    <button
                        onClick={() => onSaveFood(food)}
                        disabled={isSaved}
                        className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${isSaved ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 cursor-default shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20'}`}
                    >
                        {isSaved ? (
                            <><Icons.Check size={18} /> Guardado en Mis Alimentos</>
                        ) : (
                            <><Icons.Book size={18} /> Guardar en Mis Alimentos</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FoodDetail;
