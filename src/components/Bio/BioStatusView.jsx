import React, { useState, useEffect, useMemo } from 'react';
import BioGraph from './BioGraph';
import BioPillars from './BioPillars';
import { Icons } from '../Icons';
import { fetchIntervalsData } from '../../utils/intervalsData';

const BioStatusView = ({ logs = [] }) => {
    const [rawMetrics, setRawMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    // Engine: Procesar datos reales con las reglas Antigravity
    const bioState = useMemo(() => {
        if (!rawMetrics) return null;

        const sortedMetrics = [...rawMetrics].sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));
        const last7Days = sortedMetrics.slice(-7);
        const last3Days = sortedMetrics.slice(-3);
        const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const yesterdayLogs = logs.filter(l => l.dateISO === yesterdayDate);
        const yesterdayCals = yesterdayLogs.reduce((sum, l) => sum + (Number(l.calories) || 0), 0);

        // 1. Regla: LA CALLE REGULA
        // Buscamos si hay una salida de bici real (no rodillo) > 2h en los últimos 7 días
        // En Intervals, rodillo suele ser "VirtualRide" o tener el flag "stationary"
        const last7Activities = last7Days.flatMap(d => d.activities || []);
        const bikeStreet = last7Activities.find(a =>
            (a.type === 'Ride' || a.type === 'E-BikeRide') &&
            !a.icu_stationary &&
            !a.icu_virtual_ride &&
            (a.moving_time / 60) >= 120
        );

        // 2. Regla: ENERGÍA
        const energyState = yesterdayCals > 0 && yesterdayCals < 1900 ? 'amber' : 'green';
        const energyStatus = energyState === 'amber' ? 'Fase Conservación' : 'Balance Energético';
        const energyDetail = yesterdayCals > 0 ? `Ayer: ${Math.round(yesterdayCals)} kcal` : 'Sin registros ayer';

        // 3. Regla: ORDEN DE CARGA (Simplificado por ahora)
        const density = last3Days.reduce((sum, d) => sum + d.dailyTSS, 0);
        const isDense = density > 250;

        return {
            graphData: {
                days: last7Days.map(d => ({
                    date: d.date.split('-')[2],
                    hrv: d.hrv,
                    rhr: d.rhr,
                    phase: (d.activities || []).some(a => !a.icu_stationary && (a.moving_time / 60) > 90) ? 'active_cushion' :
                        d.dailyTSS > 80 ? 'accumulation' : 'neutral'
                }))
            },
            pillars: {
                regulation: {
                    state: bikeStreet ? 'green' : 'amber',
                    status: "La Calle Regula",
                    detail: bikeStreet ? "Base aeróbica activa (Colchón)." : "Falta regulador natural (bici calle)."
                },
                energy: {
                    state: energyState,
                    status: energyStatus,
                    detail: energyDetail
                },
                rest: {
                    state: (last3Days[last3Days.length - 1]?.hrv >= 45) ? 'green' : 'amber',
                    status: (last3Days[last3Days.length - 1]?.hrv >= 45) ? "Descanso Vagal" : "Fatiga Autonómica",
                    detail: `HRV última noche: ${Math.round(last3Days[last3Days.length - 1]?.hrv || 0)} ms.`
                }
            },
            insight: bikeStreet
                ? "Tu sistema está equilibrado por la bici calle. Buen momento para cargas."
                : "Sistema sin 'colchón' de calle. El rodillo y las piernas pesarán más hoy."
        };
    }, [rawMetrics, logs]);

    useEffect(() => {
        const load = async () => {
            const data = await fetchIntervalsData(30);
            if (data) setRawMetrics(data);
            setLoading(false);
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 opacity-50 animate-pulse">
                <Icons.Activity className="text-secondary mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Sincronizando con Intervals.icu...</p>
            </div>
        );
    }

    if (!bioState) {
        return (
            <div className="p-10 text-center bg-card rounded-[2.5rem] border border-theme mx-2">
                <Icons.AlertTriangle className="mx-auto text-amber-500 mb-4" size={32} />
                <p className="font-black text-sm uppercase tracking-widest text-primary mb-2">Sin Datos</p>
                <p className="text-xs text-secondary leading-relaxed">No hemos podido sincronizar tus métricas. Revisa tu conexión.</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 animate-fade-in pb-24">
            <div className="flex items-baseline justify-between px-2">
                <h1 className="text-2xl font-black text-primary tracking-tight">Bio-Estado</h1>
                <span className="text-[10px] font-bold text-secondary opacity-60 uppercase tracking-widest">Real Intervals.icu</span>
            </div>

            <BioGraph data={bioState.graphData} />

            <h2 className="text-[12px] font-black text-secondary uppercase tracking-[0.2em] px-2 opacity-60 mt-8">Pilares Fundamentales</h2>
            <BioPillars pillars={bioState.pillars} />

            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-[2rem] border border-indigo-100 dark:border-indigo-800/30 flex gap-4 items-center mt-8">
                <div className="p-3 bg-white dark:bg-indigo-950 rounded-full shadow-sm text-indigo-500 min-w-[44px] flex items-center justify-center">
                    <Icons.Lightbulb size={22} />
                </div>
                <p className="text-[15px] font-bold text-indigo-900 dark:text-indigo-100 leading-snug">
                    {bioState.insight}
                </p>
            </div>
        </div>
    );
};

export default BioStatusView;
