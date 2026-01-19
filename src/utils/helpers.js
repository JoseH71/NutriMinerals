// Helper functions for the NutriMinerals app

// Get time block based on hour
export const getTimeBlock = (date = new Date()) => {
    const hour = date.getHours();
    if (hour < 14) return 'mañana';
    if (hour < 19) return 'tarde';
    return 'noche';
};

// Calculate nutrient ratios
export const calculateRatios = (na, k, ca, mg) => ({
    naK: na > 0 && k > 0 ? na / k : null,
    caMg: ca > 0 && mg > 0 ? ca / mg : null
});

// Calculate nocturnal digestive load
export const calculateDigestiveLoad = (logs) => {
    if (!Array.isArray(logs)) return 0;
    const nightLogs = logs.filter(l => l.timeBlock === 'noche');
    const fat = nightLogs.reduce((a, b) => a + (Number(b.fat) || 0), 0);
    const fiber = nightLogs.reduce((a, b) => a + (Number(b.fiber) || 0), 0);
    const sodium = nightLogs.reduce((a, b) => a + (Number(b.na) || 0), 0);
    return (fat * 1.5) + (fiber * 1.2) + (sodium * 0.5);
};

// Get ratio status with non-alarmist language
// Get ratio status with non-alarmist language
export const getRatioStatus = (value, thresholds) => {
    if (value === null || value === undefined || isNaN(value)) return { status: 'unknown', color: 'gray', message: 'Sin datos' };

    // Logic fix: strict comparison against thresholds
    // Assuming structure: { ideal: X, high: Y }
    // Green: < ideal
    // Amber: >= ideal AND <= high
    // Red: > high

    if (value < thresholds.ideal) return { status: 'excellent', color: 'emerald', message: 'Excelente' };
    if (value <= thresholds.high) return { status: 'attention', color: 'amber', message: 'Atención' };

    // Fallback for high values
    return { status: 'high', color: 'rose', message: 'Sistema más sensible hoy' };
};

// LocalStorage helpers for mineral history
export const getMineralHistory = () => {
    try {
        const stored = localStorage.getItem('mineralHistory');
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
};

export const saveMineralHistory = (dateStr, na, k, mg) => {
    try {
        const history = getMineralHistory();
        history[dateStr] = { na, k, mg, saved: new Date().toISOString() };
        const dates = Object.keys(history).sort().slice(-7);
        const pruned = {};
        dates.forEach(d => pruned[d] = history[d]);
        localStorage.setItem('mineralHistory', JSON.stringify(pruned));
    } catch (e) { /* silent error */ }
};

// Check for prolonged deficit
export const checkProlongedDeficit = (mineral, threshold, todayVal) => {
    if (todayVal >= threshold) return { deficit: false, days: 0 };
    const history = getMineralHistory();
    const todayStr = new Date().toLocaleDateString();
    const dates = Object.keys(history).filter(d => d !== todayStr).sort();
    if (dates.length === 0) return { deficit: false, days: 0 };
    const lastDate = dates[dates.length - 1];
    const lastVal = history[lastDate][mineral] || 0;
    if (lastVal < threshold) {
        let streak = 2;
        if (dates.length >= 2) {
            const twoDaysAgo = dates[dates.length - 2];
            if ((history[twoDaysAgo][mineral] || 0) < threshold) streak++;
        }
        return { deficit: true, days: streak };
    }
    return { deficit: false, days: 0 };
};

// Heavy dinner flag helpers
export const getHeavyDinnerFlag = (dateStr) => {
    try {
        const flags = JSON.parse(localStorage.getItem('heavyDinnerFlags') || '{}');
        return flags[dateStr] || false;
    } catch { return false; }
};

export const setHeavyDinnerFlag = (dateStr, value) => {
    try {
        const flags = JSON.parse(localStorage.getItem('heavyDinnerFlags') || '{}');
        flags[dateStr] = value;
        localStorage.setItem('heavyDinnerFlags', JSON.stringify(flags));
    } catch (e) { /* silent error */ }
};
// Health thresholds used for FA Score
const NIGHT_THRESHOLDS = {
    na: { risk: 1700, ok: 2300, safe: 3000 },
    k: { risk: 3000, ok: 3500, safe: 4000 },
    mg: { risk: 400, ok: 550, safe: 750 },
    ca: { risk: 700, ok: 900, safe: 1000 },
    taurina: { risk: 0.5, okLow: 0.5, okHigh: 2.5, excess: 3 } // in grams
};

// Calculate FA Score (0-100) for night mode
export const calculateFAScore = (na, k, ca, mg, taurinaG, digestiveLoad, tss) => {
    let score = 100;

    // 🧂 ELECTROLYTES (40%)
    // Na:K ratio (target: 0.5-0.8)
    const naKRatio = k > 0 ? na / k : 2;
    if (naKRatio > 1.3) score -= 15;
    else if (naKRatio > 1.0) score -= 8;
    else if (naKRatio < 0.3) score -= 5;

    // Ca:Mg ratio (target: 2-3)
    const caMgRatio = mg > 0 ? ca / mg : 4;
    if (caMgRatio > 4) score -= 10;
    else if (caMgRatio > 3.5) score -= 5;

    // Mg absolute (critical for FA)
    if (mg < NIGHT_THRESHOLDS.mg.risk) score -= 15;
    else if (mg < NIGHT_THRESHOLDS.mg.ok) score -= 5;

    // Na level
    if (na < NIGHT_THRESHOLDS.na.risk) score -= 10;

    // K level
    if (k < NIGHT_THRESHOLDS.k.risk) score -= 10;
    else if (k < NIGHT_THRESHOLDS.k.ok) score -= 3;

    // 🌙 DIGESTIVE (30%)
    if (digestiveLoad > 180) score -= 15;
    else if (digestiveLoad > 120) score -= 8;
    else if (digestiveLoad > 80) score -= 3;

    // 🚴 TRAINING LOAD (20%) - recovery consideration
    if (tss > 100) score -= 5; // high load day, more recovery needed
    else if (tss > 60) score -= 2;

    // 🧘 NERVOUS SYSTEM (10%)
    // Taurine presence
    if (taurinaG >= 0.5 && taurinaG <= 2.5) score += 5; // bonus for therapeutic range
    else if (taurinaG > 3) score -= 5; // excess

    // Mg presence bonus
    if (mg >= NIGHT_THRESHOLDS.mg.safe) score += 3;

    return Math.max(0, Math.min(100, score));
};

// Get FA Score status with calming messages
export const getFAScoreStatus = (score) => {
    if (score >= 80) return {
        color: 'emerald',
        label: 'SEGURO',
        emoji: '🟢',
        message: 'Condiciones estables. Tu cuerpo está listo para descansar.'
    };
    if (score >= 60) return {
        color: 'amber',
        label: 'ESTABLE',
        emoji: '🟡',
        message: 'Margen reducido pero sin riesgo. Puedes descansar tranquilo.'
    };
    return {
        color: 'rose',
        label: 'ATENCIÓN',
        emoji: '🔴',
        message: 'Algún indicador fuera de rango. Revisa mañana si persiste.'
    };
};
