// Local food database - Values per STANDARD PORTION (USDA/BEDCA)
// Format: { portion, calories, protein, carbs, fat, fiber, na, k, ca, mg }

export const FOOD_DATABASE = {
    // 🌰 FRUTOS SECOS & SEMILLAS (porción 30g salvo indicado)
    'anacardos': { portion: '30g', calories: 165, protein: 5, carbs: 9, fat: 13, fiber: 1, na: 3, k: 187, ca: 10, mg: 73 },
    'almendras': { portion: '30g', calories: 173, protein: 6, carbs: 6, fat: 15, fiber: 4, na: 0, k: 200, ca: 76, mg: 76 },
    'nueces': { portion: '30g', calories: 196, protein: 5, carbs: 4, fat: 20, fiber: 2, na: 1, k: 125, ca: 28, mg: 45 },
    'nueces de brasil': { portion: '30g', calories: 196, protein: 4, carbs: 4, fat: 20, fiber: 2, na: 1, k: 187, ca: 48, mg: 113 },
    'pistachos': { portion: '30g', calories: 168, protein: 6, carbs: 8, fat: 14, fiber: 3, na: 1, k: 291, ca: 30, mg: 34 },
    'pipas de calabaza': { portion: '30g', calories: 158, protein: 8, carbs: 3, fat: 14, fiber: 2, na: 5, k: 229, ca: 14, mg: 156 },
    'crema de cacahuete': { portion: '30g', calories: 188, protein: 8, carbs: 6, fat: 16, fiber: 2, na: 136, k: 200, ca: 14, mg: 51 },
    'chia': { portion: '15g', calories: 73, protein: 2, carbs: 6, fat: 5, fiber: 5, na: 2, k: 60, ca: 94, mg: 50 },
    'cacao puro': { portion: '10g', calories: 23, protein: 2, carbs: 1, fat: 1, fiber: 3, na: 2, k: 150, ca: 13, mg: 50 },

    // 🥬 ENSALADAS & HOJAS VERDES (porción 100g)
    'rucula': { portion: '100g', calories: 25, protein: 3, carbs: 4, fat: 1, fiber: 2, na: 27, k: 369, ca: 160, mg: 47 },
    'espinaca': { portion: '100g', calories: 23, protein: 3, carbs: 4, fat: 0, fiber: 2, na: 79, k: 558, ca: 99, mg: 79 },
    'espinacas': { portion: '100g', calories: 23, protein: 3, carbs: 4, fat: 0, fiber: 2, na: 79, k: 558, ca: 99, mg: 79 },
    'arroz': { portion: '200g cocido', calories: 260, protein: 5, carbs: 56, fat: 1, fiber: 1, na: 2, k: 70, ca: 10, mg: 24 },

    // 🥦 VERDURAS & HORTALIZAS (porción 150-200g)
    'calabacin': { portion: '200g', calories: 34, protein: 2, carbs: 6, fat: 0, fiber: 2, na: 16, k: 518, ca: 32, mg: 36 },
    'zanahoria': { portion: '150g', calories: 62, protein: 1, carbs: 14, fat: 0, fiber: 4, na: 104, k: 480, ca: 50, mg: 18 },
    'coliflor': { portion: '200g', calories: 50, protein: 4, carbs: 10, fat: 0, fiber: 4, na: 60, k: 606, ca: 44, mg: 30 },
    'brocoli': { portion: '200g', calories: 68, protein: 6, carbs: 14, fat: 1, fiber: 5, na: 66, k: 632, ca: 94, mg: 42 },
    'cebolla': { portion: '100g', calories: 40, protein: 1, carbs: 9, fat: 0, fiber: 2, na: 4, k: 146, ca: 23, mg: 10 },
    'calabaza': { portion: '200g', calories: 52, protein: 2, carbs: 12, fat: 0, fiber: 1, na: 2, k: 680, ca: 42, mg: 24 },
    'tomate': { portion: '150g', calories: 27, protein: 1, carbs: 6, fat: 0, fiber: 2, na: 8, k: 356, ca: 15, mg: 17 },
    'ajo': { portion: '5g (1 diente)', calories: 7, protein: 0, carbs: 2, fat: 0, fiber: 0, na: 1, k: 20, ca: 9, mg: 1 },
    'setas': { portion: '150g', calories: 33, protein: 5, carbs: 5, fat: 0, fiber: 2, na: 8, k: 468, ca: 5, mg: 14 },
    'aguacate': { portion: '100g', calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, na: 7, k: 485, ca: 12, mg: 29 },
    'aceitunas': { portion: '30g', calories: 44, protein: 0, carbs: 2, fat: 4, fiber: 1, na: 312, k: 12, ca: 16, mg: 1 },
    'alcachofas': { portion: '200g', calories: 94, protein: 6, carbs: 21, fat: 0, fiber: 10, na: 188, k: 710, ca: 88, mg: 120 },
    'lentejas': { portion: '150g cocidas', calories: 173, protein: 13, carbs: 30, fat: 1, fiber: 12, na: 3, k: 545, ca: 28, mg: 54 },
    'garbanzos': { portion: '150g cocidos', calories: 245, protein: 13, carbs: 41, fat: 4, fiber: 11, na: 7, k: 413, ca: 72, mg: 72 },

    // 🍠 TUBÉRCULOS
    'patata': { portion: '200g', calories: 154, protein: 4, carbs: 36, fat: 0, fiber: 4, na: 12, k: 846, ca: 24, mg: 46 },
    'boniato': { portion: '200g', calories: 172, protein: 3, carbs: 40, fat: 0, fiber: 6, na: 110, k: 670, ca: 60, mg: 50 },
    'pure de patata': { portion: '200g', calories: 178, protein: 4, carbs: 36, fat: 2, fiber: 2, na: 86, k: 564, ca: 40, mg: 38 },

    // 🍎 FRUTA (porción estándar)
    'platano': { portion: '120g (1 unidad)', calories: 107, protein: 1, carbs: 27, fat: 0, fiber: 3, na: 1, k: 422, ca: 6, mg: 32 },
    'manzana': { portion: '180g (1 unidad)', calories: 94, protein: 0, carbs: 25, fat: 0, fiber: 4, na: 2, k: 195, ca: 11, mg: 9 },
    'naranja': { portion: '150g (1 unidad)', calories: 62, protein: 1, carbs: 15, fat: 0, fiber: 3, na: 0, k: 237, ca: 60, mg: 15 },
    'pera': { portion: '160g (1 unidad)', calories: 91, protein: 1, carbs: 24, fat: 0, fiber: 5, na: 2, k: 186, ca: 14, mg: 11 },
    'kiwi': { portion: '75g (1 unidad)', calories: 46, protein: 1, carbs: 11, fat: 0, fiber: 2, na: 2, k: 234, ca: 25, mg: 13 },
    'mandarina': { portion: '100g (2 unidades)', calories: 53, protein: 1, carbs: 13, fat: 0, fiber: 2, na: 2, k: 166, ca: 37, mg: 12 },
    'arandanos': { portion: '100g', calories: 57, protein: 1, carbs: 14, fat: 0, fiber: 2, na: 1, k: 77, ca: 6, mg: 6 },
    'frambuesas': { portion: '100g', calories: 52, protein: 1, carbs: 12, fat: 1, fiber: 7, na: 1, k: 151, ca: 25, mg: 22 },
    'datil medjoul': { portion: '40g (2 unidades)', calories: 111, protein: 1, carbs: 30, fat: 0, fiber: 3, na: 0, k: 267, ca: 26, mg: 22 },
    'miel': { portion: '20g', calories: 64, protein: 0, carbs: 17, fat: 0, fiber: 0, na: 1, k: 10, ca: 1, mg: 0 },
    'chocolate 82%': { portion: '20g', calories: 115, protein: 2, carbs: 6, fat: 10, fiber: 2, na: 4, k: 141, ca: 14, mg: 43 },

    // 🥛 LÁCTEOS & FERMENTADOS
    'yogur griego': { portion: '150g', calories: 146, protein: 14, carbs: 6, fat: 8, fiber: 0, na: 54, k: 220, ca: 165, mg: 17 },
    'yogur natural': { portion: '125g', calories: 77, protein: 5, carbs: 7, fat: 4, fiber: 0, na: 70, k: 234, ca: 183, mg: 17 },
    'kefir': { portion: '200ml', calories: 130, protein: 8, carbs: 10, fat: 6, fiber: 0, na: 88, k: 320, ca: 240, mg: 24 },
    'queso de burgos': { portion: '100g', calories: 174, protein: 15, carbs: 4, fat: 11, fiber: 0, na: 57, k: 112, ca: 186, mg: 11 },
    'queso semicurado': { portion: '30g', calories: 118, protein: 8, carbs: 0, fat: 9, fiber: 0, na: 180, k: 27, ca: 240, mg: 9 },

    // 🐟 PESCADOS & MARISCOS
    'berberechos': { portion: '60g escurrido', calories: 49, protein: 10, carbs: 2, fat: 1, fiber: 0, na: 384, k: 208, ca: 52, mg: 50 },
    'atun lata': { portion: '80g escurrido', calories: 97, protein: 22, carbs: 0, fat: 1, fiber: 0, na: 264, k: 200, ca: 10, mg: 26 },
    'bacalao': { portion: '150g', calories: 124, protein: 27, carbs: 0, fat: 1, fiber: 0, na: 90, k: 548, ca: 18, mg: 51 },
    'dorada': { portion: '150g', calories: 145, protein: 27, carbs: 0, fat: 4, fiber: 0, na: 68, k: 450, ca: 32, mg: 33 },
    'lubina': { portion: '150g', calories: 145, protein: 27, carbs: 0, fat: 4, fiber: 0, na: 104, k: 435, ca: 15, mg: 44 },
    'mero': { portion: '150g', calories: 146, protein: 28, carbs: 0, fat: 3, fiber: 0, na: 68, k: 540, ca: 14, mg: 47 },
    'salmon': { portion: '150g', calories: 277, protein: 30, carbs: 0, fat: 17, fiber: 0, na: 75, k: 540, ca: 11, mg: 39 },

    // 🍖 CARNES & HUEVOS
    'ternera': { portion: '150g', calories: 213, protein: 32, carbs: 0, fat: 9, fiber: 0, na: 68, k: 468, ca: 8, mg: 32 },
    'lomo de cerdo': { portion: '150g', calories: 206, protein: 33, carbs: 0, fat: 8, fiber: 0, na: 68, k: 538, ca: 6, mg: 38 },
    'pechuga de pollo': { portion: '150g', calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0, na: 74, k: 370, ca: 15, mg: 40 },
    'jamon iberico': { portion: '50g', calories: 159, protein: 16, carbs: 0, fat: 11, fiber: 0, na: 1050, k: 175, ca: 6, mg: 11 },
    'jamon york': { portion: '50g', calories: 73, protein: 9, carbs: 1, fat: 4, fiber: 0, na: 535, k: 148, ca: 5, mg: 9 },
    'embutido lomo': { portion: '50g', calories: 117, protein: 14, carbs: 0, fat: 7, fiber: 0, na: 550, k: 200, ca: 5, mg: 15 },
    'huevo': { portion: '60g (1 unidad)', calories: 86, protein: 6, carbs: 1, fat: 6, fiber: 0, na: 71, k: 69, ca: 28, mg: 6 },
    'huevos': { portion: '120g (2 unidades)', calories: 172, protein: 12, carbs: 1, fat: 12, fiber: 0, na: 142, k: 138, ca: 56, mg: 12 },

    // 🫒 GRASAS & ACEITES
    'aove': { portion: '15ml', calories: 135, protein: 0, carbs: 0, fat: 15, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 },
    'aceite de oliva': { portion: '15ml', calories: 135, protein: 0, carbs: 0, fat: 15, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 },
    'aceite de coco': { portion: '15ml', calories: 130, protein: 0, carbs: 0, fat: 14, fiber: 0, na: 0, k: 0, ca: 0, mg: 0 },
    'limon': { portion: '30ml zumo', calories: 7, protein: 0, carbs: 2, fat: 0, fiber: 0, na: 0, k: 38, ca: 3, mg: 2 },

    // ☕ BEBIDAS
    'te matcha': { portion: '2g', calories: 6, protein: 1, carbs: 1, fat: 0, fiber: 1, na: 0, k: 54, ca: 8, mg: 4 },
    'bebida de avena': { portion: '200ml', calories: 92, protein: 2, carbs: 16, fat: 3, fiber: 2, na: 80, k: 76, ca: 240, mg: 8 },
    'cafe': { portion: '100ml', calories: 2, protein: 0, carbs: 0, fat: 0, fiber: 0, na: 2, k: 49, ca: 2, mg: 6 }
};

// Function to access custom foods from localStorage
export const getCustomFoods = () => {
    try {
        const stored = localStorage.getItem('customFoods');
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
};

export const addCustomFood = (name, data) => {
    try {
        const foods = getCustomFoods();
        // Normalize key
        const key = name.toLowerCase().trim();
        foods[key] = { ...data, isCustom: true };
        localStorage.setItem('customFoods', JSON.stringify(foods));
        return true;
    } catch (e) {
        console.error('Error saving custom food:', e);
        return false;
    }
};

// Function to search local database (including custom foods)
export const searchLocalDB = (query) => {
    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!q) return null;

    // Combine static DB with custom foods
    const allFoods = { ...FOOD_DATABASE, ...getCustomFoods() };

    for (const [key, value] of Object.entries(allFoods)) {
        const k = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 1. Database item contains query (e.g. q="pata" matches k="patata") -> OK
        if (k.includes(q)) {
            return { name: key, ...value, confidence: value.isCustom ? 'personalizado' : 'alta (base local)' };
        }

        // 2. Query contains Database item (e.g. q="patata cocida" matches k="patata")
        // CRITICAL FIX: Only if q is not much longer than k, otherwise it's a complex phrase
        if (q.includes(k)) {
            const lengthDiff = q.length - k.length;
            // Allow only small suffixes (e.g. plural "s", "as") or very short extra words
            if (lengthDiff < 4) {
                return { name: key, ...value, confidence: value.isCustom ? 'personalizado' : 'alta (base local)' };
            }
        }
    }
    return null;
};
