/**
 * Oráculo Engine - Jose Score Calculation
 * Predicts autonomic trend (HRV/RHR) based on 4 weighted pillars
 */

/**
 * Pilar 1: ENERGÍA (peso x2)
 * Represents nervous system fuel
 */
export function calculateEnergyScore(calories, carbs) {
    if (calories >= 2100 && carbs >= 200) return 1;
    if (calories < 1900 || carbs < 170) return -1;
    return 0;
}

/**
 * Pilar 2: NOCHE (peso x2, granular)
 * Main vagal switch - most critical for FA vagal profile
 */
export function calculateNightScore(dinnerKcal, dinnerFat, dinnerFiber, taurinaNoche, estresNocturno, dinnerTime) {
    let score = 0;

    // Stress impact (Baseline)
    if (estresNocturno === 'medio') score -= 0.5;
    else if (estresNocturno === 'alto') score -= 1;

    // Taurine impact (Even without dinner)
    if (taurinaNoche) score -= 0.5;

    // Food impact (Only if dinner is logged)
    if (dinnerKcal > 0) {
        if (dinnerKcal <= 700 && dinnerFat <= 25) score += 1;
        else if (dinnerKcal > 900 || dinnerFat > 35) score -= 1;

        if (dinnerFiber >= 10) score += 0.5;
        if (dinnerTime && dinnerTime > 22) score -= 0.5;
    }

    return Math.max(-2, Math.min(2, score));
}

/**
 * Pilar 3: ESTÍMULO (peso x1)
 * Impact on CNS, not muscles
 */
export function calculateStimulusScore(activityType, activityDuration, sleepScoreYesterday) {
    let score = 0;

    // Friendly activities
    if (['BiciCalle', 'Ride', 'Upper', 'Descanso'].includes(activityType)) {
        score = 1;
        // If endurance is too long, it's not "so suave" anymore for the CNS
        if (activityDuration > 120) score = 0;
    }
    // Demanding activities
    else if (activityType === 'Piernas' || activityType === 'Lower' || activityType === 'Gym') {
        score = -1;
    }
    // Long indoor sessions
    else if ((activityType === 'Rodillo' || activityType === 'VirtualRide') && activityDuration > 60) {
        score = -1;
    }

    // Penalize if poor sleep yesterday
    if (sleepScoreYesterday && sleepScoreYesterday < 70) {
        if (score === -1) score -= 0.5;
        if (score === 1) score = 0; // Poor sleep makes friendly effort neutral
    }

    return score;
}

/**
 * Pilar 4: CONTEXTO (peso x1)
 * TSB + Inercia + Ready Score
 */
export function calculateContextScore(tsb, inercia, readyScore) {
    let score = 0;

    // TSB (Form)
    if (tsb >= 2) score += 1;
    else if (tsb <= -5) score -= 1;

    // Inercia adjustment (autonomic momentum)
    if (inercia > 5) score += 0.5; // Safety margin
    if (inercia < -5) score -= 0.5; // Fragile system

    // Ready score integration
    if (readyScore && readyScore < 50) score -= 1;

    return score;
}

/**
 * Calculate Inercia (autonomic momentum)
 * Positive = system has margin, Negative = system is fragile
 */
export function calculateInercia(last3DaysHRV, baselineHRV) {
    if (!last3DaysHRV || last3DaysHRV.length === 0 || !baselineHRV) return 0;

    const validHRV = last3DaysHRV.filter(v => v !== null && v !== undefined);
    if (validHRV.length === 0) return 0;

    const avgRecent = validHRV.reduce((sum, v) => sum + v, 0) / validHRV.length;
    return avgRecent - baselineHRV;
}

/**
 * Extract dinner data from logs
 */
export function extractDinnerData(logs) {
    const dinnerLogs = logs.filter(l => l.timeBlock === 'noche');

    if (dinnerLogs.length === 0) {
        return {
            dinnerKcal: 0,
            dinnerFat: 0,
            dinnerFiber: 0,
            dinnerTime: null
        };
    }

    const totals = dinnerLogs.reduce((acc, l) => ({
        calories: acc.calories + (Number(l.calories) || 0),
        fat: acc.fat + (Number(l.fat) || 0),
        fiber: acc.fiber + (Number(l.fiber) || 0)
    }), { calories: 0, fat: 0, fiber: 0 });

    // Estimate dinner time from last noche log (if timestamp available)
    const lastDinnerLog = dinnerLogs[dinnerLogs.length - 1];
    let dinnerTime = null;
    if (lastDinnerLog.timestamp) {
        const date = new Date(lastDinnerLog.timestamp);
        dinnerTime = date.getHours();
    }

    return {
        dinnerKcal: totals.calories,
        dinnerFat: totals.fat,
        dinnerFiber: totals.fiber,
        dinnerTime
    };
}

export function getActivityName(activities) {
    if (!activities || activities.length === 0) return 'Descanso';
    // Return all names joined if multiple
    return activities.map(a => a.name || a.type).join(', ');
}

/**
 * Get activity type from today's activities
 */
export function getActivityType(activities) {
    if (!activities || activities.length === 0) return 'Descanso';

    // Prioritize most demanding activity if multiple
    const types = activities.map(a => a.type);

    if (types.includes('Piernas') || types.includes('Lower')) return 'Piernas';
    if (types.includes('Gym')) return 'Gym';
    if (types.includes('VirtualRide') || types.includes('Rodillo')) return 'Rodillo';
    if (types.includes('Ride') || types.includes('BiciCalle')) return 'BiciCalle';
    if (types.includes('Upper')) return 'Upper';

    return activities[0].type || 'Actividad';
}

/**
 * Get total activity duration in minutes
 */
export function getActivityDuration(activities) {
    if (!activities || activities.length === 0) return 0;
    return activities.reduce((sum, a) => sum + (a.moving_time || a.elapsed_time || 0), 0) / 60;
}

/**
 * Generate human-readable causes and corrections
 */
export function generateCauses(breakdown, data, totalScore) {
    const causes = {
        positive: [],
        negative: [],
        corrections: []
    };

    // Energy
    if (breakdown.energyScore > 0) {
        causes.positive.push('Energía óptima');
    } else if (breakdown.energyScore < 0) {
        const deficit = 2100 - data.calories;
        const carbDeficit = 200 - data.carbs;

        // Micro-adjust: Specify what's missing
        if (carbDeficit > 30) {
            causes.negative.push(`Falta sustrato: Carbohidratos bajos (${Math.round(carbDeficit)}g menos)`);
        } else {
            causes.negative.push(`Déficit energético (-${Math.round(deficit)} kcal)`);
        }
    }

    // Night
    if (breakdown.nightScore > 0) {
        causes.positive.push('Cena limpia');
    } else if (breakdown.nightScore < 0) {
        if (data.dinnerFat > 35) causes.negative.push(`Grasa en cena alta (${Math.round(data.dinnerFat)}g)`);
        if (data.dinnerKcal > 900) causes.negative.push(`Cena pesada (${Math.round(data.dinnerKcal)} kcal)`);
        if (data.taurinaNoche) causes.negative.push('Taurina nocturna');
        if (data.dinnerTime && data.dinnerTime > 22) causes.negative.push('Cena tardía');
    }

    // Stimulus
    if (breakdown.stimulusScore > 0) {
        causes.positive.push(`${data.activityType} (estímulo amigable)`);
    } else if (breakdown.stimulusScore < 0) {
        causes.negative.push(`${data.activityType} (estímulo demandante)`);
    }

    // Context
    if (breakdown.contextScore > 0) {
        causes.positive.push('TSB positivo (forma fresca)');
    } else if (breakdown.contextScore < 0) {
        if (data.tsb <= -5) causes.negative.push('TSB bajo (fatiga acumulada)');
        if (data.readyScore < 50) causes.negative.push('Ready Score bajo');
    }

    // "Casi Verde" - Motivation when close to green
    if (totalScore === 2) {
        causes.positive.push('⚡ A un paso del verde: Solo te falta un pequeño ajuste');
    }

    // CORRECTIONS - Actionable suggestions
    if (totalScore <= 0) {
        const deficit = 2100 - data.calories;
        const carbDeficit = 200 - data.carbs;

        if (deficit > 200) {
            // Suggest specific foods
            if (carbDeficit > 30) {
                causes.corrections.push({
                    priority: 'alta',
                    title: 'Añade carbohidratos',
                    options: [
                        { food: '1 plátano + 30g avena', kcal: 250, carbs: 50 },
                        { food: '2 rebanadas pan + miel', kcal: 280, carbs: 55 }
                    ]
                });
            } else {
                causes.corrections.push({
                    priority: 'alta',
                    title: 'Cubre el déficit energético',
                    options: [
                        { food: '1 plátano + yogur griego', kcal: 200, carbs: 35 },
                        { food: 'Tostada aguacate + pavo', kcal: 300, carbs: 25 }
                    ]
                });
            }
        }

        if (data.dinnerFat > 35 || data.dinnerKcal > 900) {
            causes.corrections.push({
                priority: 'media',
                title: 'Alivia la cena de mañana',
                options: [
                    { food: 'Pechuga + verduras', note: 'Bajo en grasa' },
                    { food: 'Pescado blanco + ensalada', note: 'Digestión ligera' }
                ]
            });
        }
    }

    return causes;
}

/**
 * Find suitable dinners from history and pantry
 */
export function findDinnerRecommendations(logs, myFoods, targetKcal, targetCarbs) {
    const recommendations = [];

    // 1. Check history (last 30 dinners)
    const historyDinners = logs
        .filter(l => l.timeBlock === 'noche' && l.calories > 0)
        .slice(-60); // Get more to find unique ones

    // Create unique list by name
    const uniqueHistory = [];
    const names = new Set();

    historyDinners.forEach(d => {
        const name = d.name?.toLowerCase().trim();
        if (name && !names.has(name)) {
            names.add(name);
            uniqueHistory.push(d);
        }
    });

    // Score history items by how well they fit targets
    const scoredHistory = uniqueHistory.map(d => {
        const kcalDiff = Math.abs(d.calories - targetKcal);
        let carbDiff = Math.abs(d.carbs - targetCarbs);

        // If we really need carbs, penalize hard those that don't have enough
        if (targetCarbs > 40 && d.carbs < targetCarbs * 0.7) {
            carbDiff += (targetCarbs - d.carbs) * 2;
        }

        // Prioritize clean dinners
        const isClean = d.calories <= 700 && d.fat <= 25;
        const totalDiff = (kcalDiff / 100) + (carbDiff / 5); // Carbs are now more important ( /5 )
        return { ...d, matchScore: totalDiff - (isClean ? 2 : 0), source: 'historial' };
    });

    // 2. Check My Foods (pantry)
    const scoredPantry = (myFoods || []).map(d => {
        const kcalDiff = Math.abs(d.calories - targetKcal);
        let carbDiff = Math.abs(d.carbs - targetCarbs);

        if (targetCarbs > 40 && d.carbs < targetCarbs * 0.7) {
            carbDiff += (targetCarbs - d.carbs) * 2;
        }

        const isClean = d.calories <= 700 && d.fat <= 25;
        const totalDiff = (kcalDiff / 100) + (carbDiff / 5);
        return { ...d, matchScore: totalDiff - (isClean ? 3 : 0), source: 'despensa' }; // Pantry gets slight boost
    });

    // Combine and take top 3
    const all = [...scoredHistory, ...scoredPantry]
        .filter(d => d.calories >= 200 && d.calories <= 1000 && d.fat <= 40) // Broaden slightly to find options
        .sort((a, b) => a.matchScore - b.matchScore);

    return all.slice(0, 3);
}

/**
 * Main Jose Score calculation
 * Returns score, trend, confidence, breakdown, causes and recommendations
 */
export function calculateJoseScore(data, logs, myFoods) {
    const energyScore = calculateEnergyScore(data.calories, data.carbs);
    const nightScore = calculateNightScore(
        data.dinnerKcal,
        data.dinnerFat,
        data.dinnerFiber,
        data.taurinaNoche,
        data.estresNocturno,
        data.dinnerTime
    );
    const stimulusScore = calculateStimulusScore(
        data.activityType,
        data.activityDuration,
        data.sleepScoreYesterday
    );
    const contextScore = calculateContextScore(
        data.tsb,
        data.inercia,
        data.readyScore
    );

    const total = (energyScore * 2) + (nightScore * 2) + stimulusScore + contextScore;

    const breakdown = {
        energyScore,
        nightScore,
        stimulusScore,
        contextScore
    };

    const trend = total >= 3 ? 'up' : total <= -3 ? 'down' : 'neutral';
    const confidence = Math.abs(total) >= 4 ? 'alta' : 'media';

    const causes = generateCauses(breakdown, data, total);

    // Generate dinner recommendations if total score is not great or dinner not done
    let recommendations = [];
    if (total <= 2 && data.dinnerKcal === 0) {
        const targetKcal = Math.max(500, 2100 - (data.calories || 0));
        const targetCarbs = Math.max(30, 200 - (data.carbs || 0));
        recommendations = findDinnerRecommendations(logs || [], myFoods || [], targetKcal, targetCarbs);
    }

    return {
        total,
        breakdown,
        trend,
        confidence,
        causes,
        recommendations
    };
}
