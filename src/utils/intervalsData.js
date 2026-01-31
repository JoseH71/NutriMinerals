import { ATHLETE_ID, INTERVALS_API_KEY, APP_ID, SHARED_USER_ID, db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const getHeaders = () => {
    try {
        if (!INTERVALS_API_KEY) return {};
        const auth = btoa('API_KEY:' + INTERVALS_API_KEY.trim());
        return {
            'Authorization': 'Basic ' + auth,
            'Accept': 'application/json'
        };
    } catch (e) {
        return { 'Accept': 'application/json' };
    }
};

const fetchWithProxy = async (url) => {
    const proxies = [
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url='
    ];

    for (const proxy of proxies) {
        try {
            const fullUrl = `${proxy}${encodeURIComponent(url)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

            const res = await fetch(fullUrl, {
                method: 'GET',
                headers: getHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && (Array.isArray(data) || typeof data === 'object')) {
                    return data;
                }
            }
        } catch (e) {
            // Try next proxy
        }
    }
    return null;
};

// Firebase Cache
const getCacheDoc = async (type) => {
    if (!db) return null;
    try {
        const docRef = doc(db, `artifacts/${APP_ID}/users/${SHARED_USER_ID}/intervals_cache/${type}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return JSON.parse(snap.data().data);
        }
    } catch (e) {
        console.error("Cache read error:", e);
    }
    return null;
};

const saveToCache = async (type, newData) => {
    if (!db || !newData || newData.length === 0) return;
    try {
        const docRef = doc(db, `artifacts/${APP_ID}/users/${SHARED_USER_ID}/intervals_cache/${type}`);

        // Load existing cache to merge
        const snap = await getDoc(docRef);
        let combined = newData;

        if (snap.exists()) {
            try {
                const existing = JSON.parse(snap.data().data);
                if (Array.isArray(existing)) {
                    const map = new Map();
                    existing.forEach(item => { if (item) map.set(item.id || item.date, item); });
                    newData.forEach(item => { if (item) map.set(item.id || item.date, item); });
                    combined = Array.from(map.values());
                }
            } catch (parseError) { }
        }

        combined.sort((a, b) => (b.id || b.date || '').localeCompare(a.id || a.date || ''));
        if (combined.length > 500) combined = combined.slice(0, 500);

        await setDoc(docRef, {
            data: JSON.stringify(combined),
            lastUpdated: Date.now()
        }, { merge: true });
    } catch (e) {
        console.error("Cache write error:", e);
    }
};

export const fetchIntervalsData = async (days = 28, startDate = null, endDate = null) => {
    try {
        let oldest, newest;
        if (startDate && endDate) {
            oldest = startDate;
            newest = endDate;
        } else {
            newest = new Date().toISOString().split('T')[0];
            const oldestDate = new Date();
            oldestDate.setDate(oldestDate.getDate() - days);
            oldest = oldestDate.toISOString().split('T')[0];
        }

        const wellnessUrl = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=${oldest}&newest=${newest}`;
        const activitiesUrl = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${oldest}&newest=${newest}`;

        // ALWAYS try network first (get fresh data)
        console.log("[Intervals] Fetching fresh data from network...");
        let wellness = await fetchWithProxy(wellnessUrl);
        let activities = await fetchWithProxy(activitiesUrl);
        let source = 'network';

        // If network failed, fallback to Firebase cache
        if (!wellness || wellness.length === 0) {
            console.log("[Intervals] Network failed, using Firebase cache...");
            wellness = await getCacheDoc('wellness');
            activities = await getCacheDoc('activities') || [];
            source = 'cached';
        } else {
            // Network succeeded - save to cache in background for mobile
            console.log("[Intervals] Network success, updating cache...");
            saveToCache('wellness', wellness);
            if (activities && activities.length > 0) {
                saveToCache('activities', activities);
            }
        }

        if (!wellness || !Array.isArray(wellness)) {
            console.warn("[Intervals] No data available");
            return null;
        }

        activities = activities || [];

        const merged = wellness.map(w => {
            const dayId = w.id || w.date;
            const dayActs = activities.filter(a => a.start_date_local && a.start_date_local.startsWith(dayId));
            const dailyTSS = dayActs.reduce((sum, a) => sum + (a.icu_training_load || 0), 0);
            return {
                ...w,
                id: dayId,
                date: dayId,
                hrv: w.hrv || w.hrv_sdnn || w.hrv_rmssd || null,
                restingHR: w.restingHR || w.resting_hr || w.avg_hr || null,
                rhr: w.restingHR || w.resting_hr || w.avg_hr || null,
                dailyTSS,
                activities: dayActs,
                _source: source
            };
        });

        return merged.sort((a, b) => b.id.localeCompare(a.id));

    } catch (e) {
        console.error("Intervals fetch fatal error:", e);
        return null;
    }
};

export const fetchIntervalsWellness = async (startDate, endDate) => {
    return fetchIntervalsData(null, startDate, endDate);
};

export const fetchIntervalsActivities = async (startDate, endDate) => {
    try {
        const url = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${startDate}&newest=${endDate}`;
        console.log("[Intervals] Fetching activities from network...");
        let activities = await fetchWithProxy(url);

        // If network succeeded, save to cache
        if (activities && activities.length > 0) {
            console.log("[Intervals] Activities network success, updating cache...");
            saveToCache('activities', activities);
            return activities;
        }

        // Network failed - try cache
        console.log("[Intervals] Activities network failed, using cache...");
        const cached = await getCacheDoc('activities');
        if (cached && Array.isArray(cached)) {
            // Filter by date range from cache
            return cached.filter(a => {
                const actDate = a.start_date_local?.split('T')[0] || '';
                return actDate >= startDate && actDate <= endDate;
            });
        }

        return [];
    } catch (e) {
        console.error("[Intervals] Activities fetch error:", e);
        // Last resort: try cache
        const cached = await getCacheDoc('activities');
        return cached || [];
    }
};
