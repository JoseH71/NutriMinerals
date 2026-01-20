import { useState } from 'react';
import { Icons } from './Icons';
import { searchLocalDB, FOOD_DATABASE, addCustomFood } from '../utils/foodDatabase';
import { saveDailyEntry } from '../utils/helpers';

export const EntryView = () => {
    const [search, setSearch] = useState('');
    const [selectedFood, setSelectedFood] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newFood, setNewFood] = useState({
        name: '', portion: '100g', calories: '', protein: '', carbs: '', fat: '', fiber: '', na: '', k: '', ca: '', mg: ''
    });

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

    const handleSaveCustom = () => {
        if (!newFood.name || !newFood.calories) return;

        const foodData = {
            portion: newFood.portion,
            calories: Number(newFood.calories),
            protein: Number(newFood.protein),
            carbs: Number(newFood.carbs),
            fat: Number(newFood.fat),
            fiber: Number(newFood.fiber),
            na: Number(newFood.na),
            k: Number(newFood.k),
            ca: Number(newFood.ca),
            mg: Number(newFood.mg)
        };

        if (addCustomFood(newFood.name, foodData)) {
            setIsCreating(false);
            handleSearch(newFood.name); // Auto-select the new food
            // Optional: reset form or keep it? Resetting is better.
            setNewFood({ name: '', portion: '100g', calories: '', protein: '', carbs: '', fat: '', fiber: '', na: '', k: '', ca: '', mg: '' });
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

            {/* Creation Mode */}
            {isCreating ? (
                <div className="bg-card border border-theme rounded-xl p-4 mb-6 animation-fade-in">
                    <h3 className="text-lg font-bold mb-4 text-primary">Crear Nuevo Alimento</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-secondary mb-1 block">Nombre del Alimento</label>
                            <input
                                type="text"
                                value={newFood.name}
                                onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                                className="w-full p-2 rounded-lg border border-theme bg-app text-primary"
                                placeholder="Ej: Mi Batido Especial"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-secondary mb-1 block">Porción Base</label>
                                <input
                                    type="text"
                                    value={newFood.portion}
                                    onChange={(e) => setNewFood({ ...newFood, portion: e.target.value })}
                                    className="w-full p-2 rounded-lg border border-theme bg-app text-primary"
                                    placeholder="Ej: 100g"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-secondary mb-1 block">Calorías</label>
                                <input
                                    type="number"
                                    value={newFood.calories}
                                    onChange={(e) => setNewFood({ ...newFood, calories: e.target.value })}
                                    className="w-full p-2 rounded-lg border border-theme bg-app text-primary"
                                />
                            </div>
                        </div>

                        {/* Macros */}
                        <div className="grid grid-cols-4 gap-2">
                            {['protein', 'carbs', 'fat', 'fiber'].map(macro => (
                                <div key={macro}>
                                    <label className="text-xs text-secondary mb-1 block capitalize">{macro}</label>
                                    <input
                                        type="number"
                                        value={newFood[macro]}
                                        onChange={(e) => setNewFood({ ...newFood, [macro]: e.target.value })}
                                        className="w-full p-2 rounded-lg border border-theme bg-app text-primary text-center"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Micros */}
                        <div className="grid grid-cols-4 gap-2">
                            {['na', 'k', 'ca', 'mg'].map(micro => (
                                <div key={micro}>
                                    <label className="text-xs text-secondary mb-1 block capitalize">{micro}</label>
                                    <input
                                        type="number"
                                        value={newFood[micro]}
                                        onChange={(e) => setNewFood({ ...newFood, [micro]: e.target.value })}
                                        className="w-full p-2 rounded-lg border border-theme bg-app text-primary text-center text-xs"
                                        placeholder="mg"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setIsCreating(false)}
                                className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-primary font-bold rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveCustom}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
                            >
                                Añadir a Catálogo
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Toggle Create Button (only if not viewing a food) */
                !selectedFood && (
                    <button
                        onClick={() => {
                            setIsCreating(true);
                            // Pre-fill name with search query if available
                            if (search) {
                                setNewFood(prev => ({ ...prev, name: search }));
                            }
                        }}
                        className="w-full mb-6 py-3 border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="text-xl">+</span> Crear Alimento Personalizado
                    </button>
                )
            )}

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

                    <button
                        onClick={() => {
                            setNewFood({
                                name: `${selectedFood.name} (Copia)`,
                                portion: quantity === 1 ? selectedFood.portion : 'Personalizado',
                                ...nutrients
                            });
                            setSelectedFood(null);
                            setIsCreating(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full mt-3 py-3 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                        Guardar en Catálogo
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
