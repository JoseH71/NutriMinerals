import React from 'react';
import { calculateRatios } from '../../utils/helpers';
import { HEALTH_THRESHOLDS } from '../../utils/healthThresholds';

const HealthAlerts = ({ dayLogs, thresholds }) => {
    const sum = (k) => dayLogs.reduce((a, b) => a + (Number(b[k]) || 0), 0);
    const alerts = [];
    const th = thresholds || HEALTH_THRESHOLDS;

    const na = sum('na'), k = sum('k'), ca = sum('ca'), mg = sum('mg');
    const ratios = calculateRatios(na, k, ca, mg);

    const nightLogs = dayLogs.filter(l => l.timeBlock === 'noche');
    // const nightNa = nightLogs.reduce((a, b) => a + (Number(b.na) || 0), 0);
    // const nightFat = nightLogs.reduce((a, b) => a + (Number(b.fat) || 0), 0);

    if (ratios.naK && ratios.naK > th.ratios.na_k.high) {
        alerts.push({ type: 'warning', icon: '⚖️', msg: `Ratio Na:K elevado (${ratios.naK.toFixed(1)}:1)`, tip: 'Suele venir de procesados o restaurantes. Aumenta potasio (K).' });
    }

    if (k < th.potassium.low && dayLogs.length > 0) {
        alerts.push({ type: 'info', icon: '🍌', msg: `Potasio bajo hoy (${Math.round(k)}mg)`, tip: 'Plátanos, patatas o espinacas ayudan a bajar tensión.' });
    }

    if (mg < th.magnesium.low && dayLogs.length > 0) {
        alerts.push({ type: 'info', icon: '🥜', msg: `Magnesio bajo (${Math.round(mg)}mg)`, tip: 'Frutos secos o chocolate negro son buenas fuentes.' });
    }

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-3 mb-6 animate-fade-in px-1">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-3 ml-2 opacity-70">Alertas de Salud</p>
            {alerts.map((a, i) => (
                <div key={i} className={`p-4 rounded-[1.5rem] flex items-start gap-4 transition-all shadow-sm ${a.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/20 border-2 border-amber-500/20' : 'bg-indigo-100 dark:bg-indigo-900/20 border-2 border-indigo-500/20'}`}>
                    <span className="text-3xl filter drop-shadow-md">{a.icon}</span>
                    <div className="flex-1">
                        <p className={`font-black text-sm leading-tight ${a.type === 'warning' ? 'text-amber-900 dark:text-amber-300' : 'text-indigo-900 dark:text-indigo-300'}`}>{a.msg}</p>
                        <p className={`text-[11px] mt-1.5 font-bold leading-relaxed ${a.type === 'warning' ? 'text-amber-800/70 dark:text-amber-200/50' : 'text-indigo-800/70 dark:text-indigo-200/50'}`}>
                            <span className="bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded-md mr-1.5">💡 TIP</span>
                            {a.tip}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default HealthAlerts;
