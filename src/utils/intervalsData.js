import { ATHLETE_ID, INTERVALS_API_KEY } from '../config/firebase';

export const fetchIntervalsData = async (days = 28, startDate = null, endDate = null) => {
    try {
        let oldest, newest;

        if (startDate && endDate) {
            oldest = startDate;
            newest = endDate;
        } else {
            newest = new Date().toISOString().split('T')[0];
            oldest = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        const auth = 'Basic ' + btoa('API_KEY:' + INTERVALS_API_KEY);
        const wellnessUrl = `https://corsproxy.io/?${encodeURIComponent(`https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=${oldest}&newest=${newest}`)}`;
        const activitiesUrl = `https://corsproxy.io/?${encodeURIComponent(`https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${oldest}&newest=${newest}`)}`;

        const [resWellness, resActivities] = await Promise.all([
            fetch(wellnessUrl, { headers: { 'Authorization': auth } }),
            fetch(activitiesUrl, { headers: { 'Authorization': auth } })
        ]);

        if (!resWellness.ok || !resActivities.ok) throw new Error('API Sync Error');

        const wellness = await resWellness.json();
        const activities = await resActivities.json();

        // Merge Data
        const merged = wellness.map(day => {
            const dayActs = activities.filter(a => a.start_date_local.startsWith(day.id));
            const dailyTSS = dayActs.reduce((sum, a) => sum + (a.icu_training_load || 0), 0);
            return {
                id: day.id, // Compatibility with HistoryView
                date: day.id,
                hrv: day.hrv || day.hrv_sdnn || day.hrv_rmssd || 0,
                rhr: day.restingHR || day.resting_hr || day.avg_hr || 0,
                dailyTSS,
                activities: dayActs,
                sleepScore: day.sleepScore || day.sleepQuality || 0,
                // Pass through original wellness fields needed for calculations
                ctl: day.ctl,
                atl: day.atl,
                trainingLoad: day.trainingLoad || day.icu_training_load,
                comments: day.comments
            };
        });

        return merged.sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
        console.error("Intervals fetch error:", e);
        return null;
    }
};
