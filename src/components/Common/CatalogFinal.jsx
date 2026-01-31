import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { db, APP_ID, SHARED_USER_ID } from '../../config/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

/* 
 * CATALOGO COMPACTO V14 - CON BÚSQUEDA EN BASES DE DATOS OFICIALES
 */
const CatalogFinal = ({ myFoods, allLogs = [], onSave, onDelete, onUse, onAddToLog, onClose }) => {
    // --- STATE ---
    const [view, setView] = useState('catalog'); // 'catalog', 'ranking', 'database', or 'topRanking'
    const [search, setSearch] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState(null);
    const [modalContent, setModalContent] = useState('');
    const [sortBy, setSortBy] = useState('calories'); // Nutrient to sort by in topRanking
    const [hiddenFromTop, setHiddenFromTop] = useState([]);
    const textareaRef = useRef(null);
    const searchInputRef = useRef(null);

    // Database Search State
    const [dbResults, setDbResults] = useState([]);
    const [dbLoading, setDbLoading] = useState(false);
    const [dbSearchTerm, setDbSearchTerm] = useState('');

    // Sync hiddenFromTop with Firebase (cross-device)
    useEffect(() => {
        if (!db) return;
        const docRef = doc(db, `artifacts/${APP_ID}/users/${SHARED_USER_ID}/settings`, 'hiddenFoods');
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setHiddenFromTop(data.list || []);
            }
        }, (err) => {
            console.error("Error loading hidden foods:", err);
            // Fallback to localStorage
            try {
                setHiddenFromTop(JSON.parse(localStorage.getItem('hiddenFromTop') || '[]'));
            } catch { setHiddenFromTop([]); }
        });
        return () => unsubscribe();
    }, []);

    // Save hiddenFromTop to Firebase
    const saveHiddenToFirebase = async (list) => {
        if (!db) return;
        try {
            const docRef = doc(db, `artifacts/${APP_ID}/users/${SHARED_USER_ID}/settings`, 'hiddenFoods');
            await setDoc(docRef, { list, updatedAt: Date.now() }, { merge: true });
        } catch (e) {
            console.error("Error saving hidden foods:", e);
        }
        // Also save to localStorage as backup
        localStorage.setItem('hiddenFromTop', JSON.stringify(list));
    };

    // Persist hidden foods to Firebase
    const hideFromTop = (foodName) => {
        const key = foodName?.trim().toLowerCase();
        if (!key) return;
        const updated = [...hiddenFromTop, key];
        setHiddenFromTop(updated);
        saveHiddenToFirebase(updated);
    };

    const restoreAllHidden = () => {
        setHiddenFromTop([]);
        saveHiddenToFirebase([]);
    };

    // --- EFFECTS ---
    useEffect(() => {
        // Auto-focus the search input when the component mounts
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // --- DERIVED DATA ---
    const rankingData = useMemo(() => {
        if (!allLogs?.length) return [];
        const foodMap = new Map();
        const sortedLogs = [...allLogs].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        sortedLogs.forEach(log => {
            const nameKey = log.name?.trim().toLowerCase();
            if (!nameKey || foodMap.has(nameKey)) return;

            foodMap.set(nameKey, {
                ...log,
                id: log.id,
                name: log.name,
                calories: Number(log.calories) || 0,
                protein: Number(log.protein) || 0,
                carbs: Number(log.carbs) || 0,
                fat: Number(log.fat) || 0,
                na: Number(log.na) || 0,
                k: Number(log.k) || 0,
                ca: Number(log.ca) || 0,
                mg: Number(log.mg) || 0,
                defaultPortion: log.portion || '100g'
            });
        });

        return Array.from(foodMap.values());
    }, [allLogs]);

    const safeMyFoods = Array.isArray(myFoods) ? myFoods : [];

    // Unified database: merge myFoods + history (unique by name)
    const unifiedDatabase = useMemo(() => {
        const foodMap = new Map();
        // Add catalog foods first (priority)
        safeMyFoods.forEach(f => {
            const key = f.name?.trim().toLowerCase();
            if (key && !foodMap.has(key)) foodMap.set(key, { ...f, source: 'catalog' });
        });
        // Add history foods
        rankingData.forEach(f => {
            const key = f.name?.trim().toLowerCase();
            if (key && !foodMap.has(key)) foodMap.set(key, { ...f, source: 'history' });
        });
        return Array.from(foodMap.values());
    }, [safeMyFoods, rankingData]);

    const visibleCatalogLog = useMemo(() => {
        let source;
        if (view === 'catalog') source = safeMyFoods;
        else if (view === 'ranking') source = rankingData;
        else source = unifiedDatabase; // topRanking uses unified

        const q = search.toLowerCase();
        let filtered = source.filter(f => (f.name || '').toLowerCase().includes(q));

        // Filter out hidden foods in topRanking view
        if (view === 'topRanking') {
            filtered = filtered.filter(f => !hiddenFromTop.includes(f.name?.trim().toLowerCase()));
        }

        // Sort based on view
        if (view === 'topRanking') {
            filtered.sort((a, b) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0));
        } else {
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }
        return filtered;
    }, [view, safeMyFoods, rankingData, unifiedDatabase, search, sortBy, hiddenFromTop]);

    // --- HANDLERS ---
    const handleExportIA = () => {
        if (safeMyFoods.length === 0) {
            alert("Tu catálogo está vacío.");
            return;
        }

        let text = `Hola IA. Soy Jose. Analiza y VALIDA mi CATÁLOGO DE NUTRICIÓN.\n`;
        text += `Verifica si los macros y minerales son coherentes para el alimento y la cantidad indicada.\n\n`;
        text += `| ALIMENTO | KCAL | PROT | CARB | FAT | Na | K | Ca | Mg | TAURINA |\n`;
        text += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        safeMyFoods.forEach(f => {
            // Find Taurina in extraMinerals if it exists
            const taurina = (f.extraMinerals || []).find(m => m.label?.toLowerCase().includes('taurina'))?.value || 0;

            // Only use the name/description as it already includes the quantity context
            const fullDescription = (f.name || 'S/N').replace(/\|/g, '-');

            const row = [
                fullDescription,
                Math.round(f.calories || 0),
                Math.round(f.protein || 0),
                Math.round(f.carbs || 0),
                Math.round(f.fat || 0),
                Math.round(f.na || 0),
                Math.round(f.k || 0),
                Math.round(f.ca || 0),
                Math.round(f.mg || 0),
                Math.round(taurina)
            ].join(' | ');
            text += `| ${row} |\n`;
        });

        text += `\nINSTRUCCIONES PARA LA IA:\n`;
        text += `1. Revisa si hay errores grandes en los macros o minerales comparado con bases de datos estándar.\n`;
        text += `2. Indica si alguna relación ración/calorías parece imposible.\n`;
        text += `3. Devuelve un listado de "Alimentos Correctos" y "Alimentos a Revisar".`;

        setModalContent(text);
        setShowExportModal(true);
    };

    // --- DATABASE SEARCH HANDLER ---
    const searchDatabase = async (query) => {
        if (!query || query.length < 2) return;
        setDbLoading(true);
        setDbResults([]);
        const results = [];

        // 1. BEDCA Core AMPLIADO (Base de datos española - PRIORITARIA)
        const bedcaCore = [
            // FRUTAS
            { name: 'Aguacate', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, na: 7, k: 485, ca: 12, mg: 29 },
            { name: 'Manzana', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, na: 1, k: 107, ca: 6, mg: 5 },
            { name: 'Naranja', calories: 47, protein: 0.9, carbs: 12, fat: 0.1, na: 0, k: 181, ca: 40, mg: 10 },
            { name: 'Plátano', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, na: 1, k: 358, ca: 5, mg: 27 },
            { name: 'Fresa', calories: 32, protein: 0.7, carbs: 8, fat: 0.3, na: 1, k: 153, ca: 16, mg: 13 },
            { name: 'Uva', calories: 69, protein: 0.7, carbs: 18, fat: 0.2, na: 2, k: 191, ca: 10, mg: 7 },
            { name: 'Sandía', calories: 30, protein: 0.6, carbs: 8, fat: 0.2, na: 1, k: 112, ca: 7, mg: 10 },
            { name: 'Melón', calories: 34, protein: 0.8, carbs: 8, fat: 0.2, na: 16, k: 267, ca: 9, mg: 12 },
            { name: 'Kiwi', calories: 61, protein: 1.1, carbs: 15, fat: 0.5, na: 3, k: 312, ca: 34, mg: 17 },
            { name: 'Pera', calories: 57, protein: 0.4, carbs: 15, fat: 0.1, na: 1, k: 116, ca: 9, mg: 7 },
            { name: 'Melocotón', calories: 39, protein: 0.9, carbs: 10, fat: 0.3, na: 0, k: 190, ca: 6, mg: 9 },
            { name: 'Piña', calories: 50, protein: 0.5, carbs: 13, fat: 0.1, na: 1, k: 109, ca: 13, mg: 12 },
            { name: 'Mandarina', calories: 53, protein: 0.8, carbs: 13, fat: 0.3, na: 2, k: 166, ca: 37, mg: 12 },
            { name: 'Cereza', calories: 63, protein: 1.1, carbs: 16, fat: 0.2, na: 0, k: 222, ca: 13, mg: 11 },
            { name: 'Higo fresco', calories: 74, protein: 0.8, carbs: 19, fat: 0.3, na: 1, k: 232, ca: 35, mg: 17 },
            { name: 'Granada', calories: 83, protein: 1.7, carbs: 19, fat: 1.2, na: 3, k: 236, ca: 10, mg: 12 },
            // VERDURAS Y HORTALIZAS
            { name: 'Tomate', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, na: 5, k: 237, ca: 10, mg: 11 },
            { name: 'Zanahoria', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, na: 69, k: 320, ca: 33, mg: 12 },
            { name: 'Brócoli', calories: 34, protein: 2.8, carbs: 7, fat: 0.4, na: 33, k: 316, ca: 47, mg: 21 },
            { name: 'Espinacas', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, na: 79, k: 558, ca: 99, mg: 79 },
            { name: 'Lechuga', calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, na: 28, k: 194, ca: 36, mg: 13 },
            { name: 'Pepino', calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1, na: 2, k: 147, ca: 16, mg: 13 },
            { name: 'Pimiento rojo', calories: 31, protein: 1, carbs: 6, fat: 0.3, na: 4, k: 211, ca: 7, mg: 12 },
            { name: 'Pimiento verde', calories: 20, protein: 0.9, carbs: 4.6, fat: 0.2, na: 3, k: 175, ca: 10, mg: 10 },
            { name: 'Cebolla', calories: 40, protein: 1.1, carbs: 9, fat: 0.1, na: 4, k: 146, ca: 23, mg: 10 },
            { name: 'Ajo', calories: 149, protein: 6.4, carbs: 33, fat: 0.5, na: 17, k: 401, ca: 181, mg: 25 },
            { name: 'Calabacín', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, na: 8, k: 261, ca: 16, mg: 18 },
            { name: 'Berenjena', calories: 25, protein: 1, carbs: 6, fat: 0.2, na: 2, k: 229, ca: 9, mg: 14 },
            { name: 'Coliflor', calories: 25, protein: 1.9, carbs: 5, fat: 0.3, na: 30, k: 299, ca: 22, mg: 15 },
            { name: 'Judías verdes', calories: 31, protein: 1.8, carbs: 7, fat: 0.1, na: 6, k: 211, ca: 37, mg: 25 },
            { name: 'Acelga', calories: 19, protein: 1.8, carbs: 3.7, fat: 0.2, na: 213, k: 379, ca: 51, mg: 81 },
            { name: 'Alcachofa', calories: 47, protein: 3.3, carbs: 11, fat: 0.2, na: 94, k: 370, ca: 44, mg: 60 },
            { name: 'Espárrago', calories: 20, protein: 2.2, carbs: 3.9, fat: 0.1, na: 2, k: 202, ca: 24, mg: 14 },
            { name: 'Champiñón', calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, na: 5, k: 318, ca: 3, mg: 9 },
            { name: 'Remolacha', calories: 43, protein: 1.6, carbs: 10, fat: 0.2, na: 78, k: 325, ca: 16, mg: 23 },
            { name: 'Col', calories: 25, protein: 1.3, carbs: 6, fat: 0.1, na: 18, k: 170, ca: 40, mg: 12 },
            // LEGUMBRES
            { name: 'Garbanzos cocidos', calories: 164, protein: 8.9, carbs: 27, fat: 2.6, na: 7, k: 291, ca: 49, mg: 48 },
            { name: 'Lentejas cocidas', calories: 116, protein: 9, carbs: 20, fat: 0.4, na: 2, k: 369, ca: 19, mg: 36 },
            { name: 'Judías blancas cocidas', calories: 127, protein: 8.7, carbs: 23, fat: 0.5, na: 2, k: 307, ca: 65, mg: 45 },
            { name: 'Alubias rojas cocidas', calories: 127, protein: 8.7, carbs: 22, fat: 0.5, na: 2, k: 403, ca: 28, mg: 45 },
            { name: 'Guisantes', calories: 81, protein: 5.4, carbs: 14, fat: 0.4, na: 5, k: 244, ca: 25, mg: 33 },
            { name: 'Habas', calories: 88, protein: 7.6, carbs: 15, fat: 0.6, na: 5, k: 250, ca: 25, mg: 38 },
            { name: 'Soja cocida', calories: 173, protein: 17, carbs: 10, fat: 9, na: 1, k: 515, ca: 102, mg: 86 },
            // CEREALES Y DERIVADOS
            { name: 'Arroz blanco cocido', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, na: 1, k: 35, ca: 10, mg: 12 },
            { name: 'Arroz integral cocido', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, na: 5, k: 43, ca: 10, mg: 44 },
            { name: 'Pan blanco', calories: 265, protein: 9, carbs: 49, fat: 3.2, na: 491, k: 115, ca: 52, mg: 28 },
            { name: 'Pan integral', calories: 247, protein: 13, carbs: 41, fat: 3.4, na: 450, k: 254, ca: 107, mg: 75 },
            { name: 'Pasta cocida', calories: 131, protein: 5, carbs: 25, fat: 1.1, na: 1, k: 44, ca: 7, mg: 18 },
            { name: 'Avena', calories: 389, protein: 17, carbs: 66, fat: 7, na: 2, k: 429, ca: 54, mg: 177 },
            { name: 'Quinoa cocida', calories: 120, protein: 4.4, carbs: 21, fat: 1.9, na: 7, k: 172, ca: 17, mg: 64 },
            { name: 'Maíz dulce', calories: 86, protein: 3.3, carbs: 19, fat: 1.2, na: 15, k: 270, ca: 2, mg: 37 },
            { name: 'Cuscús cocido', calories: 112, protein: 3.8, carbs: 23, fat: 0.2, na: 5, k: 58, ca: 8, mg: 8 },
            // FRUTOS SECOS Y SEMILLAS
            { name: 'Almendra tostada', calories: 579, protein: 21, carbs: 22, fat: 49, na: 1, k: 733, ca: 269, mg: 270 },
            { name: 'Nueces', calories: 654, protein: 15, carbs: 14, fat: 65, na: 2, k: 441, ca: 98, mg: 158 },
            { name: 'Avellana', calories: 628, protein: 15, carbs: 17, fat: 61, na: 0, k: 680, ca: 114, mg: 163 },
            { name: 'Anacardo', calories: 553, protein: 18, carbs: 30, fat: 44, na: 12, k: 660, ca: 37, mg: 292 },
            { name: 'Pistacho', calories: 560, protein: 20, carbs: 28, fat: 45, na: 1, k: 1025, ca: 105, mg: 121 },
            { name: 'Pipas de girasol', calories: 584, protein: 21, carbs: 20, fat: 51, na: 9, k: 645, ca: 78, mg: 325 },
            { name: 'Pipas de calabaza', calories: 559, protein: 30, carbs: 11, fat: 49, na: 7, k: 809, ca: 46, mg: 592 },
            { name: 'Semillas de chía', calories: 486, protein: 17, carbs: 42, fat: 31, na: 16, k: 407, ca: 631, mg: 335 },
            { name: 'Semillas de lino', calories: 534, protein: 18, carbs: 29, fat: 42, na: 30, k: 813, ca: 255, mg: 392 },
            { name: 'Cacahuete', calories: 567, protein: 26, carbs: 16, fat: 49, na: 18, k: 705, ca: 92, mg: 168 },
            // CARNES
            { name: 'Pechuga de pollo', calories: 165, protein: 31, carbs: 0, fat: 3.6, na: 74, k: 256, ca: 11, mg: 29 },
            { name: 'Muslo de pollo', calories: 209, protein: 26, carbs: 0, fat: 11, na: 84, k: 222, ca: 11, mg: 23 },
            { name: 'Pavo pechuga', calories: 135, protein: 30, carbs: 0, fat: 1, na: 63, k: 293, ca: 10, mg: 28 },
            { name: 'Ternera magra', calories: 158, protein: 28, carbs: 0, fat: 5, na: 56, k: 318, ca: 5, mg: 23 },
            { name: 'Cerdo lomo', calories: 143, protein: 27, carbs: 0, fat: 3.5, na: 62, k: 399, ca: 6, mg: 28 },
            { name: 'Jamón serrano', calories: 241, protein: 31, carbs: 0, fat: 13, na: 2100, k: 410, ca: 12, mg: 22 },
            { name: 'Jamón york', calories: 126, protein: 21, carbs: 1, fat: 4, na: 1100, k: 270, ca: 11, mg: 17 },
            { name: 'Chorizo', calories: 455, protein: 24, carbs: 2, fat: 38, na: 1470, k: 398, ca: 10, mg: 18 },
            { name: 'Salchichón', calories: 438, protein: 26, carbs: 2.5, fat: 36, na: 1850, k: 370, ca: 13, mg: 20 },
            { name: 'Cordero', calories: 294, protein: 25, carbs: 0, fat: 21, na: 72, k: 310, ca: 17, mg: 23 },
            { name: 'Conejo', calories: 173, protein: 33, carbs: 0, fat: 4, na: 45, k: 350, ca: 18, mg: 29 },
            // PESCADOS Y MARISCOS
            { name: 'Salmón', calories: 208, protein: 20, carbs: 0, fat: 13, na: 59, k: 363, ca: 12, mg: 27 },
            { name: 'Atún fresco', calories: 144, protein: 23, carbs: 0, fat: 5, na: 39, k: 252, ca: 16, mg: 50 },
            { name: 'Atún en aceite', calories: 198, protein: 29, carbs: 0, fat: 8.2, na: 354, k: 267, ca: 12, mg: 30 },
            { name: 'Bacalao fresco', calories: 82, protein: 18, carbs: 0, fat: 0.7, na: 54, k: 413, ca: 16, mg: 32 },
            { name: 'Merluza', calories: 86, protein: 17, carbs: 0, fat: 1.8, na: 89, k: 320, ca: 27, mg: 25 },
            { name: 'Sardinas en aceite', calories: 208, protein: 25, carbs: 0, fat: 11, na: 505, k: 397, ca: 382, mg: 39 },
            { name: 'Sardina fresca', calories: 140, protein: 18, carbs: 0, fat: 7.5, na: 100, k: 360, ca: 85, mg: 29 },
            { name: 'Caballa', calories: 205, protein: 19, carbs: 0, fat: 14, na: 90, k: 314, ca: 12, mg: 76 },
            { name: 'Boquerón', calories: 131, protein: 20, carbs: 0, fat: 5, na: 104, k: 383, ca: 147, mg: 41 },
            { name: 'Lubina', calories: 97, protein: 18, carbs: 0, fat: 2.5, na: 68, k: 256, ca: 10, mg: 30 },
            { name: 'Dorada', calories: 100, protein: 19, carbs: 0, fat: 2.5, na: 50, k: 330, ca: 25, mg: 27 },
            { name: 'Trucha', calories: 119, protein: 21, carbs: 0, fat: 3.5, na: 52, k: 361, ca: 67, mg: 26 },
            { name: 'Langostino', calories: 99, protein: 21, carbs: 0.2, fat: 1.1, na: 148, k: 185, ca: 52, mg: 37 },
            { name: 'Gamba', calories: 85, protein: 18, carbs: 0.9, fat: 0.6, na: 566, k: 220, ca: 79, mg: 39 },
            { name: 'Mejillón', calories: 86, protein: 12, carbs: 4, fat: 2.2, na: 286, k: 320, ca: 33, mg: 37 },
            { name: 'Calamar', calories: 92, protein: 16, carbs: 3, fat: 1.4, na: 44, k: 246, ca: 32, mg: 33 },
            { name: 'Pulpo', calories: 82, protein: 15, carbs: 2.2, fat: 1, na: 230, k: 350, ca: 53, mg: 30 },
            { name: 'Sepia', calories: 79, protein: 16, carbs: 0.8, fat: 0.7, na: 372, k: 354, ca: 90, mg: 30 },
            // LÁCTEOS
            { name: 'Leche entera', calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, na: 43, k: 132, ca: 113, mg: 10 },
            { name: 'Leche desnatada', calories: 34, protein: 3.4, carbs: 5, fat: 0.1, na: 52, k: 150, ca: 120, mg: 11 },
            { name: 'Leche semidesnatada', calories: 46, protein: 3.3, carbs: 4.8, fat: 1.6, na: 44, k: 140, ca: 115, mg: 10 },
            { name: 'Yogur natural', calories: 59, protein: 3.5, carbs: 4.7, fat: 3.3, na: 46, k: 155, ca: 121, mg: 12 },
            { name: 'Yogur griego', calories: 97, protein: 9, carbs: 3.6, fat: 5, na: 36, k: 141, ca: 100, mg: 11 },
            { name: 'Queso manchego', calories: 376, protein: 26, carbs: 0.5, fat: 30, na: 700, k: 100, ca: 848, mg: 28 },
            { name: 'Queso fresco', calories: 103, protein: 12, carbs: 3.3, fat: 4.5, na: 324, k: 104, ca: 144, mg: 10 },
            { name: 'Queso mozzarella', calories: 280, protein: 22, carbs: 2.2, fat: 17, na: 16, k: 76, ca: 505, mg: 20 },
            { name: 'Queso parmesano', calories: 431, protein: 38, carbs: 4, fat: 29, na: 1602, k: 92, ca: 1184, mg: 44 },
            { name: 'Requesón', calories: 98, protein: 11, carbs: 3.4, fat: 4.3, na: 359, k: 104, ca: 83, mg: 8 },
            { name: 'Nata', calories: 337, protein: 2.1, carbs: 2.8, fat: 35, na: 27, k: 69, ca: 65, mg: 6 },
            { name: 'Mantequilla', calories: 717, protein: 0.9, carbs: 0.1, fat: 81, na: 11, k: 24, ca: 24, mg: 2 },
            // HUEVOS
            { name: 'Huevo entero', calories: 155, protein: 13, carbs: 1.1, fat: 11, na: 124, k: 126, ca: 50, mg: 10 },
            { name: 'Clara de huevo', calories: 52, protein: 11, carbs: 0.7, fat: 0.2, na: 166, k: 163, ca: 7, mg: 11 },
            { name: 'Yema de huevo', calories: 322, protein: 16, carbs: 3.6, fat: 27, na: 48, k: 109, ca: 129, mg: 5 },
            // ACEITES Y GRASAS
            { name: 'Aceite de oliva', calories: 884, protein: 0, carbs: 0, fat: 100, na: 0, k: 0, ca: 0, mg: 0 },
            { name: 'Aceite de girasol', calories: 884, protein: 0, carbs: 0, fat: 100, na: 0, k: 0, ca: 0, mg: 0 },
            // OTROS
            { name: 'Cacao puro en polvo', calories: 228, protein: 19.6, carbs: 13.7, fat: 21, na: 21, k: 1524, ca: 128, mg: 499 },
            { name: 'Chocolate negro 70%', calories: 598, protein: 8, carbs: 46, fat: 43, na: 24, k: 715, ca: 73, mg: 228 },
            { name: 'Miel', calories: 304, protein: 0.3, carbs: 82, fat: 0, na: 4, k: 52, ca: 6, mg: 2 },
            { name: 'Patata cocida', calories: 86, protein: 1.7, carbs: 20, fat: 0.1, na: 4, k: 328, ca: 5, mg: 20 },
            { name: 'Patata frita', calories: 312, protein: 3.4, carbs: 41, fat: 15, na: 525, k: 532, ca: 15, mg: 28 },
            { name: 'Boniato', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, na: 55, k: 337, ca: 30, mg: 25 },
            { name: 'Tofu', calories: 76, protein: 8, carbs: 1.9, fat: 4.8, na: 7, k: 121, ca: 350, mg: 30 },
            { name: 'Hummus', calories: 166, protein: 8, carbs: 14, fat: 10, na: 379, k: 228, ca: 38, mg: 71 },
            { name: 'Aceitunas verdes', calories: 145, protein: 1, carbs: 4, fat: 15, na: 1556, k: 42, ca: 52, mg: 11 },
            { name: 'Aceitunas negras', calories: 115, protein: 0.8, carbs: 6, fat: 11, na: 735, k: 8, ca: 88, mg: 4 },
        ];
        const q = query.toLowerCase();
        bedcaCore.filter(f => f.name.toLowerCase().includes(q)).forEach(f => {
            results.push({ ...f, source: 'BEDCA', portion: '100g' });
        });

        // 2. Open Food Facts ESPAÑA (Solo productos en español)
        try {
            const offRes = await fetch(`https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12&lc=es`);
            if (offRes.ok) {
                const offData = await offRes.json();
                (offData.products || []).slice(0, 12).forEach(p => {
                    const n = p.nutriments || {};
                    const nombre = p.product_name_es || p.product_name;
                    if (nombre) {
                        results.push({
                            name: nombre + (p.brands ? ` (${p.brands})` : ''),
                            source: 'OFF',
                            calories: n['energy-kcal_100g'] || n['energy-kcal'] || 0,
                            protein: n.proteins_100g || 0,
                            carbs: n.carbohydrates_100g || 0,
                            fat: n.fat_100g || 0,
                            na: (n.sodium_100g || 0) * 1000,
                            k: n.potassium_100g || 0,
                            ca: n.calcium_100g || 0,
                            mg: n.magnesium_100g || 0,
                            portion: '100g',
                            barcode: p.code
                        });
                    }
                });
            }
        } catch (e) { console.warn('OFF search failed:', e); }

        // Sort: BEDCA first (always Spanish), then OFF
        results.sort((a, b) => {
            const aExact = a.name.toLowerCase().startsWith(q) ? 0 : 1;
            const bExact = b.name.toLowerCase().startsWith(q) ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
            const sourceOrder = { BEDCA: 0, OFF: 1 };
            return (sourceOrder[a.source] || 2) - (sourceOrder[b.source] || 2);
        });

        setDbResults(results.slice(0, 25));
        setDbLoading(false);
    };

    const handleCopy = () => {
        if (textareaRef.current) {
            textareaRef.current.select();
            document.execCommand('copy');
            setCopyFeedback('¡COPIADO!');
            setTimeout(() => setCopyFeedback(null), 2000);
        }
    };

    // --- RENDER ---
    return (
        <div className="space-y-3 animate-fade-in px-2 relative h-full flex flex-col">
            {/* Header Compacto */}
            <div className="bg-gradient-to-br from-indigo-600 to-slate-900 p-5 rounded-[2.2rem] text-white shadow-xl relative overflow-hidden shrink-0">
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <h2 className="text-xl font-black uppercase italic tracking-tighter">Catálogo</h2>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                            <button
                                onClick={() => setView('catalog')}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${view === 'catalog' ? 'bg-white text-indigo-900 shadow-md' : 'bg-white/10 text-white/60'}`}
                            >
                                Mi Selección
                            </button>
                            <button
                                onClick={() => setView('ranking')}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${view === 'ranking' ? 'bg-white text-indigo-900 shadow-md' : 'bg-white/10 text-white/60'}`}
                            >
                                Historial
                            </button>
                            <button
                                onClick={() => setView('database')}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 ${view === 'database' ? 'bg-cyan-400 text-cyan-900 shadow-md' : 'bg-cyan-500/20 text-cyan-300'}`}
                            >
                                <Icons.Database size={10} /> Base Datos
                            </button>
                            <button
                                onClick={() => setView('topRanking')}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 ${view === 'topRanking' ? 'bg-amber-400 text-amber-900 shadow-md' : 'bg-amber-500/20 text-amber-300'}`}
                            >
                                🏆 Top
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleExportIA}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                        >
                            <Icons.Copy size={12} /> IA
                        </button>
                        {onClose && (
                            <button onClick={onClose} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all text-white self-end">
                                <Icons.X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Barra de búsqueda compacta */}
            <div className="relative shrink-0">
                <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold outline-none shadow-sm text-black"
                    style={{ caretColor: 'black' }}
                />
            </div>

            {/* Nutrient Filter Buttons (only in topRanking view) */}
            {view === 'topRanking' && (
                <div className="shrink-0 bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">Ordenar por</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {[
                            { id: 'calories', label: 'Kcal', emoji: '🔥' },
                            { id: 'protein', label: 'Prot', emoji: '💪' },
                            { id: 'carbs', label: 'Carbs', emoji: '🌾' },
                            { id: 'fat', label: 'Grasa', emoji: '🥑' },
                            { id: 'mg', label: 'Mg', emoji: '⚡' },
                            { id: 'k', label: 'K', emoji: '🍌' },
                            { id: 'ca', label: 'Ca', emoji: '🦴' },
                            { id: 'na', label: 'Na', emoji: '🧂' },
                        ].map(n => (
                            <button
                                key={n.id}
                                onClick={() => setSortBy(n.id)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${sortBy === n.id
                                    ? 'bg-amber-400 text-amber-900 shadow-lg scale-105'
                                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-100'
                                    }`}
                            >
                                <span>{n.emoji}</span>
                                <span>{n.label}</span>
                            </button>
                        ))}
                    </div>
                    {hiddenFromTop.length > 0 && (
                        <button
                            onClick={restoreAllHidden}
                            className="mt-3 w-full py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-300 transition-all"
                        >
                            <Icons.RotateCcw size={12} />
                            Restaurar {hiddenFromTop.length} ocultos
                        </button>
                    )}
                </div>
            )}

            {/* DATABASE SEARCH VIEW */}
            {view === 'database' && (
                <div className="shrink-0 space-y-4 flex-1 overflow-y-auto pb-24">
                    {/* Database Search Input */}
                    <div className="bg-gradient-to-r from-cyan-50 to-slate-50 dark:from-cyan-900/20 dark:to-slate-900 p-5 rounded-3xl border-2 border-cyan-200 dark:border-cyan-800">
                        <p className="text-xs font-black text-cyan-600 uppercase tracking-widest mb-3 text-center">
                            🇪🇸 Buscar en BEDCA • Open Food Facts España
                        </p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="Ej: salmon, almendras, yogur..."
                                value={dbSearchTerm}
                                onChange={e => setDbSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && searchDatabase(dbSearchTerm)}
                                className="flex-1 px-5 py-4 bg-white dark:bg-slate-800 border-2 border-cyan-300 dark:border-cyan-700 rounded-2xl text-sm font-bold outline-none text-black dark:text-white"
                                style={{ caretColor: '#06b6d4' }}
                            />
                            <button
                                onClick={() => searchDatabase(dbSearchTerm)}
                                disabled={dbLoading || dbSearchTerm.length < 2}
                                className="px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl font-black uppercase text-xs flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-lg"
                            >
                                {dbLoading ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.Search size={18} />}
                                Buscar
                            </button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {dbLoading && (
                        <div className="text-center py-12">
                            <Icons.Loader2 className="w-12 h-12 animate-spin mx-auto text-cyan-500" />
                            <p className="text-sm font-bold text-slate-500 mt-3 uppercase">Consultando bases de datos...</p>
                        </div>
                    )}

                    {/* Results */}
                    {!dbLoading && dbResults.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">
                                {dbResults.length} resultados encontrados
                            </p>
                            {dbResults.map((food, idx) => (
                                <div
                                    key={idx}
                                    className="px-5 py-4 rounded-[1.5rem] border-2 bg-white dark:bg-slate-900 border-cyan-200 dark:border-cyan-800 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-all hover:border-cyan-400 shadow-sm"
                                    onClick={() => onAddToLog(food)}
                                >
                                    {/* Source Badge */}
                                    <div className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${food.source === 'BEDCA' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {food.source === 'OFF' ? '🛒' : '🇪🇸'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                                            {food.name}
                                        </h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                                            <span className="text-xs font-bold text-orange-600">{Math.round(food.calories)} kcal</span>
                                            <span className="text-xs font-bold text-slate-400">P:{Math.round(food.protein)}g</span>
                                            <span className="text-xs font-bold text-cyan-600">Mg:{Math.round(food.mg)}mg</span>
                                            <span className="text-xs font-bold text-amber-600">K:{Math.round(food.k)}mg</span>
                                        </div>
                                    </div>

                                    <div className="w-12 h-12 rounded-xl bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-lg">
                                        <Icons.Plus size={24} strokeWidth={3} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!dbLoading && dbResults.length === 0 && dbSearchTerm.length >= 2 && (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                            <Icons.SearchX className="w-14 h-14 mx-auto text-slate-300" />
                            <p className="text-sm font-bold text-slate-400 mt-3">Sin resultados para "{dbSearchTerm}"</p>
                        </div>
                    )}

                    {/* Initial State */}
                    {!dbLoading && dbResults.length === 0 && dbSearchTerm.length < 2 && (
                        <div className="text-center py-12 bg-gradient-to-br from-cyan-50 to-slate-50 dark:from-cyan-900/10 dark:to-slate-900 rounded-3xl border-2 border-dashed border-cyan-200 dark:border-cyan-800">
                            <Icons.Database className="w-14 h-14 mx-auto text-cyan-300" />
                            <p className="text-sm font-bold text-slate-500 mt-3">Busca en bases de datos españolas</p>
                            <div className="flex justify-center gap-3 mt-4">
                                <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-black">🇪🇸 BEDCA</span>
                                <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-black">🛒 Supermercado</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Lista de Alimentos COMPACTA (Sin macros/micros visibles) - NOT shown in database view */}
            {view !== 'database' && (
                <div className="flex-1 space-y-2 overflow-y-auto pb-24 px-1 scrollbar-hide">
                    {visibleCatalogLog.map((food, idx) => {
                        const nutrientLabels = {
                            calories: 'KCAL', protein: 'g PROT', carbs: 'g CARB', fat: 'g FAT',
                            mg: 'mg Mg', k: 'mg K', ca: 'mg Ca', na: 'mg Na'
                        };
                        const sortValue = Number(food[sortBy]) || 0;

                        return (
                            <div
                                key={idx}
                                className={`px-5 py-4 rounded-[2rem] border-2 transition-all group flex items-center justify-between shadow-sm active:scale-[0.99] cursor-pointer 
                            ${view === 'catalog'
                                        ? 'bg-white border-emerald-500 dark:bg-slate-900 dark:border-emerald-700'
                                        : view === 'topRanking'
                                            ? 'bg-gradient-to-r from-amber-50 to-white border-amber-300 dark:from-amber-900/20 dark:to-slate-900 dark:border-amber-700'
                                            : 'bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800'}`}
                                onClick={() => onAddToLog(food)}
                            >
                                {/* Ranking Position Badge */}
                                {view === 'topRanking' && (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs mr-3 shrink-0 ${idx === 0 ? 'bg-amber-400 text-amber-900' :
                                        idx === 1 ? 'bg-slate-300 text-slate-700' :
                                            idx === 2 ? 'bg-orange-300 text-orange-800' :
                                                'bg-slate-100 text-slate-500'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                )}

                                <div className="flex-1 min-w-0 pr-2">
                                    <h3 className={`font-black uppercase tracking-tight text-sm truncate ${view === 'catalog' ? 'text-black dark:text-white' : 'text-slate-900 dark:text-white'}`}>
                                        {food.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                                            {food.defaultPortion || food.portion || '100g'}
                                        </p>
                                        <span className={`w-1 h-1 rounded-full ${view === 'catalog' ? 'bg-emerald-300' : view === 'topRanking' ? 'bg-amber-300' : 'bg-slate-200'}`} />
                                        {view === 'topRanking' ? (
                                            <p className="text-[11px] font-black uppercase tracking-widest text-amber-600">
                                                {Math.round(sortValue)} {nutrientLabels[sortBy]}
                                            </p>
                                        ) : (
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${view === 'catalog' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                                {Math.round(food.calories)} KCAL
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {view === 'catalog' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`¿Seguro que quieres borrar "${food.name}"?`)) {
                                                    onDelete(food.id);
                                                }
                                            }}
                                            className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90 border border-rose-100"
                                        >
                                            <Icons.Trash2 size={20} />
                                        </button>
                                    )}
                                    {view === 'topRanking' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                hideFromTop(food.name);
                                            }}
                                            className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-rose-100 hover:text-rose-500 transition-all shadow-sm active:scale-90 border border-slate-200"
                                            title="Ocultar del Top"
                                        >
                                            <Icons.EyeOff size={16} />
                                        </button>
                                    )}
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${view === 'catalog' ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-lg' :
                                        view === 'topRanking' ? 'bg-amber-500 text-white shadow-amber-200 shadow-lg' :
                                            'bg-indigo-600 text-white shadow-indigo-200 shadow-lg'
                                        }`}>
                                        <Icons.Plus size={24} strokeWidth={4} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Exportación IA */}
            {showExportModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowExportModal(false)}></div>
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border-2 border-indigo-500 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">Exportar para IA</h3>
                            <button onClick={() => setShowExportModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:rotate-90 transition-all">
                                <Icons.X size={20} />
                            </button>
                        </div>

                        <textarea
                            ref={textareaRef}
                            readOnly
                            value={modalContent}
                            onClick={(e) => e.target.select()}
                            className="w-full h-80 p-6 bg-white border-2 border-slate-300 rounded-2xl text-[12px] font-mono outline-none mb-6 resize-none shadow-inner"
                            style={{ color: '#000000', backgroundColor: '#FFFFFF' }}
                        />

                        <div className="space-y-3">
                            <button
                                onClick={handleCopy}
                                className={`w-full py-6 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 border-2 border-slate-900 ${copyFeedback ? 'bg-emerald-400' : 'bg-white'}`}
                                style={{ color: '#000000' }}
                            >
                                {copyFeedback ? <Icons.Check size={24} style={{ color: '#000000' }} /> : <Icons.Copy size={24} style={{ color: '#000000' }} />}
                                <span style={{ color: '#000000' }}>{copyFeedback || 'COPIAR TABLA'}</span>
                            </button>
                            <button onClick={() => setShowExportModal(false)} className="w-full py-4 text-slate-500 font-black uppercase text-xs tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogFinal;
