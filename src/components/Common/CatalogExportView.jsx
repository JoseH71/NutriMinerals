import React, { useState, useMemo, useRef } from 'react';
import * as Icons from 'lucide-react';

const CatalogExportView = ({ myFoods, onSave, onDelete, onAddToLog, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [exportText, setExportText] = useState('');
    const [copyStatus, setCopyStatus] = useState(null);
    const textareaRef = useRef(null);

    // Filtered list for display
    const myCatalogItems = useMemo(() => {
        const list = Array.isArray(myFoods) ? myFoods : [];
        if (!searchTerm.trim()) return list;
        const q = searchTerm.toLowerCase();
        return list.filter(item =>
            (item.name && item.name.toLowerCase().includes(q)) ||
            (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
        );
    }, [myFoods, searchTerm]);

    const handlePrepareExport = () => {
        const list = Array.isArray(myFoods) ? myFoods : [];
        if (list.length === 0) {
            alert("Tu catálogo está vacío. Guarda alimentos primero.");
            return;
        }

        const dateStr = new Date().toLocaleDateString();
        let text = `Hola IA. Soy Jose. Hoy es ${dateStr}. Aquí tienes mi CATÁLOGO DE NUTRICIÓN guardado.\n`;
        text += `VALIDA si los valores (Na, K, Ca, Mg) son correctos para estas porciones:\n\n`;
        text += `| ALIMENTO | PORCIÓN | KCAL | PROT | CARB | FAT | Na (mg) | K (mg) | Ca (mg) | Mg (mg) |\n`;
        text += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        list.forEach(item => {
            const row = [
                (item.name || 'Sin nombre').replace(/\|/g, '-'),
                (item.defaultPortion || '100g').replace(/\|/g, '-'),
                item.calories || 0,
                item.protein || 0,
                item.carbs || 0,
                item.fat || 0,
                item.na || 0,
                item.k || 0,
                item.ca || 0,
                item.mg || 0
            ].join(' | ');
            text += `| ${row} |\n`;
        });

        text += `\nInstrucción: Revisa si hay incoherencias en los minerales.`;

        setExportText(text);
        setIsExporting(true);
    };

    const handleCopy = async () => {
        if (!textareaRef.current) return;

        try {
            // Force focus and selection
            textareaRef.current.select();
            textareaRef.current.setSelectionRange(0, 99999);

            let success = false;
            // Try Clipboard API
            if (navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(exportText);
                    success = true;
                } catch (e) {
                    success = false;
                }
            }

            // Fallback to execCommand
            if (!success) {
                success = document.execCommand('copy');
            }

            if (success) {
                setCopyStatus('¡COPIADO!');
                setTimeout(() => setCopyStatus(null), 2000);
            } else {
                setCopyStatus('FALLO: COPIA A MANO');
            }
        } catch (err) {
            console.error('Copy error:', err);
            setCopyStatus('ERROR');
        }
    };

    return (
        <div className="space-y-4 animate-fade-in px-2 relative" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase italic">Mi Catálogo</h2>
                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Favoritos Guardados</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrepareExport} className="bg-emerald-500 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                            <Icons.Copy size={16} /> Exportar IA
                        </button>
                        {onClose && (
                            <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all">
                                <Icons.ArrowLeft size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary opacity-50" size={18} />
                <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-card border border-theme rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            {/* Catalog List */}
            <div className="space-y-3 pb-24">
                {myCatalogItems.map((item, idx) => (
                    <div key={idx} className="bg-card p-4 rounded-3xl border border-theme flex items-center gap-4 shadow-sm hover:border-indigo-500 transition-all group cursor-pointer active:scale-[0.98]" onClick={() => onAddToLog(item)}>
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600">
                            <Icons.PlusCircle size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-sm truncate uppercase text-primary">{item.name}</p>
                            <p className="text-[10px] font-bold text-secondary uppercase opacity-60">
                                {item.defaultPortion || '100g'} · {item.calories || 0} KCAL
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Exportación */}
            {isExporting && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsExporting(false)}></div>
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border-2 border-indigo-500">
                        <h3 className="text-2xl font-black text-primary uppercase mb-1">Exportar Catálogo</h3>
                        <p className="text-xs font-bold text-secondary mb-6">Copia la tabla y pégala directamente en la IA.</p>

                        <textarea
                            ref={textareaRef}
                            readOnly
                            value={exportText}
                            className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-800 border border-theme rounded-2xl text-[10px] font-mono whitespace-pre outline-none mb-6 resize-none"
                            onClick={(e) => {
                                e.target.select();
                                e.target.setSelectionRange(0, 99999);
                            }}
                        />

                        <div className="space-y-2">
                            <button onClick={handleCopy} className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${copyStatus ? 'bg-emerald-600 text-white' : 'bg-black text-white'}`}>
                                {copyStatus || 'Copiar Tabla'}
                            </button>
                            <button onClick={() => setIsExporting(false)} className="w-full py-4 text-secondary font-black text-xs uppercase">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogExportView;
