import { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { getTodayEntries, deleteDailyEntry } from '../utils/helpers';
import { HEALTH_THRESHOLDS } from '../utils/healthThresholds';

export const DiaryView = () => {
    const [entries, setEntries] = useState([]);
    const [totals, setTotals] = useState(null);

    const loadEntries = async () => {
        try {
            const data = await getTodayEntries();
            setEntries(data);
            calculateTotals(data);
        } catch (error) {
            console.error('Error loading entries:', error);
            setEntries([]);
        }
    };

    useEffect(() => {
        loadEntries();
        // Refresh every 5 seconds
        const interval = setInterval(loadEntries, 5000);
        return () => clearInterval(interval);
    }, []);

    const calculateTotals = (data) => {
        const total = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            na: 0,
            k: 0,
            ca: 0,
            mg: 0,
        };

        data.forEach((entry) => {
            const mult = entry.quantity || 1;
            total.calories += (entry.calories || 0) * mult;
            total.protein += (entry.protein || 0) * mult;
            total.carbs += (entry.carbs || 0) * mult;
            total.fat += (entry.fat || 0) * mult;
            total.fiber += (entry.fiber || 0) * mult;
            total.na += (entry.na || 0) * mult;
            total.k += (entry.k || 0) * mult;
            total.ca += (entry.ca || 0) * mult;
            total.mg += (entry.mg || 0) * mult;
        });

        // Round all values
        Object.keys(total).forEach(key => {
            total[key] = Math.round(total[key]);
        });

        setTotals(total);
    };

    const handleDelete = async (entryId) => {
        if (confirm('¿Eliminar esta entrada?')) {
            try {
                await deleteDailyEntry(entryId);
                await loadEntries();
            } catch (error) {
                console.error('Error deleting entry:', error);
            }
        }
    };

    const getProgress = (value, target) => {
        return Math.min(100, Math.round((value / target) * 100));
    };

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Diario de Hoy</h2>

            {/* Summary Cards */}
            {totals && (
                <div className="mb-6">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl p-4">
                            <div className="text-sm opacity-90">Calorías</div>
                            <div className="text-3xl font-black">{totals.calories}</div>
                            <div className="text-xs opacity-75">Meta: 2000 kcal</div>
                        </div>
                        <div className="bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-xl p-4">
                            <div className="text-sm opacity-90">Proteína</div>
                            <div className="text-3xl font-black">{totals.protein}g</div>
                            <div className="text-xs opacity-75">Meta: 120g</div>
                        </div>
                    </div>

                    {/* Macros Progress */}
                    <div className="bg-card border border-theme rounded-xl p-4 mb-4">
                        <h3 className="font-bold mb-3">Macronutrientes</h3>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-secondary">Carbohidratos</span>
                                    <span className="font-bold">{totals.carbs}g / 250g</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all"
                                        style={{ width: `${getProgress(totals.carbs, 250)}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-secondary">Grasas</span>
                                    <span className="font-bold">{totals.fat}g / 70g</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-yellow-500 transition-all"
                                        style={{ width: `${getProgress(totals.fat, 70)}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-secondary">Fibra</span>
                                    <span className="font-bold">{totals.fiber}g / 30g</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 transition-all"
                                        style={{ width: `${getProgress(totals.fiber, 30)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Minerals */}
                    <div className="bg-card border border-theme rounded-xl p-4">
                        <h3 className="font-bold mb-3">Minerales</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs text-secondary">Sodio (Na)</div>
                                <div className="font-bold text-primary">{totals.na} mg</div>
                                <div className="text-xs text-secondary">Meta: &lt;2300 mg</div>
                            </div>
                            <div>
                                <div className="text-xs text-secondary">Potasio (K)</div>
                                <div className="font-bold text-primary">{totals.k} mg</div>
                                <div className="text-xs text-secondary">Meta: 3500 mg</div>
                            </div>
                            <div>
                                <div className="text-xs text-secondary">Calcio (Ca)</div>
                                <div className="font-bold text-primary">{totals.ca} mg</div>
                                <div className="text-xs text-secondary">Meta: 1000 mg</div>
                            </div>
                            <div>
                                <div className="text-xs text-secondary">Magnesio (Mg)</div>
                                <div className="font-bold text-primary">{totals.mg} mg</div>
                                <div className="text-xs text-secondary">Meta: 400 mg</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Entries List */}
            <div>
                <h3 className="font-bold mb-3">Entradas ({entries.length})</h3>
                {entries.length === 0 ? (
                    <div className="text-center py-8 text-secondary">
                        <Icons.Book className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No hay entradas hoy</p>
                        <p className="text-sm">Ve a "Entrada" para registrar alimentos</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="bg-card border border-theme rounded-xl p-3 flex justify-between items-start"
                            >
                                <div className="flex-1">
                                    <div className="font-bold text-primary capitalize">{entry.name}</div>
                                    <div className="text-sm text-secondary">
                                        {entry.quantity}x {entry.portion} • {Math.round(entry.calories * entry.quantity)} kcal
                                    </div>
                                    <div className="text-xs text-secondary">
                                        {new Date(entry.timestamp).toLocaleTimeString('es-ES', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <Icons.Trash className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
