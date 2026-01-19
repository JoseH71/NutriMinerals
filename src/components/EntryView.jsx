import { useState } from 'react';
import { Icons } from './Icons';
import { searchLocalDB, FOOD_DATABASE } from '../utils/foodDatabase';
import { saveDailyEntry } from '../utils/helpers';

export const EntryView = () => {
    const [search, setSearch] = useState('');
    const [selectedFood, setSelectedFood] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSearch = (value) => {
        setSearch(value);
        if (value.trim()) {
            const result = searchLocalDB(value);
            setSelectedFood(result);
        } else {
            setSelectedFood(null);
        }
    };

    const handleSave = async () => {
        if (!selectedFood) return;

        const entry = {
            ...selectedFood,
            quantity,
            timestamp: new Date().toISOString(),
        };

        try {
            await saveDailyEntry(entry);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                setSearch('');
                setSelectedFood(null);
                setQuantity(1);
            }, 2000);
        } catch (error) {
            console.error('Error saving entry:', error);
        }
    };

    const calculateNutrients = () => {
        if (!selectedFood) return null;
        return {
            calories: Math.round(selectedFood.calories * quantity),
            protein: Math.round(selectedFood.protein * quantity),
            carbs: Math.round(selectedFood.carbs * quantity),
            fat: Math.round(selectedFood.fat * quantity),
            fiber: Math.round(selectedFood.fiber * quantity),
            na: Math.round(selectedFood.na * quantity),
            k: Math.round(selectedFood.k * quantity),
            ca: Math.round(selectedFood.ca * quantity),
            mg: Math.round(selectedFood.mg * quantity),
        };
    };

    const nutrients = calculateNutrients();

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Registrar Alimento</h2>

            {/* Search Input */}
            <div className="mb-6">
                <div className="relative">
                    <Icons.Search className="absolute left-3 top-3 text-secondary" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Buscar alimento (ej: almendras, espinacas...)"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-theme bg-card text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* Food Result */}
            {selectedFood && (
                <div className="bg-card border border-theme rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-primary capitalize">{selectedFood.name}</h3>
                            <p className="text-sm text-secondary">{selectedFood.portion}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                                className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 font-bold"
                            >
                                −
                            </button>
                            <span className="text-lg font-bold w-12 text-center">{quantity}x</span>
                            <button
                                onClick={() => setQuantity(quantity + 0.5)}
                                className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 font-bold"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Macros */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="bg-app rounded-lg p-2 text-center">
                            <div className="text-xs text-secondary">Calorías</div>
                            <div className="text-lg font-bold text-primary">{nutrients.calories}</div>
                        </div>
                        <div className="bg-app rounded-lg p-2 text-center">
                            <div className="text-xs text-secondary">Proteína</div>
                            <div className="text-lg font-bold text-primary">{nutrients.protein}g</div>
                        </div>
                        <div className="bg-app rounded-lg p-2 text-center">
                            <div className="text-xs text-secondary">Carbs</div>
                            <div className="text-lg font-bold text-primary">{nutrients.carbs}g</div>
                        </div>
                        <div className="bg-app rounded-lg p-2 text-center">
                            <div className="text-xs text-secondary">Grasa</div>
                            <div className="text-lg font-bold text-primary">{nutrients.fat}g</div>
                        </div>
                    </div>

                    {/* Minerals */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-app rounded-lg p-2">
                            <div className="text-xs text-secondary">Sodio (Na)</div>
                            <div className="font-bold text-primary">{nutrients.na} mg</div>
                        </div>
                        <div className="bg-app rounded-lg p-2">
                            <div className="text-xs text-secondary">Potasio (K)</div>
                            <div className="font-bold text-primary">{nutrients.k} mg</div>
                        </div>
                        <div className="bg-app rounded-lg p-2">
                            <div className="text-xs text-secondary">Calcio (Ca)</div>
                            <div className="font-bold text-primary">{nutrients.ca} mg</div>
                        </div>
                        <div className="bg-app rounded-lg p-2">
                            <div className="text-xs text-secondary">Magnesio (Mg)</div>
                            <div className="font-bold text-primary">{nutrients.mg} mg</div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                        Guardar Entrada
                    </button>
                </div>
            )}

            {/* Success Message */}
            {showSuccess && (
                <div className="fixed top-20 left-4 right-4 bg-green-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
                    <Icons.Check />
                    <span className="font-bold">¡Alimento guardado correctamente!</span>
                </div>
            )}

            {/* Quick Access */}
            {!search && (
                <div>
                    <h3 className="text-sm font-bold text-secondary mb-3">Alimentos Frecuentes</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.keys(FOOD_DATABASE).slice(0, 8).map((food) => (
                            <button
                                key={food}
                                onClick={() => handleSearch(food)}
                                className="p-3 bg-card border border-theme rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                            >
                                <div className="font-bold text-primary capitalize text-sm">{food}</div>
                                <div className="text-xs text-secondary">{FOOD_DATABASE[food].portion}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
