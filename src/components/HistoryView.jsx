import { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { getHistoricalData } from '../utils/helpers';

export const HistoryView = () => {
    const [historicalData, setHistoricalData] = useState([]);
    const [selectedMetric, setSelectedMetric] = useState('calories');

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await getHistoricalData(7); // Last 7 days
            setHistoricalData(data);
        } catch (error) {
            console.error('Error loading history:', error);
            setHistoricalData([]);
        }
    };

    const metrics = [
        { id: 'calories', label: 'Calorías', unit: 'kcal', color: 'bg-indigo-500' },
        { id: 'protein', label: 'Proteína', unit: 'g', color: 'bg-pink-500' },
        { id: 'k', label: 'Potasio', unit: 'mg', color: 'bg-green-500' },
        { id: 'na', label: 'Sodio', unit: 'mg', color: 'bg-orange-500' },
    ];

    const getMaxValue = () => {
        if (historicalData.length === 0) return 1;
        const values = historicalData.map(d => d[selectedMetric] || 0);
        return Math.max(...values, 1);
    };

    const maxValue = getMaxValue();

    const getAverages = () => {
        if (historicalData.length === 0) return null;

        const totals = {
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

        historicalData.forEach(day => {
            Object.keys(totals).forEach(key => {
                totals[key] += day[key] || 0;
            });
        });

        const count = historicalData.length;
        Object.keys(totals).forEach(key => {
            totals[key] = Math.round(totals[key] / count);
        });

        return totals;
    };

    const averages = getAverages();

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Historial</h2>

            {/* Metric Selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {metrics.map(metric => (
                    <button
                        key={metric.id}
                        onClick={() => setSelectedMetric(metric.id)}
                        className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${selectedMetric === metric.id
                                ? `${metric.color} text-white`
                                : 'bg-gray-200 dark:bg-gray-700 text-secondary'
                            }`}
                    >
                        {metric.label}
                    </button>
                ))}
            </div>

            {/* Chart */}
            {historicalData.length > 0 ? (
                <div className="bg-card border border-theme rounded-xl p-4 mb-6">
                    <h3 className="font-bold mb-4">Últimos 7 días</h3>
                    <div className="flex items-end justify-between gap-2 h-48">
                        {historicalData.map((day, index) => {
                            const value = day[selectedMetric] || 0;
                            const height = (value / maxValue) * 100;
                            const metric = metrics.find(m => m.id === selectedMetric);

                            return (
                                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="text-xs font-bold text-primary">{value}</div>
                                    <div className="w-full flex items-end justify-center h-40">
                                        <div
                                            className={`w-full ${metric.color} rounded-t-lg transition-all duration-300 hover:opacity-80`}
                                            style={{ height: `${height}%`, minHeight: value > 0 ? '4px' : '0' }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-secondary">
                                        {new Date(day.date).toLocaleDateString('es-ES', { weekday: 'short' })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-card border border-theme rounded-xl p-8 text-center mb-6">
                    <Icons.BarChart className="w-12 h-12 mx-auto mb-3 text-secondary opacity-50" />
                    <p className="text-secondary">No hay datos históricos aún</p>
                    <p className="text-sm text-secondary">Empieza a registrar alimentos para ver tu progreso</p>
                </div>
            )}

            {/* Averages */}
            {averages && (
                <div className="bg-card border border-theme rounded-xl p-4">
                    <h3 className="font-bold mb-3">Promedios (últimos 7 días)</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-app rounded-lg p-3">
                            <div className="text-xs text-secondary">Calorías</div>
                            <div className="text-xl font-bold text-primary">{averages.calories}</div>
                            <div className="text-xs text-secondary">kcal/día</div>
                        </div>
                        <div className="bg-app rounded-lg p-3">
                            <div className="text-xs text-secondary">Proteína</div>
                            <div className="text-xl font-bold text-primary">{averages.protein}g</div>
                            <div className="text-xs text-secondary">por día</div>
                        </div>
                        <div className="bg-app rounded-lg p-3">
                            <div className="text-xs text-secondary">Potasio</div>
                            <div className="text-xl font-bold text-primary">{averages.k}</div>
                            <div className="text-xs text-secondary">mg/día</div>
                        </div>
                        <div className="bg-app rounded-lg p-3">
                            <div className="text-xs text-secondary">Magnesio</div>
                            <div className="text-xl font-bold text-primary">{averages.mg}</div>
                            <div className="text-xs text-secondary">mg/día</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
