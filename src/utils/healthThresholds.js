// Personal Nutritional Framework - FA Vagal Profile
// 54 años, 184cm, ~70kg, Deportista habitual
// Prioridad: estabilidad eléctrica + digestiva + recuperación

/**
 * Get status (good/warning/critical) based on value within ranges
 * @param {number} value - Current value
 * @param {object} range - { min, optLow, optHigh, max }
 * @returns {string} - 'low' | 'ok' | 'optimal' | 'high' | 'excess'
 */
export const getZoneStatus = (value, range) => {
    if (value < range.min) return 'low';        // 🔴 Below minimum
    if (value < range.optLow) return 'ok';      // 🟡 OK but not optimal
    if (value <= range.optHigh) return 'optimal'; // 🟢 Optimal zone
    if (value <= range.max) return 'high';      // 🟡 High but acceptable
    return 'excess';                             // 🔴 Exceeds maximum
};

/**
 * Get traffic light color for a zone status
 */
export const getZoneColor = (status) => {
    switch (status) {
        case 'low': return 'rose';
        case 'ok': return 'amber';
        case 'optimal': return 'emerald';
        case 'high': return 'amber';
        case 'excess': return 'rose';
        default: return 'gray';
    }
};

/**
 * Get emoji for zone status
 */
export const getZoneEmoji = (status) => {
    switch (status) {
        case 'low': return '🔴';
        case 'ok': return '🟡';
        case 'optimal': return '🟢';
        case 'high': return '🟡';
        case 'excess': return '🔴';
        default: return '⚪';
    }
};

/**
 * Get dynamic health thresholds based on training load
 * @param {number} tssToday - Training Stress Score from Intervals.icu
 * @param {boolean} manualOverride - Force rest (false) or training (true) mode
 */
export const getHealthThresholds = (tssToday = 0, manualOverride = null) => {
    // Determine day type: if manualOverride is set ('gym', 'bici', 'descanso'), use it.
    // Otherwise, infer from TSS: >= 40 is Bici by default, < 40 is Descanso.
    let type = manualOverride;
    if (!type) {
        type = tssToday >= 40 ? 'bici' : 'descanso';
    }

    const baseMacros = {
        protein: { min: 100, optLow: 110, optHigh: 125, max: 140, unit: 'g' },
        fat: { min: 55, optLow: 70, optHigh: 75, max: 90, unit: 'g' },
        fiber: { min: 20, optLow: 25, optHigh: 30, max: 35, unit: 'g' },
    };

    const commonMicros = {
        calcium: { min: 800, optLow: 1000, optHigh: 1200, max: 2000, unit: 'mg', label: 'Calcio' },
        magnesium: { min: 600, optLow: 650, optHigh: 700, max: 800, unit: 'mg', label: 'Magnesio' },
        omega3: { min: 500, optLow: 1000, optHigh: 1000, max: 2000, unit: 'mg', label: 'Omega-3' }
    };

    if (type === 'gym') {
        return {
            dayType: 'gym',
            dayLabel: '🏋️ Día de Gym',
            calories: { min: 2350, optLow: 2450, optHigh: 2550, max: 2650, unit: 'kcal' },
            ...baseMacros,
            carbs: { min: 245, optLow: 280, optHigh: 350, max: 385, unit: 'g' },
            sodium: { min: 2500, optLow: 2500, optHigh: 3000, max: 3500, unit: 'mg', label: 'Sodio' },
            potassium: { min: 3300, optLow: 3800, optHigh: 4500, max: 5000, unit: 'mg', label: 'Potasio' },
            ...commonMicros,
            ratios: { na_k: { ideal: 1.0, high: 1.3 }, ca_mg: { ideal: 2.5, high: 3.5 } },
            night: { fat: 25, fiber: 10, calories: 700 }
        };
    } else if (type === 'bici') {
        return {
            dayType: 'bici',
            dayLabel: '🚴 Día de Bici',
            calories: { min: 2200, optLow: 2300, optHigh: 2400, max: 2600, unit: 'kcal' },
            ...baseMacros,
            carbs: { min: 245, optLow: 280, optHigh: 350, max: 385, unit: 'g' },
            sodium: { min: 2500, optLow: 2500, optHigh: 3000, max: 3500, unit: 'mg', label: 'Sodio' },
            potassium: { min: 3300, optLow: 3800, optHigh: 4500, max: 5000, unit: 'mg', label: 'Potasio' },
            ...commonMicros,
            ratios: { na_k: { ideal: 1.0, high: 1.3 }, ca_mg: { ideal: 2.5, high: 3.5 } },
            night: { fat: 25, fiber: 10, calories: 700 }
        };
    } else {
        // descanso
        return {
            dayType: 'descanso',
            dayLabel: '🛑 Día de Descanso',
            calories: { min: 2100, optLow: 2150, optHigh: 2200, max: 2300, unit: 'kcal' },
            ...baseMacros,
            carbs: { min: 175, optLow: 210, optHigh: 245, max: 280, unit: 'g' },
            sodium: { min: 1500, optLow: 1800, optHigh: 2200, max: 2500, unit: 'mg', label: 'Sodio' },
            potassium: { min: 3300, optLow: 3800, optHigh: 4500, max: 5000, unit: 'mg', label: 'Potasio' },
            ...commonMicros,
            ratios: { na_k: { ideal: 0.9, high: 1.2 }, ca_mg: { ideal: 2.5, high: 3.5 } },
            night: { fat: 20, fiber: 8, calories: 600 }
        };
    }
};

/**
 * Determine if day is closed based on time or manual flag
 * @param {boolean} manualClosed - Manually marked as closed via "Cena hecha"
 * @returns {string} - 'in_progress' | 'closed'
 */
export const getDayStatusType = (manualClosed = false) => {
    if (manualClosed) return 'closed';

    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const timeValue = hour + (minutes / 60);

    // Auto-close at 22:30
    if (timeValue >= 22.5) return 'closed';

    return 'in_progress';
};

/**
 * Critical nutrients (always visible first, FA vagal priority)
 */
export const CRITICAL_NUTRIENTS = ['magnesium', 'potassium', 'sodium'];
export const CONTEXT_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'calcium'];

/**
 * Get emoji for zone status, respecting day status
 * @param {string} status - Zone status (low, ok, optimal, high, excess)
 * @param {string} dayStatusType - 'in_progress' | 'closed'
 */
export const getZoneEmojiForDay = (status, dayStatusType) => {
    if (dayStatusType === 'in_progress') {
        // Pending indicators, not deficits
        switch (status) {
            case 'low': return '⏳';      // Pending, not alarm
            case 'ok': return '🟡';
            case 'optimal': return '🟢';
            case 'high': return '🟡';
            case 'excess': return '⚠️';   // Only excess is warning
            default: return '⚪';
        }
    } else {
        // Closed day - real evaluation
        switch (status) {
            case 'low': return '🔴';
            case 'ok': return '🟡';
            case 'optimal': return '🟢';
            case 'high': return '🟡';
            case 'excess': return '🔴';
            default: return '⚪';
        }
    }
};

/**
 * Get overall day status with new paradigm
 * @param {object} totals - Current nutrient totals
 * @param {object} thresholds - Current thresholds
 * @param {string} dayStatusType - 'in_progress' | 'closed'
 */
export const getDayStatus = (totals, thresholds, dayStatusType = 'in_progress') => {
    // Get statuses for critical nutrients
    const criticalStatuses = CRITICAL_NUTRIENTS.map(n => ({
        key: n,
        status: getZoneStatus(totals[n] || 0, thresholds[n])
    }));

    // Get statuses for all macros
    const macroStatuses = ['calories', 'protein', 'carbs', 'fat', 'fiber'].map(n =>
        getZoneStatus(totals[n] || 0, thresholds[n])
    );

    const criticalLow = criticalStatuses.filter(c => c.status === 'low').length;
    const criticalExcess = criticalStatuses.filter(c => c.status === 'excess').length;
    const allCriticalOk = criticalStatuses.every(c => c.status === 'optimal' || c.status === 'ok');

    // IN PROGRESS - Day not closed yet
    if (dayStatusType === 'in_progress') {
        return {
            color: 'blue',
            emoji: '🕖',
            headerMessage: 'Día en curso · Pendiente de cena',
            footerMessage: 'No evalúes el día hasta cenar.',
            status: 'pending',
            overallStatus: 'pending'
        };
    }

    // CLOSED - Real evaluation
    if (criticalLow >= 2 || criticalExcess >= 1) {
        const missing = criticalStatuses.filter(c => c.status === 'low').map(c => thresholds[c.key]?.label || c.key);
        return {
            color: 'rose',
            emoji: '⚠️',
            headerMessage: 'Día cerrado · Evaluación final',
            footerMessage: `Mañana prioriza ${missing.join(' y ')}.`,
            status: 'needs_adjustment',
            overallStatus: 'needs_adjustment'
        };
    }

    if (allCriticalOk && macroStatuses.every(s => s === 'optimal' || s === 'ok')) {
        return {
            color: 'emerald',
            emoji: '✅',
            headerMessage: 'Día cerrado · Evaluación final',
            footerMessage: 'Día bien cerrado. No ajustes nada.',
            status: 'perfect',
            overallStatus: 'good'
        };
    }

    if (allCriticalOk) {
        return {
            color: 'emerald',
            emoji: '👍',
            headerMessage: 'Día cerrado · Evaluación final',
            footerMessage: 'Día bien cerrado.',
            status: 'good',
            overallStatus: 'good'
        };
    }

    return {
        color: 'amber',
        emoji: '🟡',
        headerMessage: 'Día cerrado · Evaluación final',
        footerMessage: 'Mañana ajusta un poco los críticos.',
        status: 'ok',
        overallStatus: 'needs_adjustment'
    };
};

// Default thresholds (rest day) for backwards compatibility
export const HEALTH_THRESHOLDS = getHealthThresholds(0);
