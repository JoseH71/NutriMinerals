/**
 * Dinner Intelligence System
 * Analyzes food tolerance patterns based on dinner logs and feedback history
 */

/**
 * Analyze food tolerance from dinner history
 * @param {Array} allLogs - All food logs
 * @param {Array} dinnerFeedback - Feedback data from Firestore
 * @param {Array} intervalsData - HRV/wellness data from Intervals.icu
 * @returns {Object} Analysis results with well-tolerated and problematic foods
 */
export const analyzeDinnerFoodTolerance = (allLogs, dinnerFeedback, intervalsData) => {
    // Get last 90 days date range
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoISO = ninetyDaysAgo.toISOString().split('T')[0];

    // Filter dinner logs from last 90 days
    const dinnerLogs = allLogs.filter(log => {
        const logDate = log.dateISO || log.dateStr;
        return logDate >= ninetyDaysAgoISO && log.timeBlock === 'noche';
    });

    if (dinnerLogs.length === 0) {
        return { wellTolerated: [], toWatch: [], hasData: false, allFoods: [] };
    }

    // Calculate average HRV from intervals data
    const hrvValues = intervalsData.filter(d => d.hrv).map(d => d.hrv);
    const avgHRV = hrvValues.length > 0
        ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length
        : null;

    // Group logs by date to get dinner combinations
    const dinnersByDate = {};
    dinnerLogs.forEach(log => {
        const date = log.dateISO || log.dateStr;
        if (!dinnersByDate[date]) {
            dinnersByDate[date] = [];
        }
        dinnersByDate[date].push(log);
    });

    // For each dinner date, determine if it was a "stable" or "difficult" night
    const foodScores = {}; // { foodName: { stable: N, difficult: N, total: N, symptoms: {}, timeline: [], category: '' } }

    // Food categorization helper
    const categorizeFood = (name) => {
        const lowerName = name.toLowerCase();
        if (/pollo|pavo|ternera|cerdo|cordero|carne|filete|pechuga/i.test(lowerName)) return 'Proteínas';
        if (/pescado|salmon|merluza|atun|sardina|bacalao|lubina|dorada/i.test(lowerName)) return 'Pescados';
        if (/arroz|pasta|pan|patata|boniato|quinoa|avena/i.test(lowerName)) return 'Carbohidratos';
        if (/ensalada|lechuga|tomate|pepino|zanahoria|brocoli|espinaca|verdura|calabacin/i.test(lowerName)) return 'Verduras';
        if (/huevo|tortilla/i.test(lowerName)) return 'Huevos';
        if (/yogur|queso|leche/i.test(lowerName)) return 'Lácteos';
        if (/legumbre|lenteja|garbanzo|alubia/i.test(lowerName)) return 'Legumbres';
        return 'Otros';
    };

    Object.entries(dinnersByDate).forEach(([dinnerDate, logs]) => {
        // Get the NEXT day's date (when you wake up and feel the effects)
        const nextDay = new Date(dinnerDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayISO = nextDay.toISOString().split('T')[0];

        // Check feedback for that dinner date
        const feedback = dinnerFeedback.find(f =>
            f.dateISO === dinnerDate || f.id === dinnerDate
        );

        // Check HRV for next morning
        const nextDayWellness = intervalsData.find(d => d.id === nextDayISO);

        // Calculate HRV quality (compared to average)
        const hrvGood = nextDayWellness?.hrv && avgHRV
            ? nextDayWellness.hrv >= avgHRV * 0.9
            : null;

        // Calculate RHR quality (lower is better, compare to average)
        const rhrValues = intervalsData.filter(d => d.restingHR).map(d => d.restingHR);
        const avgRHR = rhrValues.length > 0 ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length : null;
        const rhrGood = nextDayWellness?.restingHR && avgRHR
            ? nextDayWellness.restingHR <= avgRHR * 1.05 // RHR should not be more than 5% above average
            : null;

        // Determine if night was stable
        let wasStable = null;
        let symptomsArray = [];

        if (feedback?.symptoms) {
            symptomsArray = feedback.symptoms;
            // If we have symptom feedback
            if (feedback.symptoms.includes('bien')) {
                wasStable = true;
            } else if (feedback.symptoms.length > 0) {
                wasStable = false;
            }
        }

        // If no feedback, use HRV and RHR as fallback
        if (wasStable === null) {
            if (hrvGood !== null && rhrGood !== null) {
                wasStable = hrvGood && rhrGood; // Both must be good
            } else if (hrvGood !== null) {
                wasStable = hrvGood;
            } else if (rhrGood !== null) {
                wasStable = rhrGood;
            }
        }

        // Skip if we can't determine stability
        if (wasStable === null) return;

        // Score each food in this dinner
        logs.forEach(log => {
            const name = log.name?.toLowerCase().trim();
            if (!name) return;

            if (!foodScores[name]) {
                foodScores[name] = {
                    stable: 0,
                    difficult: 0,
                    total: 0,
                    displayName: log.name,
                    symptoms: {}, // Track which symptoms occurred
                    timeline: [], // Track occurrences over time
                    category: categorizeFood(log.name)
                };
            }

            foodScores[name].total++;

            // Add timeline entry
            foodScores[name].timeline.push({
                date: dinnerDate,
                wasStable,
                symptoms: symptomsArray,
                hrv: nextDayWellness?.hrv || null
            });

            if (wasStable) {
                foodScores[name].stable++;
            } else {
                foodScores[name].difficult++;
                // Track specific symptoms
                symptomsArray.forEach(symptom => {
                    if (symptom !== 'bien') {
                        foodScores[name].symptoms[symptom] = (foodScores[name].symptoms[symptom] || 0) + 1;
                    }
                });
            }
        });
    });

    // Calculate tolerance ratio for each food
    const foodAnalysis = Object.entries(foodScores)
        .filter(([_, data]) => data.total >= 1) // Minimum 1 occurrence
        .map(([name, data]) => ({
            name: data.displayName,
            stableRatio: data.stable / data.total,
            difficultRatio: data.difficult / data.total,
            total: data.total,
            stable: data.stable,
            difficult: data.difficult,
            symptoms: data.symptoms,
            timeline: data.timeline,
            category: data.category,
            // Get most common symptom
            topSymptom: Object.entries(data.symptoms).length > 0
                ? Object.entries(data.symptoms).sort((a, b) => b[1] - a[1])[0]
                : null
        }));

    // Sort and get top foods
    const wellTolerated = foodAnalysis
        .filter(f => f.stableRatio >= 0.6) // At least 60% stable nights
        .sort((a, b) => b.stableRatio - a.stableRatio || b.total - a.total);

    const toWatch = foodAnalysis
        .filter(f => f.difficultRatio >= 0.5) // At least 50% difficult nights
        .sort((a, b) => b.difficultRatio - a.difficultRatio || b.total - a.total);

    // Group all foods by category
    const foodsByCategory = {};
    foodAnalysis.forEach(food => {
        if (!foodsByCategory[food.category]) {
            foodsByCategory[food.category] = [];
        }
        foodsByCategory[food.category].push(food);
    });

    return {
        wellTolerated,
        toWatch,
        allFoods: foodAnalysis.sort((a, b) => b.total - a.total), // All foods sorted by frequency
        foodsByCategory,
        hasData: foodAnalysis.length > 0,
        totalDinners: Object.keys(dinnersByDate).length
    };
};

/**
 * Get top dinner combinations (for Top Digestivo feature)
 */
export const getTopDinnerCombinations = (allLogs, dinnerFeedback, intervalsData) => {
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoISO = ninetyDaysAgo.toISOString().split('T')[0];

    // Group dinners by date
    const dinnersByDate = {};
    allLogs.filter(log => {
        const logDate = log.dateISO || log.dateStr;
        return logDate >= ninetyDaysAgoISO && log.timeBlock === 'noche';
    }).forEach(log => {
        const date = log.dateISO || log.dateStr;
        if (!dinnersByDate[date]) {
            dinnersByDate[date] = [];
        }
        dinnersByDate[date].push(log.name);
    });

    // Score each dinner combination
    const dinnerResults = [];

    Object.entries(dinnersByDate).forEach(([date, foods]) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayISO = nextDay.toISOString().split('T')[0];

        const feedback = dinnerFeedback.find(f => f.dateISO === date || f.id === date);
        const nextDayWellness = intervalsData.find(d => d.id === nextDayISO);

        const symptoms = feedback?.symptoms || [];
        const hasNegativeSymptoms = symptoms.length > 0 && !symptoms.includes('bien');
        const wasGood = symptoms.includes('bien');

        dinnerResults.push({
            date,
            foods: foods.slice(0, 3).join(' + '), // Max 3 foods for display
            fullFoods: foods,
            symptoms,
            hasNegativeSymptoms,
            wasGood,
            hrv: nextDayWellness?.hrv,
            hrvDelta: null // Could calculate vs average
        });
    });

    // Find best, worst, most reliable
    const bestDinner = dinnerResults
        .filter(d => d.wasGood)
        .sort((a, b) => (b.hrv || 0) - (a.hrv || 0))[0];

    const worstDinner = dinnerResults
        .filter(d => d.hasNegativeSymptoms)
        .sort((a, b) => a.symptoms.length - b.symptoms.length)[0];

    // Find most repeated stable dinner
    const dinnerCounts = {};
    dinnerResults.filter(d => d.wasGood || !d.hasNegativeSymptoms).forEach(d => {
        const key = d.foods;
        dinnerCounts[key] = (dinnerCounts[key] || 0) + 1;
    });

    const mostReliable = Object.entries(dinnerCounts)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count >= 2)[0];

    return {
        best: bestDinner,
        worst: worstDinner,
        mostReliable: mostReliable ? { foods: mostReliable[0], count: mostReliable[1] } : null,
        hasData: dinnerResults.length > 0
    };
};

/**
 * Get dinner suggestions for tonight based on history
 */
export const getDinnerSuggestions = (allLogs, dinnerFeedback, intervalsData, isTrainingDay) => {
    const analysis = analyzeDinnerFoodTolerance(allLogs, dinnerFeedback, intervalsData);
    const topDinners = getTopDinnerCombinations(allLogs, dinnerFeedback, intervalsData);

    const suggestions = [];

    // Base suggestions
    if (isTrainingDay) {
        suggestions.push('Día de entreno: considera carbohidratos de fácil digestión');
    } else {
        suggestions.push('Día de descanso: proteína ligera ideal');
    }

    // Add personalized suggestions from history
    if (analysis.wellTolerated.length > 0) {
        const topFood = analysis.wellTolerated[0].name;
        suggestions.push(`"${topFood}" suele funcionarte bien`);
    }

    if (analysis.toWatch.length > 0) {
        const problemFood = analysis.toWatch[0].name;
        suggestions.push(`Evitar "${problemFood}" si buscas estabilidad`);
    }

    // Check today's HRV if data is fresh
    if (intervalsData.length > 0) {
        const todayISO = new Date().toISOString().split('T')[0];
        const todayWellness = intervalsData.find(d => d.id === todayISO);
        const hrvValues = intervalsData.filter(d => d.hrv).map(d => d.hrv);
        const avgHRV = hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;

        if (todayWellness?.hrv && avgHRV && todayWellness.hrv < avgHRV * 0.9) {
            suggestions.push('⚠️ HRV hoy bajo: asegura hoy tus calorías totales para recuperar');
        }
    }

    return {
        tips: suggestions,
        lastGoodDinner: topDinners.best,
        hasData: analysis.hasData
    };
};
