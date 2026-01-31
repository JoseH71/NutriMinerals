import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query as firestoreQuery, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Icons } from './components/Icons';
import { searchLocalDB } from './utils/foodDatabase';
import { HEALTH_THRESHOLDS } from './utils/healthThresholds';
import { getTimeBlock } from './utils/helpers';
import { firebaseConfig, APP_ID, SHARED_USER_ID, GEMINI_API_KEY, auth, db as firebaseDb } from './config/firebase';

// Shared Components
import EntryView from './components/Entry/EntryView';
import DiaryView from './components/Diary/DiaryView';
import SafeView from './components/Common/SafeView';
import BioStatusView from './components/Bio/BioStatusView';
import SaludView from './components/Common/SaludView';
import HistoryView from './components/History/HistoryView';
import DinnerProtocolView from './components/Dinner/DinnerProtocolView';
import CoachHub from './components/Coach/CoachHub';

import './App.css';

// Initialize Firebase
export let db = firebaseDb;
// Auth is now imported directly from firebase.js

function App() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [myFoods, setMyFoods] = useState([]);
  const [dinnerFeedback, setDinnerFeedback] = useState([]);
  const [wisdomLogs, setWisdomLogs] = useState([]);
  const [wisdomSummary, setWisdomSummary] = useState(null);
  const [manualDayType, setManualDayType] = useState(null);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'entrada');

  // Persist active tab to avoid loss on refresh
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(`Error attempting to enable fullscreen: ${err.message}`));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false));
    }
  };

  // Entry view state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // DEBUG STATE
  const [debugLog, setDebugLog] = useState([]);
  const logDebug = (msg) => {
    console.log(msg);
    setDebugLog(prev => [msg, ...prev].slice(0, 20));
  };
  const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString('sv')); // YYYY-MM-DD
  const [foodToEdit, setFoodToEdit] = useState(null); // Coordinate editing from other tabs

  // Initialize Firebase auth
  useEffect(() => {
    if (!auth) {
      setFirebaseError('Firebase no disponible');
      setFirebaseReady(true);
      return;
    }

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setFirebaseReady(true);
      } else {
        signInAnonymously(auth)
          .then(() => setFirebaseReady(true))
          .catch(e => {
            console.error('Auth error:', e);
            setFirebaseError(e.message);
            setFirebaseReady(true);
          });
      }
    }, (error) => {
      console.error('Auth state error:', error);
      setFirebaseError(error.message);
      setFirebaseReady(true);
    });

    return () => unsubAuth();
  }, []);

  // Subscribe to Firestore logs
  useEffect(() => {
    if (!user || !db) return;
    const uid = SHARED_USER_ID;

    try {
      const logsRef = collection(db, `artifacts/${APP_ID}/users/${uid}/food_logs`);
      const unsubLogs = onSnapshot(firestoreQuery(logsRef), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, _docId: d.id, ...d.data() }));
        setLogs(data);
      }, (error) => {
        console.error('Firestore logs error:', error);
      });

      const foodsRef = collection(db, `artifacts/${APP_ID}/users/${uid}/my_foods`);
      const unsubFoods = onSnapshot(firestoreQuery(foodsRef), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMyFoods(data);
      }, (error) => {
        console.error('Firestore foods error:', error);
      });

      const feedbackRef = collection(db, `artifacts/${APP_ID}/users/${uid}/dinner_feedback`);
      const unsubFeedback = onSnapshot(firestoreQuery(feedbackRef), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDinnerFeedback(data);
      }, (error) => {
        console.error('Firestore feedback error:', error);
      });

      const settingsRef = doc(db, `artifacts/${APP_ID}/users/${uid}/settings`, 'preferences');
      const unsubSettings = onSnapshot(settingsRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.manualDayType !== undefined) {
            setManualDayType(data.manualDayType);
          }
        }
      }, (error) => {
        console.error('Firestore settings error:', error);
      });

      const wisdomRef = collection(db, `artifacts/${APP_ID}/users/${uid}/wisdom_logs`);
      const unsubWisdom = onSnapshot(firestoreQuery(wisdomRef), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWisdomLogs(data.sort((a, b) => b.timestamp - a.timestamp));
      }, (error) => {
        console.error('Firestore wisdom logs error:', error);
      });

      const summaryRef = doc(db, `artifacts/${APP_ID}/users/${uid}/settings`, 'wisdom_summary');
      const unsubSummary = onSnapshot(summaryRef, (snap) => {
        if (snap.exists()) setWisdomSummary(snap.data());
      }, (error) => {
        console.error('Firestore wisdom summary error:', error);
      });

      return () => { unsubLogs(); unsubFoods(); unsubFeedback(); unsubSettings(); unsubWisdom(); unsubSummary(); };
    } catch (e) {
      console.error('Firestore setup error:', e);
    }
  }, [user]);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Totals for selected date (for Entry view)
  const selectedDayLogs = useMemo(() => logs.filter(l => l.dateISO === entryDate), [logs, entryDate]);

  // Today's logs (for Salud view - always today, not selected entry date)
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = useMemo(() => logs.filter(l => l.dateISO === today), [logs]);

  // Add food log
  const addLog = async (food, idToUpdate = null) => {
    if (!db) return;
    const uid = SHARED_USER_ID;
    const id = idToUpdate || Date.now().toString();
    const log = {
      ...food,
      id,
      dateStr: new Date(entryDate).toLocaleDateString(), // Legacy format
      dateISO: entryDate,
      timeBlock: food.timeBlock || getTimeBlock(), // Respect provided block or use current
      timestamp: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/food_logs`, id), log);
      // Removed setQuery('') and setSearchResults([]) to allow multi-add from same search
    } catch (e) {
      console.error('Add/Update log error:', e);
    }
  };

  // Save dinner feedback
  const saveDinnerFeedback = async (dateISO, symptoms) => {
    if (!db) return;
    const uid = SHARED_USER_ID;
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/dinner_feedback`, dateISO), {
        dateISO,
        symptoms,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error('Save feedback error:', e);
    }
  };

  // Save manual day type
  const saveManualDayType = async (value) => {
    if (!db) return;
    const uid = SHARED_USER_ID;
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/settings`, 'preferences'), {
        manualDayType: value,
        timestamp: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('Save manualDayType error:', e);
    }
  };

  // Delete food log
  const deleteLog = async (id) => {
    if (!db) return;
    const uid = SHARED_USER_ID;
    try {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/food_logs`, id));
    } catch (e) {
      console.error('Delete log error:', e);
    }
  };

  const editLog = (log) => {
    setFoodToEdit(log);
    // Normalize date to YYYY-MM-DD
    let dateISO = log.dateISO;
    if (!dateISO && log.dateStr) {
      const parts = log.dateStr.split('/');
      if (parts.length === 3) {
        dateISO = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    if (dateISO) setEntryDate(dateISO);
    setActiveTab('entrada');
  };

  // Search foods
  // Search foods (Text or Image) with improved reliability
  const searchFoods = async (q, imageFile = null) => {
    setLoading(true);
    setSearchResults([]); // Clear previous results
    setFirebaseError(null); // Clear previous errors

    // 1. Text Search Logic with Complexity Check (Legacy behavior)
    if (!imageFile) {
      if (!q.trim()) { setLoading(false); return; }

      // 1. Determine if it's a complex recipe/phrase or a simple food item
      const isComplex = q.split(' ').length > 2 || / y | con | e | \+ |,| al | del | para /i.test(q);

      // FORCE AI FOR NOW to debug user issue ("no encuentra una mierda")
      // We will only use local search if it is a SUPER simple single word query and EXACT match
      // This is a temporary aggressive fix to prioritize "intelligence" over speed
      const forceAI = true;

      if (!forceAI && !isComplex) {
        // Simple query: check local and personal foods first (fastest)
        const localResult = searchLocalDB(q);
        if (localResult) {
          setSearchResults([localResult]);
          setLoading(false);
          return;
        }

        const myMatch = myFoods.find(f => f.name?.toLowerCase().includes(q.toLowerCase()));
        if (myMatch) {
          setSearchResults([{ ...myMatch, confidence: 'alta (mis alimentos)' }]);
          setLoading(false);
          return;
        }
      } else {
        logDebug("🧠 Modo Inteligente Activado: Consultando a Gemini...");
      }
    }

    // 2. AI Search (Gemini) with automatic retries
    const performSearch = async (attempt = 1, maxAttempts = 3) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased to 20s for image processing

      try {
        const jsonSchema = `{
          "results": [
            {
              "name": "nombre descriptivo del alimento",
              "portion": "cantidad estimada (ej: 150g, 1 unidad)",
              "calories": N,
              "protein": N,
              "carbs": N,
              "fat": N,
              "fiber": N,
              "na": N,
              "k": N,
              "ca": N,
              "mg": N,
              "confidence": "alta"|"media"|"baja"
            }
          ]
        }`;

        let requestBody;
        const model = 'gemini-2.0-flash';
        console.log(`🤖 IA Iniciando: ${imageFile ? 'CÁMARA' : 'TEXTO'} - ${q || 'Imagen'}`);

        if (imageFile) {
          // --- IMAGE SEARCH ---
          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          await new Promise(resolve => reader.onload = resolve);
          const base64Data = reader.result.split(',')[1];
          const mimeType = imageFile.type || 'image/jpeg';
          logDebug(`📸 Imagen: ${(base64Data.length / 1024).toFixed(1)} KB`);

          const prompt = `Analiza esta fotografía de comida. 
          TAREAS:
          1. Identifica cada alimento estrictamente en ESPAÑOL (ej: si es una naranja, nómbrala "Naranja"; si es un plato de pasta, identifica sus partes en español).
          2. Estima la ración visual y calcula valores nutricionales realistas (Calories, Prot, Carbs, Fat, Fiber, Na, K, Ca, Mg).
          3. IMPORTANTE: Si es una pieza única (1 fruta, 1 huevo, 1 yogur), usa ración "1 unidad".
          4. IMPORTANTE: Todos los campos de texto ("name" y "portion") deben estar en ESPAÑOL.
          5. RESPONDE EXCLUSIVAMENTE CON EL SIGUIENTE FORMATO JSON (sin texto antes ni después):
          
          ${jsonSchema}`;

          requestBody = {
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192, // Increased significantly as newer models use more tokens for reasoning
              response_mime_type: "application/json"
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          };
        } else {
          // --- TEXT SEARCH ---
          const prompt = `Calcula nutrición para: "${q}". 
          IMPORTANTE: Responde con los nombres de los alimentos y raciones estrictamente en ESPAÑOL.
          Si hay varios platos, desglósalos. Responde SOLO JSON con esquema: ${jsonSchema}`;
          logDebug(`🔤 Texto: "${q}"`);

          requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              response_mime_type: "application/json"
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          };
        }

        logDebug(`🤖 Enviando a Gemini (${model})...`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
          logDebug(`❌ ERROR API: ${err.error?.message || res.status}`);
          throw new Error(err.error?.message || `Error del servidor (${res.status})`);
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const finishReason = data.candidates?.[0]?.finishReason;

        logDebug("✅ Respuesta recibida...");

        if (!rawText) {
          console.error("Gemini response missing text:", data);
          throw new Error(`La IA no devolvió texto. Razón: ${finishReason || 'Desconocida'}`);
        }

        // Robust JSON Parsing (Regex cleaning)
        let parsedData = null;
        try {
          // Primero intentamos JSON puro
          parsedData = JSON.parse(rawText);
        } catch (e) {
          // Si falla, buscamos bloques de código o llaves { }
          try {
            const cleanText = rawText.match(/\{[\s\S]*\}/)?.[0] || rawText;
            parsedData = JSON.parse(cleanText);
          } catch (e2) {
            logDebug("❌ JSON Invalido");
            console.error("❌ Fallo crítico de parseo JSON:", rawText);
            throw new Error('No se pudo procesar la respuesta nutricional');
          }
        }

        // Normalize output to array of results
        let foodList = [];
        if (parsedData.results && Array.isArray(parsedData.results)) {
          foodList = parsedData.results;
        } else if (Array.isArray(parsedData)) {
          foodList = parsedData;
        } else if (parsedData.name) {
          foodList = [parsedData];
        }

        if (foodList.length === 0) throw new Error('No se encontraron alimentos en la respuesta');

        const p = (v) => Math.max(0, Number(v) || 0);
        const finalResults = foodList.map(f => ({
          name: f.name || 'Alimento desconocido',
          portion: f.portion || '1 ración',
          calories: p(f.calories),
          protein: p(f.protein),
          carbs: p(f.carbs),
          fat: p(f.fat),
          fiber: p(f.fiber),
          na: p(f.na),
          k: p(f.k),
          ca: p(f.ca),
          mg: p(f.mg),
          confidence: f.confidence || (imageFile ? 'media' : 'estimado'),
          dataSource: 'gemini'
        }));

        setSearchResults(finalResults);
        setFirebaseError(null);
        logDebug("✨ ÉXITO: Datos listos");

      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`Search error (attempt ${attempt}/${maxAttempts}):`, e);
        logDebug(`⚠️ Error (intento ${attempt}): ${e.message}`);

        if (attempt < maxAttempts && (e.name === 'AbortError' || e.message.includes('fetch'))) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          return performSearch(attempt + 1, maxAttempts);
        }

        setFirebaseError(e.name === 'AbortError' ? "Tiempo de espera agotado. Intenta de nuevo." : `Error: ${e.message}`);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  };

  // Save food to personal catalog
  const saveToMyFoods = async (food) => {
    if (!db) return;
    const uid = SHARED_USER_ID;
    const id = food.id || `food_${Date.now()}`;
    const newFood = {
      ...food,
      id,
      timestamp: serverTimestamp()
    };
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/my_foods`, id), newFood, { merge: true });
    } catch (e) {
      console.error('Save my food error:', e);
    }
  };

  const deleteMyFood = async (id) => {
    if (!db) return;
    const uid = SHARED_USER_ID;
    try {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/my_foods`, id));
    } catch (e) {
      console.error('Delete my food error:', e);
    }
  };

  // Export/Import
  const exportData = () => {
    const data = { logs, myFoods, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutriminerals-backup-${today}.json`;
    a.click();
  };

  const saveWisdomLog = async (log) => {
    if (!db) return;
    try {
      const uid = SHARED_USER_ID;
      const ref = doc(collection(db, `artifacts/${APP_ID}/users/${uid}/wisdom_logs`));
      await setDoc(ref, {
        ...log,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('sv')
      });
    } catch (e) {
      console.error('Save wisdom log error:', e);
    }
  };

  const saveWisdomSummary = async (summary) => {
    if (!db) return;
    try {
      const uid = SHARED_USER_ID;
      const ref = doc(db, `artifacts/${APP_ID}/users/${uid}/settings`, 'wisdom_summary');
      await setDoc(ref, {
        ...summary,
        lastUpdated: Date.now()
      });
    } catch (e) {
      console.error('Save wisdom summary error:', e);
    }
  };

  const deleteWisdomLog = async (id) => {
    if (!db) return;
    try {
      const uid = SHARED_USER_ID;
      await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/wisdom_logs`, id));
    } catch (e) {
      console.error('Delete wisdom log error:', e);
    }
  };

  const importData = async (file) => {
    if (!db) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const uid = SHARED_USER_ID;

      if (data.logs) {
        for (const log of data.logs) {
          await setDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/food_logs`, log.id || Date.now().toString()), log);
        }
      }
      if (data.myFoods) {
        for (const food of data.myFoods) {
          await setDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/my_foods`, food.id || Date.now().toString()), food);
        }
      }
    } catch (e) {
      console.error('Import error:', e);
    }
  };

  const tabs = [
    { id: 'entrada', label: 'Entrada', icon: Icons.PlusCircle },
    { id: 'diario', label: 'Diario', icon: Icons.Book },
    { id: 'salud', label: 'Salud', icon: Icons.Heart },
    { id: 'cenas', label: 'Cenas', icon: Icons.Utensils },
    { id: 'bio', label: 'Bio', icon: Icons.Activity },
    { id: 'historial', label: 'Historial', icon: Icons.History },
    { id: 'coach', label: 'Entrenador', icon: Icons.Bike },
  ];

  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const renderView = () => {
    console.log("Rendering active tab:", activeTab); // Debugging
    switch (activeTab) {
      case 'entrada':
        return <SafeView>
          <EntryView
            today={selectedDayLogs}
            loading={loading}
            searchFoods={searchFoods}
            addLog={addLog}
            query={query}
            setQuery={setQuery}
            searchResults={searchResults}
            firebaseError={firebaseError}
            deleteLog={deleteLog}
            entryDate={entryDate}
            setEntryDate={setEntryDate}
            myFoods={myFoods}
            allLogs={logs}
            onSaveFood={saveToMyFoods}
            onDeleteFood={deleteMyFood}
            foodToEdit={foodToEdit}
            onClearFoodToEdit={() => setFoodToEdit(null)}
          />
        </SafeView>;
      case 'diario':
        return <SafeView><DiaryView
          logs={logs} onDelete={deleteLog} thresholds={HEALTH_THRESHOLDS} tssToday={0}
          onSaveFood={saveToMyFoods} myFoods={myFoods} manualDayType={manualDayType} onSaveManualDayType={saveManualDayType}
          dinnerFeedback={dinnerFeedback} /></SafeView>;
      case 'bio':
        return <SafeView><BioStatusView logs={logs} /></SafeView>;
      case 'salud':
        return <SafeView><SaludView allLogs={logs} dayLogs={todayLogs} tssToday={0} dinnerFeedback={dinnerFeedback} onSaveFeedback={saveDinnerFeedback} manualDayType={manualDayType} onSaveManualDayType={saveManualDayType} /></SafeView>;
      // Removed standalone Catalog view
      case 'historial':
        return <SafeView><HistoryView
          logs={logs} onExport={exportData} onImport={importData}
          user={user} onSaveFood={saveToMyFoods} myFoods={myFoods}
          onDelete={deleteLog} onEdit={editLog}
          wisdomLogs={wisdomLogs}
          wisdomSummary={wisdomSummary}
          onSaveWisdom={saveWisdomLog}
          onSaveWisdomSummary={saveWisdomSummary}
          onDeleteWisdom={deleteWisdomLog}
        /></SafeView>;
      case 'cenas':
        return <SafeView><DinnerProtocolView logs={logs} dinnerFeedback={dinnerFeedback} onSaveFeedback={saveDinnerFeedback} /></SafeView>;
      case 'coach':
        return <SafeView><CoachHub logs={logs} useFirebase={!!db} dbRef={dbRef} appId={APP_ID} /></SafeView>;
      default:
        return <SafeView>
          <EntryView
            today={selectedDayLogs}
            loading={loading}
            searchFoods={searchFoods}
            addLog={addLog}
            query={query}
            setQuery={setQuery}
            searchResults={searchResults}
            firebaseError={firebaseError}
            deleteLog={deleteLog}
            entryDate={entryDate}
            setEntryDate={setEntryDate}
            myFoods={myFoods}
            allLogs={logs}
            onSaveFood={saveToMyFoods}
            onDeleteFood={deleteMyFood}
            foodToEdit={foodToEdit}
            onClearFoodToEdit={() => setFoodToEdit(null)}
          />
        </SafeView>;
    }
  };

  // Show loading if Firebase not ready
  if (!firebaseReady) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center p-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
          <Icons.Loader2 className="w-16 h-16 animate-spin text-indigo-600 relative z-10" />
        </div>
        <p className="text-2xl font-black mt-8 tracking-tighter uppercase italic text-primary">Sincronizando Sistema</p>
        <p className="text-secondary text-[10px] font-bold uppercase tracking-widest mt-2 opacity-50">Nutriminerals Pro v2.2 (Cámara Fix)</p>
      </div>
    );
  }

  return (
    <div className="bg-app min-h-[101vh]">
      <header className="fixed top-0 inset-x-0 bg-gradient-to-r from-indigo-700 to-indigo-600 text-white px-5 py-4 flex items-center justify-between pt-safe shadow-lg z-50 h-16">
        <h1 className="text-xl font-black tracking-tighter uppercase italic flex items-center gap-2">
          <span className="bg-white text-indigo-700 px-1.5 rounded-lg not-italic">N</span>
          Nutriminerals
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={toggleFullScreen} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 text-white">
            {isFullscreen ? <Icons.Minimize size={20} /> : <Icons.Maximize size={20} />}
          </button>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95">
            {darkMode ? <Icons.Sun size={20} /> : <Icons.Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="bg-app relative pt-20 pb-24">
        <div className="max-w-xl mx-auto px-4">
          {renderView()}
        </div>
      </main>

      {/* Success/Status Toast Notification */}
      {debugLog.length > 0 && debugLog[0].includes('ÉXITO') && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[100] animate-bounce-in">
          <Icons.Sparkles size={20} className="text-yellow-300 animate-pulse" />
          <span className="font-bold text-sm tracking-wide">¡Alimento Detectado!</span>
        </div>
      )}

      {/* Main Navigation Bar */}
      {/* Main Navigation Bar - Floating Premium Design */}
      <nav className="fixed bottom-6 left-4 right-4 z-50 pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <div className="bg-slate-900/80 dark:bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[3rem] px-2 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex justify-between items-center relative overflow-hidden">
            {/* Ambient background glow inside the bar */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-pink-500/5 pointer-events-none"></div>

            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              // Unique color themes for each tab to give "joy" and "life"
              const getTabTheme = (id) => {
                switch (id) {
                  case 'entrada': return { color: 'text-emerald-400', bg: 'bg-emerald-400/20', shadow: 'shadow-emerald-500/40' };
                  case 'diario': return { color: 'text-amber-400', bg: 'bg-amber-400/20', shadow: 'shadow-amber-500/40' };
                  case 'bio': return { color: 'text-rose-400', bg: 'bg-rose-400/20', shadow: 'shadow-rose-500/40' };
                  case 'salud': return { color: 'text-indigo-400', bg: 'bg-indigo-400/20', shadow: 'shadow-indigo-500/40' };
                  case 'historial': return { color: 'text-sky-400', bg: 'bg-sky-400/20', shadow: 'shadow-sky-500/40' };
                  case 'cenas': return { color: 'text-yellow-400', bg: 'bg-yellow-400/20', shadow: 'shadow-yellow-500/40' };
                  case 'coach': return { color: 'text-orange-400', bg: 'bg-orange-400/20', shadow: 'shadow-orange-500/40' };
                  default: return { color: 'text-indigo-400', bg: 'bg-indigo-400/20', shadow: 'shadow-indigo-500/40' };
                }
              };

              const theme = getTabTheme(tab.id);

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-500 ease-spring ${isActive ? 'flex-[2] sm:flex-[1.5]' : 'flex-1'
                    }`}
                >
                  {isActive && (
                    <span className={`absolute inset-0 ${theme.bg} rounded-[2rem] blur-sm animate-pulse scale-90`} />
                  )}

                  <div className={`relative z-10 flex items-center justify-center p-2 rounded-xl transition-all duration-500 ${isActive ? `${theme.color} ${theme.bg} ${theme.shadow} scale-110 shadow-lg` : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    <Icon
                      size={isActive ? 24 : 22}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`transition-transform duration-500 ${isActive ? 'rotate-[360deg]' : ''}`}
                    />

                    {isActive && (
                      <span className="ml-2 text-[10px] font-black uppercase tracking-widest hidden sm:block whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-500">
                        {tab.label}
                      </span>
                    )}
                  </div>

                  {isActive && (
                    <span className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${theme.color.replace('text-', 'bg-')} shadow-[0_0_10px_currentColor]`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

export default App;
