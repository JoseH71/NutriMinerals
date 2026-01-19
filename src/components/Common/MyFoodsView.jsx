import React, { useState } from 'react';
import * as Icons from 'lucide-react';

const MyFoodsView = ({ myFoods, onSave, onDelete, onUse, onAddToLog }) => {
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editFood, setEditFood] = useState(null);
    const [form, setForm] = useState({
        name: '', defaultPortion: '100g',
        calories: '', protein: '', carbs: '', fat: '',
        na: '', k: '', ca: '', mg: '', tags: ''
    });
    const [baseNutrients, setBaseNutrients] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Search Open Food Facts API
    const searchOpenFoodFacts = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchResults([]);
        try {
            const url = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,nutriments,serving_size,brands`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.products && data.products.length > 0) {
                setSearchResults(data.products.slice(0, 8).map(p => ({
                    name: p.product_name || 'Sin nombre',
                    brand: p.brands || '',
                    portion: p.serving_size || '100g',
                    calories: p.nutriments?.['energy-kcal_100g'] || p.nutriments?.['energy-kcal'] || 0,
                    protein: p.nutriments?.proteins_100g || 0,
                    carbs: p.nutriments?.carbohydrates_100g || 0,
                    fat: p.nutriments?.fat_100g || 0,
                    na: (p.nutriments?.sodium_100g || 0) * 1000,
                    k: (p.nutriments?.potassium_100g || 0) * 1000,
                    ca: (p.nutriments?.calcium_100g || 0) * 1000,
                    mg: (p.nutriments?.magnesium_100g || 0) * 1000
                })));
            }
        } catch (e) {
            console.error('Open Food Facts error:', e);
        } finally {
            setSearching(false);
        }
    };

    const selectSearchResult = (result) => {
        const base = {
            calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat,
            na: result.na, k: result.k, ca: result.ca, mg: result.mg
        };
        setBaseNutrients(base);
        setForm({
            name: result.brand ? `${result.name} (${result.brand})` : result.name,
            defaultPortion: '100g',
            calories: Math.round(result.calories),
            protein: Math.round(result.protein),
            carbs: Math.round(result.carbs),
            fat: Math.round(result.fat),
            na: Math.round(result.na),
            k: Math.round(result.k),
            ca: Math.round(result.ca),
            mg: Math.round(result.mg),
            tags: ''
        });
        setSearchResults([]);
        setSearchQuery('');
    };

    const filteredFoods = myFoods
        .filter(f =>
            f.name.toLowerCase().includes(search.toLowerCase()) ||
            (f.tags && f.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
        )
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    const resetForm = () => {
        setForm({ name: '', defaultPortion: '100g', calories: '', protein: '', carbs: '', fat: '', na: '', k: '', ca: '', mg: '', tags: '' });
        setBaseNutrients(null);
        setEditFood(null);
        setShowForm(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleEdit = (food) => {
        setForm({
            name: food.name || '', defaultPortion: food.defaultPortion || '100g',
            calories: food.calories || '', protein: food.protein || '', carbs: food.carbs || '', fat: food.fat || '',
            na: food.na || '', k: food.k || '', ca: food.ca || '', mg: food.mg || '',
            tags: (food.tags || []).join(', ')
        });
        setBaseNutrients(null);
        setEditFood(food);
        setShowForm(true);
    };

    const handleSubmit = () => {
        if (!form.name.trim()) return;
        onSave({
            id: editFood?.id, name: form.name.trim(), defaultPortion: form.defaultPortion || '100g',
            calories: Number(form.calories) || 0, protein: Number(form.protein) || 0,
            carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0,
            na: Number(form.na) || 0, k: Number(form.k) || 0, ca: Number(form.ca) || 0, mg: Number(form.mg) || 0,
            tags: form.tags.split(',').map(t => t.trim()).filter(t => t),
            usageCount: editFood?.usageCount || 0
        });
        resetForm();
    };

    const [confirmingLog, setConfirmingLog] = useState(null);

    const handleQuickAdd = (food) => {
        onAddToLog(food);
    };

    return (
        <div className="space-y-4 animate-fade-in px-2">
            <div className="bg-gradient-to-br from-teal-600 to-emerald-700 p-6 rounded-[2rem] text-white shadow-xl">
                <h2 className="text-2xl font-black mb-1 flex items-center gap-2">🍎 <span className="tracking-tighter uppercase">Mis Alimentos</span></h2>
                <p className="text-teal-100 text-[10px] font-bold uppercase tracking-widest opacity-80">Tu catálogo personal verificado</p>
                <p className="text-teal-200 text-xs mt-3 font-bold bg-white/10 w-fit px-3 py-1 rounded-full">{myFoods.length} alimentos guardados</p>
            </div>

            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary opacity-50" size={18} />
                    <input type="text" placeholder="Buscar en mi catálogo..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-4 bg-card border border-theme rounded-2xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="px-5 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                    <Icons.PlusCircle />
                </button>
            </div>

            <div className="space-y-3 pb-20">
                {filteredFoods.length === 0 ? (
                    <div className="text-center py-16 bg-card rounded-3xl border-2 border-dashed border-theme opacity-60 shadow-inner">
                        <p className="text-5xl mb-4">🥗</p>
                        <p className="text-secondary font-black uppercase text-xs tracking-widest">{search ? 'Sin coincidencias' : 'Catálogo vacío'}</p>
                        <p className="text-[10px] text-secondary mt-1 font-bold">{search ? 'Prueba con otro nombre' : 'Empieza por añadir un alimento'}</p>
                    </div>
                ) : filteredFoods.map(food => (
                    <div key={food.id} className="bg-card p-4 rounded-3xl border border-theme flex items-center gap-4 shadow-sm hover:shadow-md transition-all group">
                        <button onClick={() => handleQuickAdd(food)}
                            className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl text-emerald-600 dark:text-emerald-400 active:scale-90 transition-all shadow-sm border border-emerald-200 dark:border-emerald-800"
                            title="Añadir a registro de hoy"><Icons.PlusCircle size={24} /></button>
                        <div className="flex-1 min-w-0" onClick={() => handleEdit(food)}>
                            <p className="font-black text-sm truncate uppercase tracking-tight text-primary">{food.name}</p>
                            <div className="flex gap-x-2 mt-1">
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-tighter bg-card-alt px-2 py-0.5 rounded-full border border-theme/50">{food.defaultPortion}</span>
                                <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-tighter">{Math.round(food.calories)} KCAL</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => onDelete(food.id)} className="p-2 text-secondary opacity-30 hover:opacity-100 hover:text-rose-500 transition-all">
                                <Icons.Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Form */}
            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm}></div>
                    <div className="relative bg-card w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh] border-t-4 border-emerald-500 sm:border-t-0">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black uppercase tracking-tighter">{editFood ? 'Editar Alimento' : 'Nuevo Alimento'}</h3>
                            <button onClick={resetForm} className="p-2 bg-card-alt rounded-full text-secondary"><Icons.X /></button>
                        </div>

                        {!editFood && (
                            <div className="mb-6 space-y-3">
                                <p className="text-[10px] font-black text-secondary uppercase tracking-widest pl-1">Buscador Inteligente</p>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Producto o Marca..." value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && searchOpenFoodFacts()}
                                        className="flex-1 p-3 bg-card-alt border border-theme rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                                    <button onClick={searchOpenFoodFacts} disabled={searching}
                                        className="px-4 py-3 bg-indigo-600 text-white rounded-xl active:scale-95 transition-all">
                                        {searching ? <Icons.Loader2 className="animate-spin" /> : <Icons.Search />}
                                    </button>
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="bg-card-alt rounded-2xl border border-theme overflow-hidden shadow-inner max-h-48 overflow-y-auto p-1">
                                        {searchResults.map((res, i) => (
                                            <button key={i} onClick={() => selectSearchResult(res)}
                                                className="w-full text-left p-3 hover:bg-emerald-500/10 rounded-xl transition-all border-b border-theme/50 last:border-0">
                                                <p className="text-xs font-black uppercase truncate">{res.name}</p>
                                                <p className="text-[10px] text-secondary font-bold truncate opacity-60">{res.brand || 'Marca genérica'}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1.5 block">Nombre del Alimento</label>
                                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full p-4 bg-card-alt border border-theme rounded-2xl text-sm font-black focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1.5 block">Porción (g/ml)</label>
                                    <input type="text" value={form.defaultPortion} onChange={e => setForm({ ...form, defaultPortion: e.target.value })}
                                        className="w-full p-4 bg-card-alt border border-theme rounded-2xl text-sm font-black focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1.5 block">Calorías (kcal)</label>
                                    <input type="number" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })}
                                        className="w-full p-4 bg-card-alt border border-theme rounded-2xl text-sm font-black text-orange-600 transition-all outline-none" />
                                </div>
                            </div>

                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest border-b border-theme pb-2 mb-3">Macronutrientes (g)</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-secondary uppercase mb-1 block">Proteína</label>
                                    <input type="number" value={form.protein} onChange={e => setForm({ ...form, protein: e.target.value })}
                                        className="w-full p-3 bg-card-alt border border-theme rounded-xl text-sm font-black outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-secondary uppercase mb-1 block">Carbos</label>
                                    <input type="number" value={form.carbs} onChange={e => setForm({ ...form, carbs: e.target.value })}
                                        className="w-full p-3 bg-card-alt border border-theme rounded-xl text-sm font-black outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-secondary uppercase mb-1 block">Grasa</label>
                                    <input type="number" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })}
                                        className="w-full p-3 bg-card-alt border border-theme rounded-xl text-sm font-black outline-none" />
                                </div>
                            </div>

                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest border-b border-theme pb-2 mb-3">Minerales Clave (mg)</p>
                            <div className="grid grid-cols-4 gap-2">
                                <div>
                                    <label className="text-[9px] font-black text-blue-500 uppercase mb-1 block">Na</label>
                                    <input type="number" value={form.na} onChange={e => setForm({ ...form, na: e.target.value })}
                                        className="w-full p-2 bg-card-alt border border-theme rounded-xl text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-emerald-500 uppercase mb-1 block">K</label>
                                    <input type="number" value={form.k} onChange={e => setForm({ ...form, k: e.target.value })}
                                        className="w-full p-2 bg-card-alt border border-theme rounded-xl text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-rose-500 uppercase mb-1 block">Ca</label>
                                    <input type="number" value={form.ca} onChange={e => setForm({ ...form, ca: e.target.value })}
                                        className="w-full p-2 bg-card-alt border border-theme rounded-xl text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-purple-500 uppercase mb-1 block">Mg</label>
                                    <input type="number" value={form.mg} onChange={e => setForm({ ...form, mg: e.target.value })}
                                        className="w-full p-2 bg-card-alt border border-theme rounded-xl text-sm font-bold outline-none" />
                                </div>
                            </div>

                            <button onClick={handleSubmit}
                                className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-4">
                                {editFood ? 'Guardar Cambios' : 'Añadir a Catálogo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyFoodsView;
