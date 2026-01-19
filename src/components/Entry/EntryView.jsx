import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';

// Helper to get unique sorted suggestions
const getSuggestions = (today, myFoods = [], allLogs = []) => {
    const uniqueNames = new Set();

    // 1. Add "My Foods" (Favorites) - Highest priority
    (myFoods || []).forEach(f => f.name && uniqueNames.add(f.name.trim()));

    // 2. Add History (All Logs) - Recent first usually better, but Set insertion order matters less for sorting
    (allLogs || []).forEach(l => l.name && uniqueNames.add(l.name.trim()));

    return Array.from(uniqueNames).sort();
};

const EntryView = ({ today, loading, searchFoods, addLog, query, setQuery, searchResults, firebaseError, deleteLog, entryDate, setEntryDate, myFoods, allLogs }) => {
    // State for the Edit/Confirmation Modal
    const [selectedFood, setSelectedFood] = useState(null);
    const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', na: '', k: '', ca: '', mg: '', extraMinerals: [] });
    const [timeBlock, setTimeBlock] = useState('mañana');
    const [saltLevel, setSaltLevel] = useState('none'); // 'none', 'low', 'normal', 'high'
    const [baseNa, setBaseNa] = useState(0); // Store original Na to add salt on top
    const [quantity, setQuantity] = useState(1);
    const [baseValues, setBaseValues] = useState(null); // Store original values for multiplier

    const suggestions = useMemo(() => getSuggestions(today, myFoods, allLogs), [today, myFoods, allLogs]);

    const isToday = entryDate === new Date().toISOString().slice(0, 10);

    // Auto-set timeblock based on hour
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 14) setTimeBlock('mañana');
        else if (hour < 20) setTimeBlock('tarde');
        else setTimeBlock('noche');
    }, []);

    const handleSelectFood = (food) => {
        // Prepare form data
        const initialNa = food.na || 0;
        setForm({ ...food });
        setBaseValues({ ...food }); // Save for multiplication
        setBaseNa(initialNa);
        setSaltLevel('none');
        setQuantity(1);
        setSelectedFood(food);

        // Smart salt default?
        // app.html logic: restaurants->high, processed->none, others->normal
        // But user asked for buttons. Let's start at 'none' or 'normal' as per legacy logic if mapped.
        // Legacy logic:
        const lowerName = food.name.toLowerCase();
        const isProcessed = /burger|pizza|jamón|queso|pan|salsa|lata|bote/.test(lowerName);
        const isRestaurant = /restaurante|bar|tapa|ración/.test(lowerName);

        if (isRestaurant) {
            setSaltLevel('high');
            setForm(f => ({ ...f, na: initialNa + 900 }));
        } else if (isProcessed) {
            setSaltLevel('none');
            // no change to Na
        } else {
            setSaltLevel('normal'); // Home cooking default
            setForm(f => ({ ...f, na: initialNa + 500 }));
        }
    };

    const updateQuantity = (newQty) => {
        if (!baseValues || newQty < 0.25) return;
        setQuantity(newQty);

        // Scale macros
        const safeVal = (v) => Math.round((v || 0) * newQty);
        // Special logic for Salt: Scale base NA, then re-add current salt level
        const scaledBaseNa = Math.round((baseValues.na || 0) * newQty);
        setBaseNa(scaledBaseNa);

        const saltAdd = saltLevel === 'none' ? 0 : saltLevel === 'low' ? 200 : saltLevel === 'normal' ? 500 : 900;

        setForm(prev => ({
            ...prev,
            calories: safeVal(baseValues.calories),
            protein: safeVal(baseValues.protein),
            carbs: safeVal(baseValues.carbs),
            fat: Math.round((baseValues.fat || 0) * newQty * 10) / 10, // keep 1 decimal for fat
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

    const clearAll = () => {
        setSelectedFood(null);
        setQuery('');
        searchFoods(''); // Clears results in App.jsx
    };

    const handleSave = (e) => {
        e.preventDefault();
        addLog({
            ...form,
            timeBlock, // User selected time block
            // ensure numbers
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
        // Reset
        clearAll();
    };

    // Main Render
    return (
        <div className="p-4 space-y-6 animate-fade-in pb-20">
            {/* Modal / Edit Form Overlay */}
            {selectedFood ? (
                <div className="bg-card p-6 rounded-[2rem] border border-theme animate-fade-in shadow-2xl relative">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="font-black text-xl text-primary">Editar</h2>
                        <button onClick={clearAll} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-secondary hover:text-rose-500 transition-colors"><Icons.X /></button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Name Input */}
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <input
                                    className="w-full text-2xl font-black bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-700 text-primary border-b-2 border-transparent focus:border-indigo-500 transition-all pb-2"
                                    placeholder="Nombre del alimento..."
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                                <Icons.Edit className="absolute right-0 top-1 text-gray-300 w-5 h-5 pointer-events-none" />
                            </div>
                        </div>

                        {/* Quantity Multiplier */}
                        {baseValues && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Cantidad</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <button type="button" onClick={() => updateQuantity(quantity - 0.25)} className="w-8 h-8 bg-indigo-600 text-white rounded-lg font-black text-xl active:scale-95 transition-all">−</button>
                                    <input
                                        type="number"
                                        step="0.25"
                                        min="0.25"
                                        value={quantity}
                                        onChange={(e) => updateQuantity(parseFloat(e.target.value) || 1)}
                                        className="flex-1 text-center text-xl font-black text-indigo-900 dark:text-indigo-100 bg-white dark:bg-slate-800 rounded-lg py-1.5 outline-none border border-indigo-300 dark:border-indigo-700 focus:border-indigo-500"
                                    />
                                    <button type="button" onClick={() => updateQuantity(quantity + 0.25)} className="w-8 h-8 bg-indigo-600 text-white rounded-lg font-black text-xl active:scale-95 transition-all">+</button>
                                </div>
                                <p className="text-[8px] text-indigo-400 mt-1 text-center">Multiplicador de ración</p>
                            </div>
                        )}

                        {/* TIME BLOCK SELECTOR (Legacy) */}
                        <div className="flex bg-card-alt p-1 rounded-2xl border border-theme">
                            <button type="button" onClick={() => setTimeBlock('mañana')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${timeBlock === 'mañana' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-secondary hover:bg-slate-200 dark:hover:bg-slate-800'}`}>🌅 Mañana</button>
                            <button type="button" onClick={() => setTimeBlock('tarde')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${timeBlock === 'tarde' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-secondary hover:bg-slate-200 dark:hover:bg-slate-800'}`}>☀️ Tarde</button>
                            <button type="button" onClick={() => setTimeBlock('noche')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${timeBlock === 'noche' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-secondary hover:bg-slate-200 dark:hover:bg-slate-800'}`}>🌙 Noche</button>
                        </div>

                        {/* Macros Row */}
                        <div className="grid grid-cols-4 gap-2">
                            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl flex flex-col items-center">
                                <label className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">Kcal</label>
                                <input type="number" className="w-full text-center bg-transparent font-black text-lg text-orange-700 dark:text-orange-300 outline-none p-0" placeholder="0" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} />
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl flex flex-col items-center border border-theme">
                                <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Prot</label>
                                <input type="number" className="w-full text-center bg-transparent font-black text-lg text-blue-700 dark:text-blue-300 outline-none p-0" placeholder="0" value={form.protein} onChange={e => setForm({ ...form, protein: e.target.value })} />
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl flex flex-col items-center border border-theme">
                                <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Carb</label>
                                <input type="number" className="w-full text-center bg-transparent font-black text-lg text-amber-700 dark:text-amber-300 outline-none p-0" placeholder="0" value={form.carbs} onChange={e => setForm({ ...form, carbs: e.target.value })} />
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl flex flex-col items-center border border-theme">
                                <label className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">Grasa</label>
                                <input type="number" className="w-full text-center bg-transparent font-black text-lg text-rose-700 dark:text-rose-300 outline-none p-0" placeholder="0" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })} />
                            </div>
                        </div>

                        {/* Minerals Block */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Sodium Hero */}
                            <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-3xl border border-blue-100 dark:border-blue-800/50 flex justify-between items-center">
                                <div>
                                    <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1">
                                        <span className="text-base">💧</span> Sodio Total (Na)
                                    </label>
                                    <p className="text-[9px] text-blue-400 pl-6">Base {Math.round(baseNa)} + Sal {saltLevel === 'none' ? 0 : saltLevel === 'low' ? 200 : saltLevel === 'normal' ? 500 : 900}</p>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <input type="number" className="w-20 text-right bg-transparent font-black text-3xl text-blue-600 dark:text-blue-400 outline-none p-0" placeholder="0" value={Math.round(form.na)} onChange={e => setForm({ ...form, na: Number(e.target.value) })} />
                                    <span className="text-xs font-bold text-blue-400">mg</span>
                                </div>
                            </div>

                            <div className="bg-card-alt p-3 rounded-2xl border border-theme flex flex-col justify-center">
                                <label className="text-[10px] font-bold text-emerald-600 mb-1">Potasio (K)</label>
                                <input type="number" className="w-full bg-transparent font-bold text-lg text-primary outline-none" placeholder="0" value={form.k} onChange={e => setForm({ ...form, k: e.target.value })} />
                            </div>
                            <div className="bg-card-alt p-3 rounded-2xl border border-theme flex flex-col justify-center">
                                <label className="text-[10px] font-bold text-rose-600 mb-1">Calcio (Ca)</label>
                                <input type="number" className="w-full bg-transparent font-bold text-lg text-primary outline-none" placeholder="0" value={form.ca} onChange={e => setForm({ ...form, ca: e.target.value })} />
                            </div>
                            <div className="bg-card-alt p-3 rounded-2xl border border-theme flex flex-col justify-center col-span-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-violet-600">Magnesio (Mg)</label>
                                    <input type="number" className="w-20 text-right bg-transparent font-bold text-lg text-primary outline-none" placeholder="0" value={form.mg} onChange={e => setForm({ ...form, mg: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Salt Selector (Legacy) */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-end px-1">
                                <div>
                                    <h3 className="font-black text-sm text-primary flex items-center gap-2">🧂 Sal añadida <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">+ Sodio</span></h3>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                <button type="button" onClick={() => updateSalt('none')} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${saltLevel === 'none' ? 'bg-slate-800 text-white shadow-md transform scale-105' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 hover:bg-slate-200'}`}><span className="text-xl">⬜</span><span className="text-[8px] font-bold uppercase">Nada</span></button>
                                <button type="button" onClick={() => updateSalt('low')} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${saltLevel === 'low' ? 'bg-amber-100 text-amber-700 shadow-md transform scale-105 border-2 border-amber-400' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 hover:bg-amber-50'}`}><span className="text-xl">🟡</span><span className="text-[8px] font-bold uppercase">Poca</span></button>
                                <button type="button" onClick={() => updateSalt('normal')} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${saltLevel === 'normal' ? 'bg-emerald-100 text-emerald-700 shadow-md transform scale-105 border-2 border-emerald-500' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 hover:bg-emerald-50'}`}><span className="text-xl">🟢</span><span className="text-[8px] font-bold uppercase">Normal</span></button>
                                <button type="button" onClick={() => updateSalt('high')} className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${saltLevel === 'high' ? 'bg-rose-100 text-rose-700 shadow-md transform scale-105 border-2 border-rose-500' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 hover:bg-rose-50'}`}><span className="text-xl">🔴</span><span className="text-[8px] font-bold uppercase">Alta</span></button>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl active:scale-95 transition-all text-base flex items-center justify-center gap-2 hover:bg-indigo-700">
                            Guardar Registro ✨
                        </button>
                    </form>
                </div>
            ) : (
                /* Standard Search View */
                <>
                    {/* Date Selector Header */}
                    <div className="flex justify-between items-center bg-card p-3 rounded-2xl border border-theme shadow-sm mb-4">
                        <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-xl ${isToday ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                <Icons.Calendar size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Registrando para</p>
                                <p className="font-bold text-sm">{isToday ? "Hoy" : new Date(entryDate).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <input
                            type="date"
                            value={entryDate}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setEntryDate(e.target.value)}
                            className="bg-transparent border border-theme rounded-xl p-2 text-sm font-bold outline-none focus:ring-2 ring-indigo-500/20"
                        />
                    </div>

                    {firebaseError && (
                        <div className="bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 text-amber-600 dark:text-amber-400 text-xs font-bold shadow-sm">
                            <Icons.AlertTriangle size={20} />
                            <span>⚠️ Conexión limitada: {firebaseError}</span>
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="space-y-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                <Icons.Search className="text-secondary opacity-40 group-focus-within:text-indigo-600 transition-colors" size={22} />
                            </div>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchFoods(query)}
                                placeholder="¿Qué has comido hoy?"
                                className="w-full p-5 pl-14 pr-14 rounded-[2rem] bg-card border border-theme text-lg font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:opacity-30"
                                list="food-suggestions"
                            />
                            <datalist id="food-suggestions">
                                {suggestions.map((name, i) => (
                                    <option key={i} value={name} />
                                ))}
                            </datalist>
                            <button
                                onClick={() => searchFoods(query)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/30 active:scale-90 transition-all"
                            >
                                {loading ? <Icons.Loader2 className="animate-spin" size={20} /> : <Icons.ArrowRight size={20} />}
                            </button>
                            {query && (
                                <button
                                    onClick={clearAll}
                                    className="absolute right-16 top-1/2 -translate-y-1/2 p-2 text-secondary hover:text-rose-500 transition-colors"
                                >
                                    <Icons.X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Camera Button - Big and prominent */}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) searchFoods('', file);
                            }}
                            id="camera-input"
                        />
                        <label
                            htmlFor="camera-input"
                            className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl flex items-center justify-center gap-3 cursor-pointer hover:from-indigo-600 hover:to-purple-600 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/30"
                        >
                            <Icons.Camera size={28} />
                            <span className="font-bold text-sm uppercase tracking-wider">Escanear Plato con Foto</span>
                        </label>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="space-y-2 animate-slide-up">
                            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] px-2 opacity-60">Resultados de búsqueda</p>
                            {searchResults.map((food, i) => (
                                <div key={i} className="relative group">
                                    <button
                                        onClick={() => handleSelectFood(food)} // Open Modal
                                        className="w-full p-5 bg-card rounded-[2rem] border border-theme text-left hover:border-indigo-500 transition-all shadow-sm active:scale-[0.98]"
                                        type="button"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex-1 min-w-0 pr-6">
                                                <p className="font-black text-sm uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{food.name}</p>
                                                <p className="text-[10px] font-bold text-secondary mt-1 uppercase tracking-widest opacity-60">{food.portion} • {food.confidence}</p>
                                            </div>
                                            <div className="text-right ml-4">
                                                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{Math.round(food.calories || 0)}</p>
                                                <p className="text-[9px] font-black text-secondary uppercase opacity-40 -mt-1">Kcal</p>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); clearAll(); }}
                                        className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-all z-10 transform scale-90 hover:scale-110 active:scale-95"
                                        type="button"
                                    >
                                        <Icons.X size={16} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={clearAll} className="w-full py-3 text-[10px] font-black text-secondary uppercase tracking-widest hover:text-primary transition-colors">Limpiar búsqueda</button>
                        </div>
                    )}

                    {/* Quick Supplements */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-secondary uppercase tracking-widest px-2 opacity-60">💊 Suplementación Rápida</p>
                        <div className="grid grid-cols-4 gap-2">
                            {/* Buttons maintained from previous version */}
                            <button
                                onClick={() => {
                                    const input = window.prompt('💊 Magnesio\n\nCantidad (mg):', 200);
                                    if (input) {
                                        const qty = parseFloat(input) || 0;
                                        if (qty > 0) addLog({ name: 'Magnesio', calories: 0, protein: 0, carbs: 0, fat: 0, na: 0, k: 0, ca: 0, mg: qty, extraMinerals: [], portion: `${qty}mg`, dataSource: 'local' });
                                    }
                                }}
                                className="bg-card border border-theme p-3 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all hover:border-indigo-500 shadow-sm"
                            >
                                <span className="text-2xl">💊</span>
                                <span className="text-[9px] font-bold">Magnesio</span>
                                <span className="text-[8px] text-secondary bg-card-alt px-2 py-0.5 rounded-full">200mg</span>
                            </button>

                            <button
                                onClick={() => {
                                    const input = window.prompt('⚡ Taurina\n\nCantidad (mg):', 1000);
                                    if (input) {
                                        const qty = parseFloat(input) || 0;
                                        if (qty > 0) addLog({ name: 'Taurina', calories: 0, protein: 0, carbs: 0, fat: 0, na: 0, k: 0, ca: 0, mg: 0, extraMinerals: [{ label: 'Taurina', value: qty }], portion: `${qty}mg`, dataSource: 'local' });
                                    }
                                }}
                                className="bg-card border border-theme p-3 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all hover:border-indigo-500 shadow-sm"
                            >
                                <span className="text-2xl">⚡</span>
                                <span className="text-[9px] font-bold">Taurina</span>
                                <span className="text-[8px] text-secondary bg-card-alt px-2 py-0.5 rounded-full">1000mg</span>
                            </button>

                            <button
                                onClick={() => {
                                    const input = window.prompt('💪 Evolate (Whey Isolate)\n\n1 scoop = 30g (26g prot)\n\n¿Cuántos scoops?', 1);
                                    if (input) {
                                        const scoops = parseFloat(input) || 0;
                                        if (scoops > 0) addLog({
                                            name: `Evolate (${scoops} scoop)`,
                                            calories: Math.round(112 * scoops),
                                            protein: Math.round(26 * scoops),
                                            carbs: Math.round(1.2 * scoops),
                                            fat: Math.round(0.5 * scoops * 10) / 10,
                                            na: Math.round(108 * scoops),
                                            k: 0, ca: 0, mg: 0,
                                            extraMinerals: [],
                                            portion: `${scoops} scoop (${30 * scoops}g)`,
                                            dataSource: 'local'
                                        });
                                    }
                                }}
                                className="bg-card border border-theme p-3 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all hover:border-indigo-500 shadow-sm"
                            >
                                <span className="text-2xl">💪</span>
                                <span className="text-[9px] font-bold">Evolate</span>
                                <span className="text-[8px] text-secondary bg-card-alt px-2 py-0.5 rounded-full">Isolate</span>
                            </button>

                            <button
                                onClick={() => {
                                    const input = window.prompt('🔋 Evorecovery\n\n1 scoop = 50g\n14g prot + 27g carbs\n\n¿Cuántos scoops?', 1);
                                    if (input) {
                                        const scoops = parseFloat(input) || 0;
                                        if (scoops > 0) addLog({
                                            name: `Evorecovery (${scoops} scoop)`,
                                            calories: Math.round(163 * scoops),
                                            protein: Math.round(14 * scoops),
                                            carbs: Math.round(26.5 * scoops),
                                            fat: 0,
                                            na: Math.round(838 * scoops),
                                            k: Math.round(146 * scoops),
                                            ca: Math.round(60 * scoops),
                                            mg: Math.round(60 * scoops),
                                            extraMinerals: [],
                                            portion: `${scoops} scoop (${50 * scoops}g)`,
                                            dataSource: 'local'
                                        });
                                    }
                                }}
                                className="bg-card border border-theme p-3 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all hover:border-indigo-500 shadow-sm"
                            >
                                <span className="text-2xl">🔋</span>
                                <span className="text-[9px] font-bold truncate w-full text-center">Evorecovery</span>
                                <span className="text-[8px] text-secondary bg-card-alt px-2 py-0.5 rounded-full">Recovery</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default EntryView;
