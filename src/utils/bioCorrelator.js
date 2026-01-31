/**
 * Bio-Correlator v4: "Technical Auditor"
 * Enfoque: Correlación directa, impacto en ms/bpm y filtrado de contexto humano.
 */

// Días Alterados: Si tienen alguno de estos síntomas, se excluyen del análisis
const ALTERED_DAY_FLAGS = ['enfermedad', 'mal_sueno', 'social', 'estres_vital'];

export const calculateBioCorrelations = (allLogs, intervalsData, dinnerFeedback = [], activitiesData = []) => {
    if (!intervalsData || intervalsData.length < 10) {
        return { hrv: [], fc: [], hasData: false };
    }

    // 1. Crear mapa de días alterados (basado en feedback del usuario)
    const alteredDays = new Set();
    dinnerFeedback.forEach(fb => {
        const dateKey = fb.dateISO || fb.id;
        if (fb.symptoms && fb.symptoms.some(s => ALTERED_DAY_FLAGS.includes(s))) {
            alteredDays.add(dateKey);
        }
    });

    // 2. Filtrado de Contexto Técnico + Humano
    const validWellness = intervalsData.filter(d => {
        const tss = d.training_load || d.icu_training_load || 0;
        const isAlteredDay = alteredDays.has(d.id);
        // Excluir: TSS extremo, días alterados marcados por el usuario, o sin HRV
        return tss < 150 && !isAlteredDay && d.hrv > 0;
    });

    const wellnessMap = {};
    validWellness.forEach(day => { wellnessMap[day.id] = day; });

    // 3. Procesamiento de Nutrientes Totales
    const dayData = {};
    if (allLogs && Array.isArray(allLogs)) {
        allLogs.forEach(log => {
            const date = log.dateISO || log.dateStr;
            if (!dayData[date]) {
                dayData[date] = {
                    kcal: 0, carbs: 0, fat: 0, protein: 0,
                    mg: 0, na: 0, k: 0, ca: 0,
                    dinnerCarbs: 0, dinnerFat: 0, dinnerKcal: 0
                };
            }
            const d = dayData[date];
            d.kcal += Number(log.calories) || 0;
            d.carbs += Number(log.carbs) || 0;
            d.protein += Number(log.protein) || 0;
            d.fat += Number(log.fat) || 0;
            d.mg += Number(log.mg) || 0;
            d.na += Number(log.na) || 0;
            d.k += Number(log.k) || 0;
            d.ca += Number(log.ca) || 0;

            if (log.timeBlock === 'noche') {
                d.dinnerKcal += Number(log.calories) || 0;
                d.dinnerCarbs += Number(log.carbs) || 0;
                d.dinnerFat += Number(log.fat) || 0;
            }
        });
    }

    // 3.5 Crear mapa de días CON actividad (gym o bici)
    const daysWithActivity = new Set();
    if (activitiesData && Array.isArray(activitiesData)) {
        activitiesData.forEach(act => {
            const dateStr = act.start_date_local?.split('T')[0];
            if (dateStr) {
                daysWithActivity.add(dateStr);
            }
        });
    }

    // 4. Matriz de Factores
    const factors = [
        { id: 'kcal', label: 'Kcal Totales' },
        { id: 'carbs', label: 'Carbohidratos' },
        { id: 'protein', label: 'Proteína' },
        { id: 'fat', label: 'Grasas' },
        { id: 'mg', label: 'Magnesio' },
        { id: 'k', label: 'Potasio' },
        { id: 'naK', label: 'Ratio Na/K', calc: (d) => d.k > 0 ? d.na / d.k : null },
        { id: 'caMg', label: 'Ratio Ca/Mg', calc: (d) => d.mg > 0 ? d.ca / d.mg : null },
        { id: 'dinnerKcal', label: 'Kcal Cena' },
        { id: 'dinnerCarbs', label: 'Carbos Cena' },
        { id: 'dinnerFat', label: 'Grasa Cena' },
        { id: 'density', label: 'Densidad Mineral', calc: (d) => d.kcal > 0 ? (d.mg + d.k / 10 + d.ca / 5) / d.kcal * 10 : null },
        // NUEVO: Factor de Descanso (días sin actividad registrada)
        { id: 'restDay', label: 'Día Descanso', calcFromActivity: true }
    ];

    // 5. Analizador de Impacto (High vs Low Split)
    const analyzeImpact = (metric) => {
        const results = factors.map(f => {
            const pairs = [];
            validWellness.forEach(today => {
                const dateObj = new Date(today.id);
                dateObj.setDate(dateObj.getDate() - 1);
                const yesterdayStr = dateObj.toISOString().split('T')[0];

                // También excluir si el día anterior fue alterado
                if (alteredDays.has(yesterdayStr)) return;

                // Para factor de descanso: verificar si ayer hubo actividad o no
                if (f.calcFromActivity) {
                    const hadActivity = daysWithActivity.has(yesterdayStr);
                    // 1 = día con actividad, 0 = día de descanso
                    pairs.push({ nutriVal: hadActivity ? 1 : 0, bioVal: today[metric] });
                    return;
                }

                const nutri = dayData[yesterdayStr];

                if (nutri) {
                    const val = f.calc ? f.calc(nutri) : nutri[f.id];
                    if (val !== null && val > 0) {
                        pairs.push({ nutriVal: val, bioVal: today[metric] });
                    }
                }
            });

            // Para descanso: días SIN actividad vs días CON actividad
            if (f.calcFromActivity) {
                const restMornings = pairs.filter(p => p.nutriVal === 0).map(p => p.bioVal);
                const trainMornings = pairs.filter(p => p.nutriVal === 1).map(p => p.bioVal);

                if (restMornings.length < 1 || trainMornings.length < 3) return null;

                const avgRest = restMornings.reduce((a, b) => a + b, 0) / restMornings.length;
                const avgTrain = trainMornings.reduce((a, b) => a + b, 0) / trainMornings.length;

                const diffAbs = avgRest - avgTrain;
                const diffRel = (diffAbs / (avgTrain || 1)) * 100;

                return {
                    label: f.label,
                    impact: diffRel,
                    absChange: diffAbs,
                    count: restMornings.length
                };
            }

            if (pairs.length < 8) return null;

            // Split por Mediana (para factores normales)
            const sortedNutri = pairs.map(p => p.nutriVal).sort((a, b) => a - b);
            const median = sortedNutri[Math.floor(sortedNutri.length / 2)];

            const highGroup = pairs.filter(p => p.nutriVal > median).map(p => p.bioVal);
            const lowGroup = pairs.filter(p => p.nutriVal <= median).map(p => p.bioVal);

            if (highGroup.length < 3 || lowGroup.length < 3) return null;

            const avgHigh = highGroup.reduce((a, b) => a + b, 0) / highGroup.length;
            const avgLow = lowGroup.reduce((a, b) => a + b, 0) / lowGroup.length;

            const diffAbs = avgHigh - avgLow;
            const diffRel = (diffAbs / avgLow) * 100;

            return {
                label: f.label,
                impact: diffRel,
                absChange: diffAbs,
                count: pairs.length
            };
        }).filter(Boolean);

        return results.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    };

    return {
        hrv: analyzeImpact('hrv'),
        fc: analyzeImpact('restingHR'),
        hasData: true,
        dataPoints: validWellness.length,
        excludedDays: alteredDays.size
    };
};
