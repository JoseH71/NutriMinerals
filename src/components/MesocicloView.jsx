import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../App'; // We'll export db from App for now or move it to a config
import { MESOCICLO_DATA } from '../utils/mesocicloData';

// We need APP_ID and SHARED_USER_ID
const APP_ID = 'nutriminerals_RESERVADO_PERMANENTE';
const SHARED_USER_ID = 'lFxF03U8OjgJo8teUltrcKjAGPJ2';

const MesocicloView = ({ useFirebase, dbRef, appId }) => {
    const [trainingStatus, setTrainingStatus] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('trainingStatus') || '{}');
        } catch { return {}; }
    });

    // Sync with Firebase
    useEffect(() => {
        if (!useFirebase || !dbRef.current) return;
        const path = ['artifacts', appId, 'users', SHARED_USER_ID, 'data', 'training_status'];
        const docRef = doc(dbRef.current, ...path);

        const unsub = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const remoteData = snap.data();
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
        else next = null;

        const newState = { ...trainingStatus };
        if (next) newState[id] = next;
        else delete newState[id];

        setTrainingStatus(newState);
        localStorage.setItem('trainingStatus', JSON.stringify(newState));

        if (useFirebase && dbRef.current) {
            try {
                const path = ['artifacts', appId, 'users', SHARED_USER_ID, 'data', 'training_status'];
                const docRef = doc(dbRef.current, ...path);
                await setDoc(docRef, newState);
            } catch (e) {
                console.error("Error syncing status:", e);
            }
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'done': return {
                bg: 'bg-emerald-100 dark:bg-emerald-900/40',
                border: 'border-emerald-500/50',
                icon: '✅',
                textMain: 'text-emerald-900 dark:text-emerald-100',
                textSub: 'text-emerald-800 dark:text-emerald-200',
                badge: 'bg-emerald-200 dark:bg-emerald-800/50 border-emerald-500/30'
            };
            case 'modified': return {
                bg: 'bg-amber-100 dark:bg-amber-900/40',
                border: 'border-amber-500/50',
                icon: '🟧',
                textMain: 'text-amber-900 dark:text-amber-100',
                textSub: 'text-amber-800 dark:text-amber-200',
                badge: 'bg-amber-200 dark:bg-amber-800/50 border-amber-500/30'
            };
            case 'missed': return {
                bg: 'bg-rose-100 dark:bg-rose-900/40',
                border: 'border-rose-500/50',
                icon: '❌',
                opacity: 'opacity-60 grayscale',
                textMain: 'text-rose-900 dark:text-rose-100',
                textSub: 'text-rose-800 dark:text-rose-200',
                badge: 'bg-rose-200 dark:bg-rose-800/50 border-rose-500/30'
            };
            default: return {
                bg: 'bg-card-alt',
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
                <h2 className="text-2xl font-black text-primary tracking-tighter">Mesociclo</h2>
                <span className="text-[10px] text-secondary">Plan Actual</span>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl flex items-start gap-2 text-xs text-blue-800 dark:text-blue-200 mb-2">
                <span className="text-lg">👆</span>
                <p>Toca los días para marcarlos: <span className="text-emerald-600 font-bold">Hecho</span>, <span className="text-amber-600 font-bold">Modificado</span> o <span className="text-rose-600 font-bold">Saltado</span>.</p>
            </div>

            {MESOCICLO_DATA.semanas.map((sem) => (
                <section key={sem.num} className="bg-card rounded-3xl p-5 border border-theme shadow-sm overflow-hidden">
                    <header className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-lg">
                            Semana {sem.num} <span className="text-sm font-normal text-secondary opacity-70 ml-1">{sem.rango}</span>
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
                                    className={`flex flex-col p-3 rounded-xl border border-theme/50 relative cursor-pointer transition-all active:scale-95 select-none ${styles.bg} ${styles.border} ${styles.opacity || ''}`}
                                >
                                    {status && <div className="absolute top-2 right-2 text-sm">{styles.icon}</div>}
                                    <span className={`text-[10px] font-bold uppercase mb-1 ${styles.textSub}`}>{d.dia}</span>
                                    <span className={`font-bold text-sm leading-tight mb-1 pr-4 ${styles.textMain}`}>{d.actividad}</span>
                                    <div className="mt-auto flex justify-between items-end">
                                        <span className={`text-[10px] ${styles.textSub}`}>{d.dur}</span>
                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${styles.badge} ${styles.textMain}`}>{d.tss} TSS</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-3 flex justify-end">
                        <span className="text-[10px] font-bold text-secondary bg-card px-2 py-1 rounded-lg border border-theme">
                            Total TSS: {sem.tssSemanal}
                        </span>
                    </div>
                </section>
            ))}

            <section className="border border-dashed border-theme rounded-3xl p-5 bg-card/50">
                <h3 className="font-black text-xs uppercase text-secondary mb-3 tracking-widest">Resumen del Bloque</h3>
                <ul className="space-y-2 text-sm font-medium text-primary/80">
                    <li className="flex items-start gap-2"><span className="text-indigo-500">•</span> Semanas carga: ~380 / 395 / 415 TSS</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-500">•</span> Semana descarga: ~145 TSS</li>
                </ul>
            </section>
        </div>
    );
};

export default MesocicloView;
