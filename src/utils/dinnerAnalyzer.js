/**
 * Dinner Digestion Analyzer
 * Analyzes the impact of dinner on health metrics and tracks patterns
 */

/**
 * Calculate digestive load based on dinner composition
 * Higher values indicate heavier digestion
 */
export const calculateDigestiveLoad = (dinnerLogs) => {
    if (!dinnerLogs || dinnerLogs.length === 0) return 0;

    const totals = dinnerLogs.reduce((acc, log) => ({
        fat: acc.fat + (Number(log.fat) || 0),
        fiber: acc.fiber + (Number(log.fiber) || 0),
        protein: acc.protein + (Number(log.protein) || 0),
        calories: acc.calories + (Number(log.calories) || 0)
    }), { fat: 0, fiber: 0, protein: 0, calories: 0 });

    // Weighted formula: fat and fiber are harder to digest at night
    const load = (totals.fat * 1.5) + (totals.fiber * 1.2) + (totals.protein * 0.8);

    // Normalize to 0-10 scale
    return Math.min(10, Math.round((load / 100) * 10));
};

/**
 * Analyze the impact of a specific food across dinner history
 */
export const analyzeFoodImpact = (foodName, feedbackHistory) => {
    if (!feedbackHistory || feedbackHistory.length === 0) {
        return null;
    }

    const occurrences = feedbackHistory.filter(fb =>
        fb.dinnerLogs && fb.dinnerLogs.some(log =>
            log.name && log.name.toLowerCase().includes(foodName.toLowerCase())
        )
    );

    if (occurrences.length === 0) return null;

    const withSymptoms = occurrences.filter(fb =>
        fb.feedback &&
        fb.feedback.tags &&
        fb.feedback.tags.length > 0 &&
        !fb.feedback.tags.includes('bien')
    );

    const symptomRate = (withSymptoms.length / occurrences.length) * 100;

    // Get most common symptoms
    const symptomCounts = {};
    withSymptoms.forEach(fb => {
        fb.feedback.tags.forEach(tag => {
            symptomCounts[tag] = (symptomCounts[tag] || 0) + 1;
        });
    });

    const commonSymptoms = Object.entries(symptomCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag);

    return {
        totalTimes: occurrences.length,
        symptomsCount: withSymptoms.length,
        symptomRate: Math.round(symptomRate),
        verdict: getVerdict(symptomRate),
        commonSymptoms
    };
};

/**
 * Get verdict based on symptom rate
 */
const getVerdict = (symptomRate) => {
    if (symptomRate >= 60) return 'evitar';
    if (symptomRate >= 30) return 'moderado';
    return 'seguro';
};

/**
 * Calculate digestive window (hours between dinner and sleep)
 */
export const calculateDigestiveWindow = (dinnerTime, bedtime) => {
    if (!dinnerTime || !bedtime) return null;

    const dinner = new Date(dinnerTime);
    const sleep = new Date(bedtime);

    // If bedtime is "earlier" than dinner, it's the next day
    if (sleep < dinner) {
        sleep.setDate(sleep.getDate() + 1);
    }

    const diffMs = sleep - dinner;
    const diffHours = diffMs / (1000 * 60 * 60);

    return Math.round(diffHours * 10) / 10; // Round to 1 decimal
};

/**
 * Get HRV delta percentage compared to 7-day average
 */
export const getHRVDelta = (currentHRV, intervalsData) => {
    if (!currentHRV || !intervalsData || intervalsData.length < 2) return null;

    const last7Days = intervalsData.slice(0, 7).filter(d => d.hrv);
    if (last7Days.length < 2) return null;

    const avgHRV = last7Days.reduce((sum, d) => sum + d.hrv, 0) / last7Days.length;
    const delta = ((currentHRV - avgHRV) / avgHRV) * 100;

    return Math.round(delta);
};

/**
 * Get RHR delta compared to 7-day average
 */
export const getRHRDelta = (currentRHR, intervalsData) => {
    if (!currentRHR || !intervalsData || intervalsData.length < 2) return null;

    const last7Days = intervalsData.slice(0, 7).filter(d => d.restingHR);
    if (last7Days.length < 2) return null;

    const avgRHR = last7Days.reduce((sum, d) => sum + d.restingHR, 0) / last7Days.length;
    const delta = currentRHR - avgRHR;

    return Math.round(delta);
};

/**
 * Get automatic verdict based on metrics
 */
export const getAutomaticVerdict = (hrvDelta, digestiveLoad, hasFATag) => {
    if (hasFATag) return 'critical';
    if (hrvDelta !== null && hrvDelta < -20) return 'critical';
    if (hrvDelta !== null && hrvDelta < -10 && digestiveLoad >= 7) return 'warning';
    if (digestiveLoad >= 8) return 'warning';
    return 'good';
};

/**
 * Get emoji for symptom tag
 */
export const getSymptomEmoji = (tag) => {
    const emojiMap = {
        'gases': '💨',
        'pulso_alto': '❤️',
        'hrv_bajo': '📉',
        'fa': '⚡',
        'bien': '💤',
        'reflujo': '🔥',
        'estres': '😰',
        'estres_garmin': '📊',
        'hrv_alta': '📈'
    };
    return emojiMap[tag] || '•';
};

/**
 * Get symptom label in Spanish
 */
export const getSymptomLabel = (tag) => {
    const labelMap = {
        'gases': 'Gases',
        'pulso_alto': 'Pulso Alto',
        'hrv_bajo': 'HRV Bajo',
        'fa': 'FA',
        'bien': 'Bien',
        'reflujo': 'Reflujo',
        'estres': 'Estrés',
        'estres_garmin': 'Estrés Garmin',
        'hrv_bajo': 'HRV Baja'
    };
    return labelMap[tag] || tag;
};
