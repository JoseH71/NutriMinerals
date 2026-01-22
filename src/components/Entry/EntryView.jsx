import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';
import MyFoodsView from '../Common/MyFoodsView';

// Helper to get unique sorted suggestions from history and today
// Helper to get unique suggestions from multiple sources
const getSuggestions = (today = [], myFoods = [], allLogs = [], searchHistory = []) => {
    const uniqueNames = new Set();

    // Static local DB keys for faster discovery
    const localKeys = ['naranja', 'pera', 'kiwi', 'pavo', 'pollo', 'ternera', 'pan', 'queso', 'leche', 'cafe', 'arroz', 'huevos', 'pasta', 'ensalada', 'atun'];
    localKeys.forEach(k => uniqueNames.add(k));

    // User's own data
    searchHistory.forEach(h => h && uniqueNames.add(h.trim().toLowerCase()));
    (myFoods || []).forEach(f => f.name && uniqueNames.add(f.name.trim().toLowerCase()));
    (today || []).forEach(l => l.name && uniqueNames.add(l.name.trim().toLowerCase()));
    (allLogs || []).forEach(l => l.name && uniqueNames.add(l.name.trim().toLowerCase()));

    return Array.from(uniqueNames);
};

const EntryView = ({ today, loading, searchFoods, addLog, query, setQuery, searchResults, firebaseError, deleteLog, entryDate, setEntryDate, myFoods, allLogs, onSaveFood, foodToEdit, onClearFoodToEdit, onDeleteFood }) => {
    // State for the Edit/Confirmation Modal
    const [selectedFood, setSelectedFood] = useState(null);
    const [showCatalog, setShowCatalog] = useState(false);
    const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', na: '', k: '', ca: '', mg: '', extraMinerals: [] });
    const [timeBlock, setTimeBlock] = useState('mañana');
    const [saltLevel, setSaltLevel] = useState('none');
    const [baseNa, setBaseNa] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [baseValues, setBaseValues] = useState(null);

    const [searchHistory, setSearchHistory] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('searchHistory') || '[]');
        } catch (e) {
            return [];
        }
    });

    const [showSuggestions, setShowSuggestions] = useState(false);

    const suggestions = useMemo(() =>
        getSuggestions(today, myFoods, allLogs, searchHistory),
        [today, myFoods, allLogs, searchHistory]
    );

    const filteredSuggestions = useMemo(() => {
        if (!query.trim()) return searchHistory.slice(0, 6);
        const q = query.toLowerCase();
        return suggestions
            .filter(s => s.toLowerCase().includes(q))
            .slice(0, 10);
    }, [suggestions, query, searchHistory]);

    const isToday = entryDate === new Date().toISOString().slice(0, 10);

    // Auto-set timeblock based on hour
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 14) setTimeBlock('mañana');
        else if (hour < 21) setTimeBlock('tarde');
        else setTimeBlock('noche');
    }, []);

    // Effect to handle external edit requests (e.g. from Catalog)
    useEffect(() => {
        if (foodToEdit) {
            handleSelectFood(foodToEdit);
            onClearFoodToEdit();
        }
    }, [foodToEdit, onClearFoodToEdit]);

    const handleSelectFood = (food) => {
        const initialNa = food.na || 0;
        setForm({ ...food });
        setBaseValues({ ...food });
        setBaseNa(initialNa);
        setSaltLevel('none');
        setQuantity(1);
        setSelectedFood(food);
    };

    const updateQuantity = (newQty) => {
        if (!baseValues || newQty < 0.25) return;
        setQuantity(newQty);
        const safeVal = (v) => Math.round((v || 0) * newQty);
        const scaledBaseNa = Math.round((baseValues.na || 0) * newQty);
        setBaseNa(scaledBaseNa);
        const saltAdd = saltLevel === 'none' ? 0 : saltLevel === 'low' ? 200 : saltLevel === 'normal' ? 500 : 900;
        setForm(prev => ({
            ...prev,
            calories: safeVal(baseValues.calories),
            protein: safeVal(baseValues.protein),
            carbs: safeVal(baseValues.carbs),
            fat: Math.round((baseValues.fat || 0) * newQty * 10) / 10,
            k: safeVal(baseValues.k),
            ca: safeVal(baseValues.ca),
            mg: safeVal(baseValues.mg),
            na: scaledBaseNa + saltAdd
        }));
    };

    const updateSalt = (level) => {
        setSaltLevel(level);
        const add = level === 'none' ? 0 : level === 'low' ? 200 : level === 'normal' ? 500 : 900;
        setForm(prev => ({ ...prev, na: baseNa + add }));
    };

    const handleSearch = (q = query) => {
        if (!q.trim()) return;

        // Update search history
        const newHistory = [
            q.trim(),
            ...searchHistory.filter(h => h.toLowerCase() !== q.trim().toLowerCase())
        ].slice(0, 30);

        setSearchHistory(newHistory);
        localStorage.setItem('searchHistory', JSON.stringify(newHistory));
        setShowSuggestions(false);

        searchFoods(q);
    };

    const clearAll = () => {
        setSelectedFood(null);
        setQuery('');
        searchFoods('');
        setShowSuggestions(false);
    };

    const handleSave = (e) => {
        e.preventDefault();
        addLog({
            ...form,
            timeBlock,
            calories: Number(form.calories),
            protein: Number(form.protein),
            carbs: Number(form.carbs),
            fat: Number(form.fat),
            na: Number(form.na),
            k: Number(form.k),
            ca: Number(form.ca),
            mg: Number(form.mg),
            portion: quantity !== 1 && baseValues ? `${quantity} x ${baseValues.portion || 'ración'}` : (form.portion || '1 ración')
        });
        clearAll();
    };

    if (showCatalog) {
        return (
            <div className="pb-20">
                <MyFoodsView
                    myFoods={myFoods}
                    onSave={onSaveFood}
                    onDelete={onDeleteFood}
                    onClose={() => setShowCatalog(false)}
                    onAddToLog={(food) => {
                        handleSelectFood(food);
                        setShowCatalog(false);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 animate-fade-in pb-20">
            {selectedFood ? (
                /* EDIT FORM MODAL */
                <div className="bg-card p-5 rounded-[2.5rem] border border-theme animate-fade-in shadow-2xl relative max-w-md mx-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-black text-lg text-primary">Detalle</h2>
                        <button onClick={clearAll} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-secondary hover:text-rose-500 transition-colors">
                            <Icons.X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="relative">
                            <input
                                className="w-full text-xl font-black bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-700 text-primary border-b border-theme focus:border-indigo-500 transition-all pb-1"
                                placeholder="Nombre..."
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>

                        {baseValues && (
                            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                                <div className="flex items-center gap-3">
                                    <button type="button" onClick={() => updateQuantity(quantity - 0.25)} className="w-9 h-9 bg-white dark:bg-indigo-900 shadow-sm border border-indigo-200 dark:border-indigo-700 rounded-lg font-black text-xl flex items-center justify-center transition-all active:scale-90 text-indigo-600">−</button>
                                    <div className="flex-1 text-center">
                                        <p className="text-xl font-black text-indigo-950 dark:text-indigo-50 leading-none">{quantity}x</p>
                                        <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">Ración</p>
                                    </div>
                                    <button type="button" onClick={() => updateQuantity(quantity + 0.25)} className="w-9 h-9 bg-white dark:bg-indigo-900 shadow-sm border border-indigo-200 dark:border-indigo-700 rounded-lg font-black text-xl flex items-center justify-center transition-all active:scale-90 text-indigo-600">+</button>
                                </div>
                            </div>
                        )}

                        <div className="flex bg-card-alt p-1 rounded-xl border border-theme">
                            {['mañana', 'tarde', 'noche'].map(block => (
                                <button key={block} type="button" onClick={() => setTimeBlock(block)}
                                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all capitalize ${timeBlock === block ? 'bg-indigo-600 text-white shadow-md' : 'text-secondary opacity-60'}`}>
                                    {block === 'mañana' ? '🌅' : block === 'tarde' ? '☀️' : '🌙'} {block}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                            {[
                                { label: 'Kcal', key: 'calories', color: 'orange' },
                                { label: 'Prot', key: 'protein', color: 'blue' },
                                { label: 'Carb', key: 'carbs', color: 'amber' },
                                { label: 'Fat', key: 'fat', color: 'rose' }
                            ].map(m => (
                                <div key={m.key} className={`bg-${m.color}-50/50 dark:bg-${m.color}-900/10 p-2 rounded-xl border border-${m.color}-100/50 dark:border-${m.color}-800/20 text-center`}>
                                    <label className={`text-[8px] font-black text-${m.color}-600 uppercase block mb-0.5`}>{m.label}</label>
                                    <input type="number" className={`w-full text-center bg-transparent font-black text-sm outline-none text-${m.color}-700 dark:text-${m.color}-300`} value={form[m.key]} onChange={e => setForm({ ...form, [m.key]: e.target.value })} />
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2 bg-card-alt p-2 rounded-xl border border-theme flex justify-between items-center">
                                <div>
                                    <label className="text-[9px] font-black text-primary uppercase flex items-center gap-1.5 italic">🧂 Sodio (Na) <span className="opacity-40 font-bold">mg</span></label>
                                    <p className="text-[7px] text-secondary font-bold opacity-60">Base {Math.round(baseNa)} + Sal {saltLevel === 'none' ? '0' : saltLevel === 'low' ? '200' : saltLevel === 'normal' ? '500' : '900'}</p>
                                </div>
                                <input type="number" className="w-20 text-right bg-transparent font-black text-2xl outline-none text-primary" value={Math.round(form.na)} onChange={e => setForm({ ...form, na: Number(e.target.value) })} />
                            </div>

                            <div className="col-span-2 grid grid-cols-3 gap-1.5">
                                <div className="bg-card-alt p-1.5 rounded-xl border border-theme text-center">
                                    <label className="text-[7px] font-bold text-emerald-600 uppercase">Potasio</label>
                                    <input type="number" className="w-full text-center bg-transparent font-black text-xs outline-none" value={form.k} onChange={e => setForm({ ...form, k: e.target.value })} />
                                </div>
                                <div className="bg-card-alt p-1.5 rounded-xl border border-theme text-center">
                                    <label className="text-[7px] font-bold text-rose-600 uppercase">Calcio</label>
                                    <input type="number" className="w-full text-center bg-transparent font-black text-xs outline-none" value={form.ca} onChange={e => setForm({ ...form, ca: e.target.value })} />
                                </div>
                                <div className="bg-card-alt p-1.5 rounded-xl border border-theme text-center">
                                    <label className="text-[7px] font-bold text-violet-600 uppercase">Magnesio</label>
                                    <input type="number" className="w-full text-center bg-transparent font-black text-xs outline-none" value={form.mg} onChange={e => setForm({ ...form, mg: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                            {[
                                { id: 'none', icon: '⬜', label: '0' },
                                { id: 'low', icon: '🟡', label: '1' },
                                { id: 'normal', icon: '🟢', label: '2' },
                                { id: 'high', icon: '🔴', label: '3' }
                            ].map(s => (
                                <button key={s.id} type="button" onClick={() => updateSalt(s.id)}
                                    className={`py-1.5 rounded-xl flex flex-col items-center border transition-all ${saltLevel === s.id ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800/30 border-theme text-secondary opacity-60'}`}>
                                    <span className="text-xs">{s.icon}</span>
                                    <span className="text-[7px] font-black uppercase tracking-widest">{s.id}</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button type="submit" className="col-span-2 bg-indigo-600 text-white py-3 rounded-2xl font-black shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all text-sm uppercase tracking-widest">
                                Añadir {timeBlock} ✨
                            </button>
                            {onSaveFood && (
                                <button type="button" onClick={() => onSaveFood({ ...form, portion: quantity !== 1 && baseValues ? `${quantity} x ${baseValues.portion || 'ración'}` : (form.portion || '1 ración') })}
                                    className="col-span-2 py-2 border border-dashed border-indigo-200 dark:border-indigo-800/50 text-indigo-400 font-bold rounded-xl flex items-center justify-center gap-2 text-[10px] hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors uppercase tracking-widest">
                                    <Icons.Save size={12} /> Guardar
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            ) : (
                /* SEARCH VIEW */
                <>
                    {/* Date Selector Header */}
                    <div className="flex justify-between items-center bg-card p-3 rounded-3xl border border-theme shadow-sm mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-2xl ${isToday ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                <Icons.Calendar size={22} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-secondary tracking-widest leading-none mb-1">Registro del día</p>
                                <p className="font-black text-sm">{isToday ? "Hoy" : entryDate.split('-').reverse().join('/')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => {
                                const d = new Date(entryDate + 'T00:00:00');
                                d.setDate(d.getDate() - 1);
                                setEntryDate(d.toISOString().slice(0, 10));
                            }} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-secondary active:scale-90 transition-all"><Icons.ChevronLeft size={20} /></button>
                            <button onClick={() => setEntryDate(new Date().toISOString().slice(0, 10))} className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-indigo-500/20">Hoy</button>
                            <button onClick={() => {
                                const d = new Date(entryDate + 'T00:00:00');
                                d.setDate(d.getDate() + 1);
                                if (d <= new Date()) setEntryDate(d.toISOString().slice(0, 10));
                            }} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-secondary active:scale-90 transition-all"><Icons.ChevronRight size={20} /></button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                <Icons.Search className="text-secondary opacity-40 group-focus-within:text-indigo-600 transition-colors" size={20} />
                            </div>
                            <input
                                type="text"
                                value={query}
                                onFocus={() => setShowSuggestions(true)}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch(query);
                                    if (e.key === 'Escape') setShowSuggestions(false);
                                }}
                                placeholder="¿Qué has comido?"
                                className="w-full p-3 pl-12 pr-12 rounded-[1.5rem] bg-card border border-theme text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-slate-300"
                                autoComplete="off"
                            />

                            {/* Autocomplete Suggestions */}
                            {showSuggestions && filteredSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-3 bg-card border border-theme rounded-[2rem] shadow-2xl z-[60] overflow-hidden animate-slide-up">
                                    <div className="p-3 border-b border-theme bg-card-alt/50 flex justify-between items-center">
                                        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] px-3">Sugerencias Recientes</p>
                                        <button
                                            onClick={() => setShowSuggestions(false)}
                                            className="p-1 hover:bg-theme rounded-full text-secondary"
                                        >
                                            <Icons.X size={14} />
                                        </button>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {filteredSuggestions.map((suggestion, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setQuery(suggestion);
                                                    handleSearch(suggestion);
                                                }}
                                                className="w-full px-6 py-4 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-between group transition-colors border-b border-theme/50 last:border-0"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <Icons.History size={16} className="text-secondary opacity-40 group-hover:text-indigo-500" />
                                                    <span className="font-bold text-primary group-hover:text-indigo-600 transition-colors">{suggestion}</span>
                                                </div>
                                                <Icons.ArrowUpLeft size={16} className="text-secondary opacity-40 -rotate-90 group-hover:text-indigo-500" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Overlay to close suggestions */}
                            {showSuggestions && (
                                <div
                                    className="fixed inset-0 z-[50]"
                                    onClick={() => setShowSuggestions(false)}
                                />
                            )}

                            <button onClick={() => handleSearch(query)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/40 transform active:scale-90 transition-all z-[65]">
                                {loading ? <Icons.Loader2 className="animate-spin" size={24} /> : <Icons.ArrowRight size={24} />}
                            </button>
                        </div>

                        {/* BIG Prominent Buttons */}
                        <div className="flex flex-col gap-4">
                            <input type="file" accept="image/*" capture="environment" className="hidden" id="camera-input" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) searchFoods('', file);
                            }} />
                            <label htmlFor="camera-input"
                                className="w-full p-6 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white rounded-[2rem] flex items-center justify-center gap-4 cursor-pointer shadow-xl shadow-indigo-500/20 active:scale-95 transition-all group">
                                <div className="p-3 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform">
                                    <Icons.Camera size={36} />
                                </div>
                                <div className="text-left">
                                    <span className="font-black text-lg block leading-tight">ESCANEAR PLATO</span>
                                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Reconocimiento por Foto</span>
                                </div>
                            </label>

                            <button onClick={() => setShowCatalog(true)}
                                className="w-full p-6 bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 text-white rounded-[2rem] flex items-center justify-center gap-4 shadow-xl shadow-teal-500/20 active:scale-95 transition-all group">
                                <div className="p-3 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform">
                                    <Icons.BookOpen size={36} />
                                </div>
                                <div className="text-left">
                                    <span className="font-black text-lg block leading-tight">MI CATÁLOGO</span>
                                    <span className="text-[10px] font-bold text-teal-200 uppercase tracking-widest">Alimentos Verificados</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* ERROR ALERT */}
                    {firebaseError && (
                        <div className="p-4 bg-rose-100 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 animate-pulse">
                            <Icons.AlertTriangle size={24} />
                            <div>
                                <p className="font-bold text-sm">Error de Búsqueda</p>
                                <p className="text-xs opacity-80">{firebaseError}</p>
                            </div>
                        </div>
                    )}

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="space-y-3 mt-8 animate-slide-up">
                            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] px-3 opacity-60">Resultados encontrados</p>
                            {searchResults.map((food, i) => (
                                <button key={i} onClick={() => handleSelectFood(food)}
                                    className="w-full p-6 bg-card rounded-[2.5rem] border border-theme text-left flex justify-between items-center shadow-md hover:border-indigo-500 transition-all group active:scale-[0.98]">
                                    <div className="flex-1 pr-4">
                                        <p className="font-black text-base uppercase tracking-tight text-primary group-hover:text-indigo-600 transition-colors">{food.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest opacity-70">{food.portion}</p>
                                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${food.confidence === 'alta' ? 'bg-emerald-100 text-emerald-700' :
                                                food.confidence === 'media' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                {food.confidence || 'estimado'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter leading-none">{Math.round(food.calories || 0)}</p>
                                        <p className="text-[10px] font-black text-secondary uppercase opacity-40">Kcal</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Quick Supplements */}
                    <div className="space-y-3 mt-10">
                        <div className="flex items-center gap-2 px-3">
                            <Icons.Zap size={16} className="text-indigo-600" />
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-60">Suplementación Express</p>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { name: 'Magnesio', icon: '💊', mg: 200, color: 'bg-violet-100 text-violet-700' },
                                { name: 'Taurina', icon: '⚡', mg: 1000, taurine: true, color: 'bg-amber-100 text-amber-700' },
                                { name: 'Evolate', icon: '💪', cal: 112, prot: 26, carbs: 1.2, fat: 0.5, na: 108, color: 'bg-blue-100 text-blue-700' },
                                { name: 'Evorecovery', icon: '🔋', cal: 163, prot: 14, carbs: 26.5, na: 838, k: 146, ca: 60, mg: 60, color: 'bg-emerald-100 text-emerald-700' }
                            ].map((s, i) => (
                                <button key={i} onClick={() => handleSelectFood({
                                    name: s.name,
                                    calories: s.cal || 0, protein: s.prot || 0, carbs: s.carbs || 0, fat: s.fat || 0,
                                    na: s.na || 0, k: s.k || 0, ca: s.ca || 0, mg: s.mg || 0,
                                    extraMinerals: s.taurine ? [{ label: 'Taurina', value: 1000 }] : [],
                                    portion: s.name === 'Magnesio' ? '200mg' : s.name === 'Taurina' ? '1000mg' : '1 scoop'
                                })} className="bg-card border border-theme p-4 rounded-3xl flex flex-col items-center gap-2 active:scale-90 transition-all shadow-sm border-b-4 border-slate-200 dark:border-slate-800">
                                    <span className="text-2xl">{s.icon}</span>
                                    <span className="text-[8px] font-black truncate w-full text-center uppercase tracking-tighter">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )
            }
        </div >
    );
};

export default EntryView;
