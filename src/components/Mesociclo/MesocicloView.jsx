import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { SHARED_USER_ID } from '../../config/firebase';

const mesociclo = {
    semanas: [
        {
            num: 1,
            rango: "05/01 – 11/01",
            tipo: "CARGA",
            dias: [
                { dia: "Lunes 05", actividad: "Gym Pierna", dur: "50 min", tss: 55 },
                { dia: "Martes 06", actividad: "Zwift TdZ / Grupeta tempo", dur: "60-70 min", tss: 60 },
                { dia: "Miércoles 07", actividad: "Gym Upper", dur: "50 min", tss: 45 },
                { dia: "Jueves 08", actividad: "Descanso o rodillo suave", dur: "0-40 min", tss: "0-20" },
                { dia: "Viernes 09", actividad: "Gym Estética + Gemelo", dur: "50 min", tss: 50 },
                { dia: "Sábado 10", actividad: "Zwift TdZ / Grupeta larga", dur: "75-90 min", tss: 80 },
                { dia: "Domingo 11", actividad: "Zwift fondo controlado", dur: "90-105 min", tss: 90 }
            ],
            tssSemanal: 380
        },
        {
            num: 2,
            rango: "12/01 – 18/01",
            tipo: "CARGA",
            dias: [
                { dia: "Lunes 12", actividad: "Gym Pierna", dur: "50 min", tss: 55 },
                { dia: "Martes 13", actividad: "Zwift TdZ / Grupeta tempo", dur: "65-75 min", tss: 65 },
                { dia: "Miércoles 14", actividad: "Gym Upper", dur: "50 min", tss: 45 },
                { dia: "Jueves 15", actividad: "Descanso o rodillo suave", dur: "0-40 min", tss: "0-20" },
                { dia: "Viernes 16", actividad: "Gym Estética + Gemelo", dur: "50 min", tss: 50 },
                { dia: "Sábado 17", actividad: "Zwift TdZ / Grupeta larga", dur: "85-95 min", tss: 85 },
                { dia: "Domingo 18", actividad: "Zwift fondo controlado", dur: "95-110 min", tss: 95 }
            ],
            tssSemanal: 395
        },
        {
            num: 3,
            rango: "19/01 – 25/01",
            tipo: "CARGA",
            dias: [
                { dia: "Lunes 19", actividad: "Gym Pierna", dur: "50 min", tss: 60 },
                { dia: "Martes 20", actividad: "Zwift TdZ / Grupeta tempo", dur: "70-80 min", tss: 65 },
                { dia: "Miércoles 21", actividad: "Gym Upper", dur: "50 min", tss: 50 },
                { dia: "Jueves 22", actividad: "Descanso o rodillo suave", dur: "0-40 min", tss: "0-20" },
                { dia: "Viernes 23", actividad: "Gym Estética + Gemelo", dur: "50 min", tss: 55 },
                { dia: "Sábado 24", actividad: "Zwift TdZ / Grupeta larga", dur: "90-100 min", tss: 90 },
                { dia: "Domingo 25", actividad: "Zwift fondo controlado", dur: "100-115 min", tss: 95 }
            ],
            tssSemanal: 415
        },
        {
            num: 4,
            rango: "26/01 – 01/02",
            tipo: "DESCARGA",
            dias: [
                { dia: "Lunes 26", actividad: "Gym ligero", dur: "40 min", tss: 30 },
                { dia: "Martes 27", actividad: "Zwift Z2 / grupeta suave", dur: "50-60 min", tss: 40 },
                { dia: "Miércoles 28", actividad: "Gym ligero", dur: "40 min", tss: 30 },
                { dia: "Jueves 29", actividad: "Descanso", dur: "—", tss: 0 },
                { dia: "Viernes 30", actividad: "Descanso o movilidad", dur: "—", tss: 0 },
                { dia: "Sábado 31", actividad: "Zwift suave", dur: "60-70 min", tss: 45 },
                { dia: "Domingo 01", actividad: "Libre / descanso", dur: "—", tss: 0 }
            ],
            tssSemanal: 145
        }
    ]
};

const MesocicloView = ({ useFirebase, dbRef, appId }) => {
    const [trainingStatus, setTrainingStatus] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('trainingStatus') || '{}');
        } catch { return {}; }
    });

    // Sync with Firebase
    useEffect(() => {
        if (!useFirebase || !dbRef || !dbRef.current) return;

        const path = `artifacts/${appId}/users/${SHARED_USER_ID}/data/training_status`;
        const docRef = doc(dbRef.current, path);

        const unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const remoteData = docSnap.data();
                setTrainingStatus(remoteData);
                localStorage.setItem('trainingStatus', JSON.stringify(remoteData));
            }
        });
        return () => unsub();
    }, [useFirebase, appId, dbRef]);

    const toggleStatus = async (weekNum, dayIndex) => {
        const id = `w${weekNum}d${dayIndex}`;
        const current = trainingStatus[id];
        let next = null;
        if (!current) next = 'done';
        else if (current === 'done') next = 'modified';
        else if (current === 'modified') next = 'missed';
        else next = null; // back to default

        const newState = { ...trainingStatus };
        if (next) newState[id] = next;
        else delete newState[id];

        // 1. Optimistic Local Update
        setTrainingStatus(newState);
        localStorage.setItem('trainingStatus', JSON.stringify(newState));

        // 2. Firebase Update
        if (useFirebase && dbRef && dbRef.current) {
            try {
                const path = `artifacts/${appId}/users/${SHARED_USER_ID}/data/training_status`;
                const docRef = doc(dbRef.current, path);
                await setDoc(docRef, newState);
            } catch (e) {
                console.error("Error syncing status:", e);
            }
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'done': return {
                bg: 'bg-emerald-100 dark:bg-emerald-900/30',
                border: 'border-emerald-500/50',
                icon: '✅',
                textMain: 'text-emerald-900 dark:text-emerald-100',
                textSub: 'text-emerald-800 dark:text-emerald-200',
                badge: 'bg-emerald-200 dark:bg-emerald-800/50 border-emerald-500/30'
            };
            case 'modified': return {
                bg: 'bg-amber-100 dark:bg-amber-900/30',
                border: 'border-amber-500/50',
                icon: '🟧',
                textMain: 'text-amber-900 dark:text-amber-100',
                textSub: 'text-amber-800 dark:text-amber-200',
                badge: 'bg-amber-200 dark:bg-amber-800/50 border-amber-500/30'
            };
            case 'missed': return {
                bg: 'bg-rose-100 dark:bg-rose-900/30',
                border: 'border-rose-500/50',
                icon: '❌',
                opacity: 'opacity-60 grayscale',
                textMain: 'text-rose-900 dark:text-rose-100',
                textSub: 'text-rose-800 dark:text-rose-200',
                badge: 'bg-rose-200 dark:bg-rose-800/50 border-rose-500/30'
            };
            default: return {
                bg: 'bg-card',
                border: 'border-theme/50',
                icon: null,
                textMain: 'text-primary',
                textSub: 'text-secondary',
                badge: 'bg-card border-theme/30'
            };
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex justify-between items-center px-2">
                <h2 className="text-2xl font-black text-primary tracking-tighter uppercase">Mesociclo</h2>
                <span className="text-[10px] font-black text-secondary tracking-widest uppercase opacity-70">Plan Actual</span>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-2xl flex items-start gap-3 text-xs text-indigo-800 dark:text-indigo-300 mb-2 border border-indigo-200/50 dark:border-indigo-800/30">
                <span className="text-xl">👆</span>
                <p className="font-medium leading-relaxed">Toca los días para marcarlos: <span className="text-emerald-600 dark:text-emerald-400 font-bold">Hecho</span>, <span className="text-amber-600 dark:text-amber-400 font-bold">Modificado</span> o <span className="text-rose-600 dark:text-rose-400 font-bold">Saltado</span>.</p>
            </div>

            {mesociclo.semanas.map((sem) => (
                <section key={sem.num} className="bg-card rounded-3xl p-5 border border-theme shadow-sm overflow-hidden text-primary">
                    <header className="flex justify-between items-center mb-5">
                        <h3 className="font-black text-lg">
                            Semana {sem.num} <span className="text-[10px] font-bold text-secondary tracking-widest ml-2 opacity-50">{sem.rango}</span>
                        </h3>
                        <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${sem.tipo === "CARGA"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                }`}
                        >
                            {sem.tipo}
                        </span>
                    </header>

                    <div className="grid grid-cols-2 gap-2">
                        {sem.dias.map((d, i) => {
                            const status = trainingStatus[`w${sem.num}d${i}`];
                            const styles = getStatusStyles(status);
                            return (
                                <div
                                    key={i}
                                    onClick={() => toggleStatus(sem.num, i)}
                                    className={`flex flex-col p-3 rounded-2xl border transition-all active:scale-95 select-none relative ${styles.bg} ${styles.border} ${styles.opacity || ''}`}
                                >
                                    {status && <div className="absolute top-2 right-2 text-sm">{styles.icon}</div>}
                                    <span className={`text-[9px] font-black uppercase mb-1 tracking-tighter ${styles.textSub}`}>{d.dia.split(" ")[0]} <span className={styles.textMain}>{d.dia.split(" ")[1]}</span></span>
                                    <span className={`font-black text-xs leading-tight mb-2 pr-4 h-8 overflow-hidden line-clamp-2 ${styles.textMain}`}>{d.actividad}</span>
                                    <div className="mt-auto flex justify-between items-end gap-1">
                                        <span className={`text-[9px] font-bold uppercase opacity-70 ${styles.textSub}`}>{d.dur}</span>
                                        <span className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded-lg border whitespace-nowrap ${styles.badge} ${styles.textMain}`}>{d.tss} TSS</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <span className="text-[10px] font-black text-secondary bg-card-alt px-3 py-1.5 rounded-xl border border-theme shadow-inner">
                            TOTAL SEMANAL: <span className="text-secondary">{sem.tssSemanal} TSS</span>
                        </span>
                    </div>
                </section>
            ))}

            <section className="border border-dashed border-theme rounded-3xl p-6 bg-card-alt/50">
                <h3 className="font-black text-[10px] uppercase text-secondary mb-4 tracking-widest opacity-70">Resumen del Bloque</h3>
                <ul className="space-y-3 text-xs font-bold text-primary/80">
                    <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/20"></span> Semanas carga: ~380 / 395 / 415 TSS</li>
                    <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></span> Semana descarga: ~145 TSS</li>
                </ul>
            </section>
        </div>
    );
};

export default MesocicloView;
