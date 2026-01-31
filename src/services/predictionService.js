import { db } from '../App'; // We might need to adjust how db is shared
import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

/**
 * Service to handle Oráculo predictions and validations
 */
export const savePrediction = async (db, userId, appId, predictionData) => {
    if (!db || !userId) return;

    // Use the date from predictionData if available (viewDate from UI), otherwise system today
    const targetDate = predictionData.dateISO || new Date().toISOString().split('T')[0];
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/predictions`, targetDate);

    try {
        await setDoc(docRef, {
            ...predictionData,
            date: targetDate,
            timestamp: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error('Error saving prediction:', e);
        return false;
    }
};

export const getPrediction = async (db, userId, appId, date) => {
    if (!db || !userId) return null;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/predictions`, date);
    try {
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        console.error('Error getting prediction:', e);
        return null;
    }
};

/**
 * Validates a previous prediction against actual wellness data
 */
export const validatePrediction = (prediction, actualWellness) => {
    if (!prediction || !actualWellness || actualWellness.hrv === undefined) return null;

    const predictedTrend = prediction.trend; // 'up', 'down', 'neutral'
    const baselineHRV = actualWellness.baselineHRV || 50;
    const currentHRV = actualWellness.hrv;
    const baseHRV = prediction.baseHRV !== undefined ? prediction.baseHRV : baselineHRV;

    let actualTrend = 'neutral';
    const trendDiff = currentHRV - baseHRV;

    if (trendDiff > 2) actualTrend = 'up';
    else if (trendDiff < -2) actualTrend = 'down';

    // Force recalculation to 1:1 ratio, ignoring potentially "dirty" saved predictedHRV
    const targetForDiff = Math.round(baseHRV + (prediction.total || 0));
    const diff = currentHRV - targetForDiff;

    return {
        correct: predictedTrend === actualTrend,
        predictedTrend,
        actualTrend,
        diff,
        actualHRV: currentHRV,
        baselineHRV,
        predictedHRV: targetForDiff
    };
};

export const getAllPredictions = async (db, userId, appId) => {
    if (!db || !userId) return [];
    const collRef = collection(db, `artifacts/${appId}/users/${userId}/predictions`);
    try {
        const snap = await getDocs(collRef);
        return snap.docs.map(doc => doc.data());
    } catch (e) {
        console.error('Error getting all predictions:', e);
        return [];
    }
};
