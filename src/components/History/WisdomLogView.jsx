import React, { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { GEMINI_API_KEY } from '../../config/firebase';

const WisdomLogView = ({ logs = [], summary, onSave, onSaveSummary, onDelete }) => {
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [expandedSource, setExpandedSource] = useState(null);
    const [activeTab, setActiveTab] = useState('global'); // 'global', 'nutricion', 'descanso', 'rendimiento'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const tabs = [
        { id: 'global', label: 'Global', icon: 'Globe' },
        { id: 'nutricion', label: 'Nutrición', icon: 'Utensils' },
        { id: 'descanso', label: 'Descanso', icon: 'Moon' },
        { id: 'rendimiento', label: 'Rendimiento', icon: 'Zap' }
    ];

    const processText = async () => {
        if (!inputText.trim()) return;
        setIsProcessing(true);
        setError(null);

        try {
            // 1. Analyze New Entry
            const analysisPrompt = `
                Analiza estas notas de salud/rendimiento: "${inputText}"
                Extrae aprendizajes clave, categorías y DATOS NUMÉRICOS ESPECÍFICOS (ej: "mejor HRV con 200g de arroz", "pulso 45 en reposo").
                Categoriza en: 'nutricion', 'descanso', o 'rendimiento'.
                Responde SOLO JSON: { "summary": "Resumen corto", "learnings": ["..."], "categories": ["..."], "dataPoints": ["..."] }
            `;

            const resEntry = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: analysisPrompt }] }] })
            });

            const dataEntry = await resEntry.json();
            const resultEntry = JSON.parse(dataEntry.candidates[0].content.parts[0].text.match(/\{[\s\S]*\}/)[0]);

            // 2. Update Global Wisdom (The "Feedback" part)
            const updatePrompt = `
                Eres una memoria maestra de salud personalizada.
                SABIDURÍA ACTUAL: ${summary ? JSON.stringify(summary) : "Ninguna"}
                NUEVO APRENDIZAJE: ${JSON.stringify(resultEntry)}
                
                TAREA: Integra el nuevo aprendizaje. 
                - Mantén registros de números específicos y qué es lo que mejor funciona (ej: cenas ideales, raciones exactas).
                - Organiza la respuesta por las 4 pestañas: 'global', 'nutricion', 'descanso', 'rendimiento'.
                - "globalSummary" debe ser un resumen ejecutivo.
                
                Responde SOLO JSON: 
                { 
                  "globalSummary": "...", 
                  "global": ["punto 1", "..."],
                  "nutricion": ["punto 1", "..."],
                  "descanso": ["punto 1", "..."],
                  "rendimiento": ["punto 1", "..."]
                }
            `;

            const resGlobal = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: updatePrompt }] }] })
            });

            const dataGlobal = await resGlobal.json();
            const resultGlobal = JSON.parse(dataGlobal.candidates[0].content.parts[0].text.match(/\{[\s\S]*\}/)[0]);

            // 3. Save Both
            await onSave({
                ...resultEntry,
                originalText: inputText,
                timestamp: Date.now()
            });

            await onSaveSummary({
                ...resultGlobal,
                lastUpdated: Date.now()
            });

            setInputText('');
        } catch (e) {
            console.error(e);
            setError("Error al procesar: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || isSearching) return;
        setIsSearching(true);
        setSearchResult(null);
        setError(null);

        try {
            const historyContext = logs.map(l => ({
                date: l.dateStr || new Date(l.timestamp).toLocaleDateString(),
                text: l.originalText,
                summary: l.summary,
                data: l.dataPoints
            }));

            const searchPrompt = `
                Eres un asistente experto en salud y rendimiento.
                CONTEXTO (Tus notas históricas):
                ${JSON.stringify(historyContext)}

                CONSULTA DEL USUARIO: "${searchQuery}"

                TAREA:
                1. Busca en las notas históricas cualquier información relevante para responder la consulta.
                2. Da una respuesta concisa, basada estrictamente en los datos de las notas.
                3. Si hay números (calorías, HRV, pulso), cítalos.
                4. Si no hay información suficiente, dilo educadamente.
                
                Responde en formato JSON:
                {
                    "answer": "Tu respuesta aquí...",
                    "relevantLogIds": ["Lista de fechas o summaries relacionados"]
                }
            `;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: searchPrompt }] }] })
            });

            const data = await res.json();
            const text = data.candidates[0].content.parts[0].text;
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                setSearchResult(JSON.parse(match[0]));
            } else {
                setSearchResult({ answer: text, relevantLogIds: [] });
            }
        } catch (e) {
            console.error("Search error:", e);
            setError("Error en la búsqueda: " + e.message);
        } finally {
            setIsSearching(false);
        }
    };

    const currentLearnings = useMemo(() => {
        if (!summary) return [];
        return summary[activeTab] || [];
    }, [summary, activeTab]);

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* SEARCH SECTION */}
            <div className="bg-gradient-to-br from-indigo-700 to-purple-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative group">
                <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Icons.Search size={200} className="text-white" />
                </div>

                <h2 className="text-xl font-black uppercase tracking-widest mb-6 flex items-center gap-3 text-white relative z-10">
                    <Icons.Brain size={24} className="text-purple-300" />
                    Consultor de Historial
                </h2>

                <div className="relative z-10 flex flex-col gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Ej: ¿Qué calorías me van mejor en bici?"
                            className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-white placeholder:text-white/40 font-bold focus:bg-white/20 focus:border-white/40 outline-none transition-all pr-14"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="absolute right-2 top-2 bottom-2 px-3 bg-white text-indigo-700 rounded-xl font-black hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSearching ? <Icons.Loader2 className="animate-spin" size={20} /> : <Icons.Search size={20} />}
                        </button>
                    </div>

                    {searchResult && (
                        <div className="p-6 bg-white/95 dark:bg-slate-900/95 rounded-3xl border border-white/20 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                <Icons.Sparkles size={14} /> Respuesta de tu Sabiduría
                            </h4>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed italic">
                                "{searchResult.answer}"
                            </p>
                            <button
                                onClick={() => setSearchResult(null)}
                                className="mt-4 text-[9px] font-black uppercase text-slate-400 hover:text-indigo-500 transition-all"
                            >
                                Limpiar búsqueda
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN WISDOM - The "Retroalimentada" one */}
            <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Icons.ShieldCheck size={150} className="text-indigo-500" />
                </div>

                <h2 className="text-xl font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-3 text-black dark:text-white relative z-10">
                    <Icons.Target size={24} className="text-indigo-600" />
                    Sabiduría Maestra Personalizada
                </h2>

                {summary ? (
                    <div className="relative z-10 space-y-6">
                        {/* Global Progress Line */}
                        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 italic leading-relaxed">
                                {summary.globalSummary}
                            </p>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-theme">
                            {tabs.map(tab => {
                                const Icon = Icons[tab.icon];
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${activeTab === tab.id
                                            ? 'bg-white dark:bg-slate-700 shadow-lg text-indigo-600'
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        <Icon size={18} />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Learnings for Active Tab */}
                        <div className="min-h-[150px] space-y-3">
                            {currentLearnings.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {currentLearnings.map((l, i) => (
                                        <div key={i} className="flex gap-3 items-start bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm animate-in fade-in duration-300">
                                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                            <p className="text-xs font-bold text-black dark:text-white leading-snug">{l}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-theme">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Sin datos específicos para esta sección todavía</p>
                                </div>
                            )}
                        </div>

                        <p className="text-[9px] font-black text-secondary opacity-30 text-right uppercase">
                            Memoria actualizada: {new Date(summary.lastUpdated).toLocaleString()}
                        </p>
                    </div>
                ) : (
                    <div className="p-12 text-center border-2 border-dashed border-indigo-100 dark:border-indigo-800 rounded-3xl">
                        <Icons.Brain size={48} className="mx-auto text-indigo-200 mb-4 animate-pulse" />
                        <p className="text-xs font-black text-indigo-300 uppercase tracking-[0.2em]">Alimentando la memoria colectiva...</p>
                    </div>
                )}
            </div>

            {/* INPUT SECTION */}
            <div className="bg-white dark:bg-slate-900 border-2 border-theme rounded-[2.5rem] p-8 shadow-xl">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-3 text-black dark:text-white">
                    <Icons.MessageSquareQuote size={20} className="text-purple-500" />
                    Nueva Entrada de Sabiduría
                </h3>
                <div className="relative">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Ej: 'Cena de ayer: 150g patata + 100g pavo -> HRV subió de 45 a 65. Pulso medio 52.'"
                        className="w-full h-48 bg-slate-50 dark:bg-slate-800 border-2 border-theme rounded-3xl p-6 text-sm font-bold focus:ring-4 focus:ring-purple-500/20 transition-all resize-none text-black dark:text-white"
                    />
                    <button
                        onClick={processText}
                        disabled={isProcessing || !inputText.trim()}
                        className={`mt-4 w-full py-5 rounded-[1.5rem] font-black uppercase tracking-[0.3em] text-sm flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${isProcessing
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-purple-500/40'
                            }`}
                    >
                        {isProcessing ? <Icons.Loader2 size={20} className="animate-spin" /> : <Icons.Zap size={20} />}
                        {isProcessing ? "Evolucionando Memoria..." : "Fusionar con la Sabiduría"}
                    </button>
                    <p className="mt-3 text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">Aporta números y resultados para una mayor personalización</p>
                </div>
            </div>

            {/* SOURCES SECTION */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary opacity-60 ml-4 flex items-center gap-2">
                    <Icons.Archive size={14} />
                    Fuente de Datos & Registros
                </h3>

                <div className="grid grid-cols-1 gap-5">
                    {logs.map(log => {
                        const isExpanded = expandedSource === log.id;
                        return (
                            <div
                                key={log.id}
                                onClick={() => setExpandedSource(isExpanded ? null : log.id)}
                                className={`group bg-white dark:bg-slate-900 border-2 transition-all duration-300 cursor-pointer overflow-hidden rounded-[2.2rem] 
                                    ${isExpanded ? 'border-indigo-500 shadow-xl' : 'border-theme hover:border-indigo-300 shadow-sm'}
                                `}
                            >
                                <div className="p-6 flex justify-between items-center gap-4">
                                    <div className="flex items-center gap-5 min-w-0">
                                        <div className={`flex flex-col items-center justify-center min-w-[60px] h-[60px] rounded-2xl border-2 transition-colors
                                            ${isExpanded ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-50 dark:bg-slate-800 border-theme text-secondary'}
                                        `}>
                                            <p className="text-sm font-black leading-none">
                                                {log.dateStr ? log.dateStr.split('-')[2] : new Date(log.timestamp).getDate()}
                                            </p>
                                            <p className="text-[10px] font-black uppercase opacity-70 mt-1">
                                                {log.dateStr ? new Date(log.dateStr).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : new Date(log.timestamp).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}
                                            </p>
                                        </div>

                                        <div className="flex flex-col min-w-0">
                                            <p className={`text-sm font-black uppercase tracking-wide truncate ${isExpanded ? 'text-indigo-600' : 'text-black dark:text-white'}`}>
                                                {log.summary}
                                            </p>
                                            <div className="flex gap-2 mt-2">
                                                {log.categories?.map(c => (
                                                    <span key={c} className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-lg border border-theme">
                                                        {c}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('¿Eliminar esta fuente?')) onDelete(log.id);
                                            }}
                                            className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all"
                                        >
                                            <Icons.Trash2 size={22} />
                                        </button>
                                        <div className={`p-1 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-500' : 'text-slate-300'}`}>
                                            <Icons.ChevronDown size={24} />
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-7 pb-8 pt-2 animate-in slide-in-from-top-2 duration-300">
                                        <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-[2rem] border-2 border-theme relative">
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                <Icons.Quote size={50} className="text-secondary" />
                                            </div>
                                            <p className="text-[14px] font-bold text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed italic relative z-10">
                                                "{log.originalText}"
                                            </p>

                                            {log.dataPoints?.length > 0 && (
                                                <div className="mt-5 flex flex-wrap gap-3 pt-5 border-t border-theme-dark/10">
                                                    {log.dataPoints.map((dp, i) => (
                                                        <div key={i} className="bg-white dark:bg-slate-900 border-2 border-theme flex items-center gap-2.5 px-4 py-2 rounded-2xl shadow-sm">
                                                            <span className="text-sm">📊</span>
                                                            <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400">
                                                                {dp}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WisdomLogView;
