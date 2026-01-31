import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';
import MyFoodsView from '../Common/CatalogFinal';

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
    const [editingId, setEditingId] = useState(null);
    const mainSearchRef = useRef(null);

    // --- EFFECTS ---
    // Auto-focus main search when selectedFood is null and showCatalog is false
    useEffect(() => {
        if (!selectedFood && !showCatalog && mainSearchRef.current) {
            mainSearchRef.current.focus();
        }
    }, [selectedFood, showCatalog]);

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

    // Effect to handle external edit requests (e.g. from Catalog or History)
    useEffect(() => {
        if (foodToEdit) {
            handleSelectFood(foodToEdit);
            if (foodToEdit.id) setEditingId(foodToEdit.id);
            if (foodToEdit.timeBlock) setTimeBlock(foodToEdit.timeBlock);
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
        if (!baseValues) return;
        // Don't scaling if newQty is 0 or negative during typing, but update state
        setQuantity(newQty);

        if (newQty < 0.1) return;

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
            // Scale extraMinerals (including Taurina)
            extraMinerals: (baseValues.extraMinerals || []).map(m => ({
                ...m,
                value: (m.value || 0) * newQty
            })),
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
        setEditingId(null);
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
        }, editingId);
        setSelectedFood(null);
        setEditingId(null);
    };

    if (showCatalog) {
        return (
            <div className="pb-20">
                <MyFoodsView
                    myFoods={myFoods}
                    allLogs={allLogs}
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
                /* EDIT FORM MODAL - ENLARGED & WHITE */
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-4 border-indigo-600 animate-fade-in shadow-2xl relative max-w-md mx-auto my-auto flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-black text-xl text-black uppercase italic">Detalle</h2>
                        <button onClick={() => setSelectedFood(null)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-secondary hover:text-rose-500 transition-all active:scale-90">
                            <Icons.X size={28} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="relative">
                            <input
                                className="w-full text-2xl font-black bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-700 text-black dark:text-white border-b-2 border-indigo-600 transition-all pb-2 mb-2"
                                placeholder="Nombre..."
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>

                        {baseValues && (
                            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-[2.5rem] border-2 border-indigo-200 dark:border-indigo-800/40 shadow-inner">
                                <div className="flex items-center gap-6">
                                    <button type="button" onClick={() => updateQuantity(quantity - 0.25)} className="w-12 h-12 bg-white dark:bg-indigo-900 shadow-sm border-2 border-indigo-200 dark:border-indigo-700 rounded-xl font-black text-2xl flex items-center justify-center transition-all active:scale-90 text-indigo-600">−</button>
                                    <div className="flex-1 text-center">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="number"
                                                step="0.25"
                                                className="w-24 bg-transparent text-4xl font-black text-black text-center outline-none tracking-tighter"
                                                value={quantity}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                    updateQuantity(val === '' ? 0 : val);
                                                }}
                                            />
                                            <span className="text-2xl font-black text-black -ml-2">x</span>
                                        </div>
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Cantidad Ración</p>
                                    </div>
                                    <button type="button" onClick={() => updateQuantity(quantity + 0.25)} className="w-12 h-12 bg-white dark:bg-indigo-900 shadow-sm border-2 border-indigo-200 dark:border-indigo-700 rounded-xl font-black text-2xl flex items-center justify-center transition-all active:scale-90 text-indigo-600">+</button>
                                </div>
                            </div>
                        )}

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl border-2 border-theme">
                            {['mañana', 'tarde', 'noche'].map(block => (
                                <button key={block} type="button" onClick={() => setTimeBlock(block)}
                                    className={`flex-1 py-4 text-sm font-black rounded-xl transition-all capitalize flex items-center justify-center gap-2 ${timeBlock === block ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 opacity-60'}`}>
                                    <span className="text-2xl">{block === 'mañana' ? '🌅' : block === 'tarde' ? '☀️' : '🌙'}</span>
                                    <span className={timeBlock === block ? 'text-white' : 'text-black'}>{block}</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Calorías', key: 'calories', color: 'orange', icon: '🔥', unit: 'kcal' },
                                { label: 'Proteína', key: 'protein', color: 'blue', icon: '💪', unit: 'g' },
                                { label: 'Carbos', key: 'carbs', color: 'amber', icon: '🍝', unit: 'g' },
                                { label: 'Grasas', key: 'fat', color: 'rose', icon: '🥑', unit: 'g' }
                            ].map(m => (
                                <div key={m.key} className="bg-white dark:bg-slate-800 p-4 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                                    <label className={`text-[11px] font-black text-${m.color}-600 uppercase block mb-0.5 tracking-[0.1em]`}>{m.icon} {m.label}</label>
                                    <div className="flex items-baseline gap-1">
                                        <input type="number" className="w-full bg-transparent font-black text-2xl outline-none text-black dark:text-white" value={form[m.key]} onChange={e => setForm({ ...form, [m.key]: e.target.value })} />
                                        <span className="text-[10px] font-black text-black/30 dark:text-white/30">{m.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white dark:bg-slate-900 px-8 py-10 rounded-[3.5rem] border-4 border-indigo-600 shadow-2xl flex justify-between items-center transition-all bg-gradient-to-r from-white to-indigo-50/30">
                                <div>
                                    <label className="text-xl font-black text-black uppercase flex items-center gap-2 italic">🧂 Sodio (Na) <span className="opacity-40 font-bold text-sm">mg</span></label>
                                    <p className="text-[14px] text-slate-500 font-bold uppercase tracking-widest mt-1">Base {Math.round(baseNa)} + Sal {saltLevel === 'none' ? '0' : saltLevel === 'low' ? '200' : saltLevel === 'normal' ? '500' : '900'}</p>
                                </div>
                                <input type="number" className="w-32 text-right bg-transparent font-black text-7xl outline-none text-black drop-shadow-sm" value={Math.round(form.na)} onChange={e => setForm({ ...form, na: Number(e.target.value) })} />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] border-2 border-slate-100 dark:border-slate-700 text-center shadow-md">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase block mb-0.5">Potasio (K)</label>
                                    <input type="number" className="w-full text-center bg-transparent font-black text-xl outline-none text-black dark:text-white" value={form.k} onChange={e => setForm({ ...form, k: e.target.value })} />
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] border-2 border-slate-100 dark:border-slate-700 text-center shadow-md">
                                    <label className="text-[10px] font-black text-rose-600 uppercase block mb-0.5">Calcio (Ca)</label>
                                    <input type="number" className="w-full text-center bg-transparent font-black text-xl outline-none text-black dark:text-white" value={form.ca} onChange={e => setForm({ ...form, ca: e.target.value })} />
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-[1.5rem] border-2 border-slate-100 dark:border-slate-700 text-center shadow-md">
                                    <label className="text-[10px] font-black text-violet-600 uppercase block mb-0.5">Magnesio</label>
                                    <input type="number" className="w-full text-center bg-transparent font-black text-xl outline-none text-black dark:text-white" value={form.mg} onChange={e => setForm({ ...form, mg: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Extra Minerals View (Taurina specific) */}
                        {(form.extraMinerals || []).map((m, idx) => (
                            <div key={idx} className="bg-amber-50/50 dark:bg-amber-900/10 p-5 rounded-[1.5rem] border-2 border-amber-100 dark:border-amber-800/30 flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">⚡</span>
                                    <div>
                                        <p className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">{m.label}</p>
                                        <p className="text-[10px] font-bold text-amber-600/50 uppercase">Suplemento Extra</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        step="100"
                                        className="w-24 text-right bg-transparent font-black text-3xl outline-none text-amber-600 dark:text-amber-300"
                                        value={m.value}
                                        onChange={e => {
                                            const newExtras = [...form.extraMinerals];
                                            newExtras[idx].value = Number(e.target.value);
                                            setForm({ ...form, extraMinerals: newExtras });
                                        }}
                                    />
                                    <span className="text-xs font-black text-amber-600/60 uppercase">mg</span>
                                </div>
                            </div>
                        ))}

                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { id: 'none', icon: '⬜', label: 'Sin Sal' },
                                { id: 'low', icon: '🟡', label: 'Baja' },
                                { id: 'normal', icon: '🟢', label: 'Normal' },
                                { id: 'high', icon: '🔴', label: 'Alta' }
                            ].map(s => (
                                <button key={s.id} type="button" onClick={() => updateSalt(s.id)}
                                    className={`py-3 rounded-2xl flex flex-col items-center border-2 transition-all ${saltLevel === s.id ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800/30 border-theme text-secondary opacity-60'}`}>
                                    <span className="text-xl">{s.icon}</span>
                                    <span className="text-[10px] font-black uppercase tracking-tight mt-1">{s.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button type="submit" className="col-span-2 bg-indigo-600 text-white py-5 rounded-[2rem] font-black shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all text-lg uppercase tracking-[0.1em] flex items-center justify-center gap-3">
                                {editingId ? <><Icons.Edit3 size={24} /> Actualizar Datos</> : <><Icons.PlusCircle size={24} /> Añadir a {timeBlock}</>}
                            </button>
                            {onSaveFood && (
                                <button type="button" onClick={() => onSaveFood({ ...form, portion: quantity !== 1 && baseValues ? `${quantity} x ${baseValues.portion || 'ración'}` : (form.portion || '1 ración') })}
                                    className="col-span-2 py-4 border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-500 dark:text-indigo-400 font-black rounded-2xl flex items-center justify-center gap-3 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all uppercase tracking-widest">
                                    <Icons.Save size={18} /> Guardar en Mi Catálogo
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
                                const d = new Date(entryDate + 'T12:00:00');
                                d.setDate(d.getDate() - 1);
                                setEntryDate(d.toLocaleDateString('sv')); // 'sv' locale is YYYY-MM-DD
                            }} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-secondary active:scale-90 transition-all"><Icons.ChevronLeft size={20} /></button>
                            <button onClick={() => setEntryDate(new Date().toLocaleDateString('sv'))} className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-indigo-500/20">Hoy</button>
                            <button onClick={() => {
                                const d = new Date(entryDate + 'T12:00:00');
                                d.setDate(d.getDate() + 1);
                                if (d <= new Date()) setEntryDate(d.toLocaleDateString('sv'));
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
                                ref={mainSearchRef}
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
                                className="w-full p-3 pl-12 pr-12 rounded-[1.5rem] bg-card border border-theme text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-slate-300 text-white"
                                style={{ caretColor: 'white' }}
                                autoComplete="off"
                            />

                            {/* Autocomplete Suggestions */}
                            {showSuggestions && query.trim().length > 0 && filteredSuggestions.length > 0 && (
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
                            <div className="flex justify-between items-center px-3 mb-1">
                                <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] opacity-60">Resultados encontrados ({searchResults.length})</p>
                                <button onClick={clearAll} className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 rounded-lg px-2 py-1 transition-colors">Limpiar</button>
                            </div>

                            {searchResults.map((food, i) => (
                                <div key={i} className="relative">
                                    <button onClick={() => handleSelectFood(food)}
                                        className="w-full p-6 bg-card rounded-[2.5rem] border border-theme text-left flex justify-between items-center shadow-md hover:border-indigo-500 transition-all group active:scale-[0.98]">
                                        <div className="flex-1 pr-12">
                                            <p className="font-black text-base uppercase tracking-tight text-primary group-hover:text-indigo-600 transition-colors line-clamp-1">{food.name}</p>
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

                                    {/* Quick Add Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            addLog({
                                                ...food,
                                                calories: Number(food.calories || 0),
                                                protein: Number(food.protein || 0),
                                                carbs: Number(food.carbs || 0),
                                                fat: Number(food.fat || 0),
                                                na: Number(food.na || 0),
                                                k: Number(food.k || 0),
                                                ca: Number(food.ca || 0),
                                                mg: Number(food.mg || 0),
                                            });
                                            // Optional: visual feedback
                                            const btn = e.currentTarget;
                                            btn.innerHTML = '✅';
                                            setTimeout(() => { if (btn) btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'; }, 1000);
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90 z-10"
                                        title="Añadir rápido"
                                    >
                                        <Icons.Plus size={20} strokeWidth={3} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quick Supplements */}
                    <div className="space-y-3 mt-10">
                        <div className="flex items-center gap-2 px-3">
                            <Icons.Zap size={16} className="text-indigo-600" />
                            <p className="text-[10px] font-black text-secondary uppercase tracking-widest opacity-60">Suplementación Express</p>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { name: 'Magnesio', icon: '💊', mg: 200, color: 'bg-violet-500', text: 'text-violet-500', light: 'bg-violet-100 dark:bg-violet-900/30', border: 'hover:border-violet-400/50' },
                                { name: 'Taurina', icon: '⚡', taurine: true, color: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-100 dark:bg-amber-900/30', border: 'hover:border-amber-400/50' },
                                { name: 'Evolate', icon: '💪', cal: 112, prot: 26, carbs: 1.2, fat: 0.5, na: 108, color: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30', border: 'hover:border-blue-400/50' },
                                { name: 'Recovery', icon: '🔋', cal: 163, prot: 14, carbs: 26.5, na: 838, k: 146, ca: 60, mg: 60, color: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'hover:border-emerald-400/50' }
                            ].map((s, i) => (
                                <button key={i} onClick={() => {
                                    if (s.taurine) {
                                        try {
                                            let amount = prompt('¿Cuántos gramos de Taurina? (ej: 0.5, 1)', '1');
                                            if (amount !== null) {
                                                amount = amount.trim().replace(',', '.');
                                                const val = parseFloat(amount);
                                                if (!isNaN(val) && val > 0) {
                                                    const mg = val * 1000;
                                                    handleSelectFood({
                                                        name: `Taurina ${val}g`,
                                                        calories: 0, protein: 0, carbs: 0, fat: 0,
                                                        na: 0, k: 0, ca: 0, mg: 0,
                                                        extraMinerals: [{ label: 'Taurina', value: mg }],
                                                        portion: `${val}g`
                                                    });
                                                } else {
                                                    alert('Por favor, introduce una cantidad válida (ej: 1 o 0.5)');
                                                }
                                            }
                                        } catch (e) {
                                            console.error("Error al añadir Taurina:", e);
                                        }
                                    } else {
                                        handleSelectFood({
                                            name: s.name,
                                            calories: s.cal || 0, protein: s.prot || 0, carbs: s.carbs || 0, fat: s.fat || 0,
                                            na: s.na || 0, k: s.k || 0, ca: s.ca || 0, mg: s.mg || 0,
                                            extraMinerals: [],
                                            portion: s.name === 'Magnesio' ? '200mg' : '1 scoop'
                                        });
                                    }
                                }} className={`relative group flex flex-col items-center gap-2 p-4 rounded-[2rem] border-2 transition-all active:scale-95 shadow-sm ${s.light} border-transparent ${s.border}`}>
                                    <div className={`p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                                        <span className="text-xl sm:text-2xl">{s.icon}</span>
                                    </div>
                                    <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter text-center ${s.text}`}>{s.name}</span>
                                    {/* Active glow effect */}
                                    <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br ${s.color}/10 opacity-0 group-hover:opacity-100 transition-opacity`}></div>
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
