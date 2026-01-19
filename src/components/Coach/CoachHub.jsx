import React, { useState, useEffect } from 'react';
import { Icons } from '../../components/Icons';
import CoachActivityView from './CoachActivityView';
import CoachHistoryView from './CoachHistoryView';
import CoachCorrelationsView from './CoachCorrelationsView';
import MesocicloView from '../Mesociclo/MesocicloView';
import { ATHLETE_ID, INTERVALS_API_KEY } from '../../config/firebase';

const CoachHub = ({ logs, useFirebase, dbRef, appId }) => {
    const [subTab, setSubTab] = useState('activity'); // activity, history, correlations, plan
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch historical data (Wellness + Activities)
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const days = 180;
                const today = new Date().toISOString().split('T')[0];
                const oldest = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                // Parallel fetch
                const auth = 'Basic ' + btoa('API_KEY:' + INTERVALS_API_KEY);
                const wellnessUrl = `https://corsproxy.io/?${encodeURIComponent(`https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness?oldest=${oldest}&newest=${today}`)}`;
                const activitiesUrl = `https://corsproxy.io/?${encodeURIComponent(`https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/activities?oldest=${oldest}&newest=${today}`)}`;

                const [resWellness, resActivities] = await Promise.all([
                    fetch(wellnessUrl, { headers: { 'Authorization': auth } }),
                    fetch(activitiesUrl, { headers: { 'Authorization': auth } })
                ]);

                if (!resWellness.ok) throw new Error('Error wellness API');
                if (!resActivities.ok) throw new Error('Error activities API');

                const wellness = await resWellness.json();
                const activities = await resActivities.json();

                // Merge Data
                const merged = wellness.map(day => {
                    const dayActs = activities.filter(a => a.start_date_local.startsWith(day.id));
                    const dailyTSS = dayActs.reduce((sum, a) => sum + (a.icu_training_load || 0), 0);
                    return { ...day, dailyTSS, activities: dayActs };
                });

                setHistoryData(merged.sort((a, b) => a.id.localeCompare(b.id))); // Ensure sorted by date
            } catch (e) {
                console.error("Coach data fetch error:", e);
                setError("Error al cargar datos de Intervals.icu");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const renderSubView = () => {
        if (loading && subTab !== 'activity' && subTab !== 'plan') {
            return (
                <div className="text-center py-20 bg-card rounded-3xl border border-theme mx-2">
                    <Icons.Loader2 className="animate-spin mx-auto text-violet-600 mb-3" size={32} />
                    <p className="text-xs font-black text-secondary uppercase tracking-widest">Sincronizando Coach...</p>
                </div>
            );
        }

        switch (subTab) {
            case 'activity': return <CoachActivityView />;
            case 'history': return <CoachHistoryView historyData={historyData} />;
            case 'correlations': return <CoachCorrelationsView historyData={historyData} />;
            case 'plan': return <MesocicloView useFirebase={useFirebase} dbRef={dbRef} appId={appId} />;
            default: return <CoachActivityView />;
        }
    };

    return (
        <div className="space-y-4 animate-fade-in px-2 pb-20">
            <div className="px-1 flex justify-between items-center mb-2">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Coach Inteligente</h2>
                <div className="flex gap-1">
                    <span className="px-3 py-1 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 rounded-full text-[10px] font-black border border-violet-200 dark:border-violet-800 uppercase tracking-widest">Intervals.icu</span>
                </div>
            </div>

            {/* Coach Navigation */}
            <div className="flex bg-card rounded-2xl p-1 border border-theme shadow-sm overflow-x-auto scrollbar-hide">
                {[
                    { id: 'activity', label: 'Actividad', icon: '🚴' },
                    { id: 'plan', label: 'Plan', icon: '📅' },
                    { id: 'history', label: 'Métricas', icon: '📈' },
                    { id: 'correlations', label: 'Deep Dive', icon: '🔬' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSubTab(tab.id)}
                        className={`flex-1 min-w-[80px] py-3 px-2 rounded-xl font-black text-[10px] transition-all uppercase tracking-widest flex flex-col items-center gap-1 ${subTab === tab.id ? 'bg-violet-600 text-white shadow-lg' : 'text-secondary hover:text-primary'}`}
                    >
                        <span className="text-base">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="min-h-[400px]">
                {error && subTab !== 'activity' && subTab !== 'plan' ? (
                    <div className="text-center py-10 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-500/30 mx-2 mb-4">
                        <Icons.AlertTriangle className="mx-auto text-rose-500 mb-2" size={24} />
                        <p className="text-xs font-bold text-rose-600">{error}</p>
                    </div>
                ) : null}
                {renderSubView()}
            </div>
        </div>
    );
};

export default CoachHub;
