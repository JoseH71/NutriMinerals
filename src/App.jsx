import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, query as firestoreQuery, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { Icons } from './components/Icons';
import { searchLocalDB } from './utils/foodDatabase';
import { HEALTH_THRESHOLDS } from './utils/healthThresholds';
import { getTimeBlock } from './utils/helpers';
import { firebaseConfig, APP_ID, SHARED_USER_ID, GEMINI_API_KEY } from './config/firebase';

// Shared Components
import EntryView from './components/Entry/EntryView';
import DiaryView from './components/Diary/DiaryView';
import SaludView from './components/Common/SaludView';
import HistoryView from './components/History/HistoryView';
import CoachHub from './components/Coach/CoachHub';
import MyFoodsView from './components/Common/MyFoodsView';
import SafeView from './components/Common/SafeView';

import './App.css';

// Initialize Firebase
let db = null;
let auth = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.error('Firebase init error:', e);
}

function App() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [myFoods, setMyFoods] = useState([]);
  const [dinnerFeedback, setDinnerFeedback] = useState([]);
  const [manualDayType, setManualDayType] = useState(null);
  const [activeTab, setActiveTab] = useState('entrada');
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
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

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

      return () => { unsubLogs(); unsubFoods(); unsubFeedback(); unsubSettings(); };
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
  const addLog = async (food) => {
    if (!db) return;
    const uid = SHARED_USER_ID;
    const id = Date.now().toString();
    const log = {
      ...food,
      id,
      dateStr: new Date(entryDate).toLocaleDateString(), // Legacy format
      dateISO: entryDate,
      timeBlock: getTimeBlock(), // Uses current time for block, but correct date
      timestamp: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${uid}/food_logs`, id), log);
      setQuery('');
      setSearchResults([]);
      // Stay on entry tab to allow adding more items easily
    } catch (e) {
      console.error('Add log error:', e);
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

  // Search foods
  // Search foods (Text or Image) with improved reliability
  const searchFoods = async (q, imageFile = null) => {
    setLoading(true);
    setSearchResults([]); // Clear previous results
    setFirebaseError(null); // Clear previous errors

    // 1. Text Search Logic with Complexity Check (Legacy behavior)
    if (!imageFile) {
      if (!q.trim()) { setLoading(false); return; }

      // Fix: "arroz al horno" (3 words) needs to be complex. 
      // Added 'al', 'del', 'para' and lowered word count threshold to > 2
      const isComplex = q.split(' ').length > 2 || / y | con | e | \+ |,| al | del | para /i.test(q);

      if (!isComplex) {
        // Simple query: check local DB first
        const localResult = searchLocalDB(q);
        if (localResult) {
          setSearchResults([localResult]);
          setLoading(false);
          return;
        }
        // Check MyFoods
        const myMatch = myFoods.find(f => f.name?.toLowerCase().includes(q.toLowerCase()));
        if (myMatch) {
          setSearchResults([{ ...myMatch, confidence: 'alta (mis alimentos)' }]);
          setLoading(false);
          return;
        }
      } else {
        console.log("🧠 Frase compleja detectada, saltando base local para usar IA...");
      }
    }

    // 2. AI Search (Gemini) with automatic retries
    const performSearch = async (attempt = 1, maxAttempts = 3) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
        const jsonSchema = `{"name":"nombre del alimento en español","portion":"cantidad estimada (ej: 150g, 1 unidad)","calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"na":N,"k":N,"ca":N,"mg":N,"confidence":"alta"|"media"|"baja"}`;

        let requestBody;
        let model = 'gemini-2.0-flash'; // Default for text

        if (imageFile) {
          // --- IMAGE SEARCH ---
          model = 'gemini-2.5-flash-image';

          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          await new Promise(resolve => reader.onload = resolve);
          const base64Data = reader.result.split(',')[1];

          const prompt = `Eres un nutricionista clínico experto. Analiza esta imagen de comida.
          REGLAS ESTRICTAS:
          1. Identifica el plato y estima raciones realistas
          2. Usa valores MEDIOS de bases de datos oficiales (USDA, BEDCA)
          3. NO inventes minerales. Si duda, pon 0
          4. Responde SOLO JSON con este esquema: ${jsonSchema}`;

          requestBody = {
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: imageFile.type, data: base64Data } }
              ]
            }]
          };
        } else {
          // --- TEXT SEARCH ---
          model = 'gemini-2.0-flash';
          const prompt = `Eres un nutricionista clínico experto.
          Analiza: "${q}"
          
          REGLAS ESTRICTAS:
          1. Usa valores MEDIOS de bases de datos oficiales (USDA, BEDCA, EFSA)
          2. NO inventes minerales. Si no estás seguro, devuelve 0
          3. Asume ración estándar realista (fruta ~150g, carne ~150g, yogur ~125g)
          4. Valores SIN sal añadida salvo que se indique "con sal" o "restaurante"
          5. Sé conservador. Mejor subestimar que inventar
          6. Responde SOLO en español
          
          Devuelve SOLO este JSON (sin explicaciones):
          ${jsonSchema}`;

          requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              topK: 20,
              topP: 0.8,
              maxOutputTokens: 512
            }
          };
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
          const msg = err.error?.message || `API Error ${res.status}`;

          // Retry on server errors (5xx) or rate limits (429)
          if ((res.status >= 500 || res.status === 429) && attempt < maxAttempts) {
            const delay = res.status === 429 ? 3000 * attempt : 1500 * attempt;
            console.warn(`Error ${res.status} on ${model}, retrying in ${delay}ms (${attempt}/${maxAttempts})...`);
            await new Promise(r => setTimeout(r, delay));
            return performSearch(attempt + 1, maxAttempts);
          }

          throw new Error(msg);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!text) {
          throw new Error('Respuesta vacía de la IA');
        }

        // Improved JSON extraction with multiple strategies
        let parsedFood = null;

        // Strategy 1: Direct JSON parse (if response is pure JSON)
        try {
          parsedFood = JSON.parse(text);
        } catch {
          // Strategy 2: Extract JSON from markdown code blocks
          const cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          try {
            parsedFood = JSON.parse(cleanText);
          } catch {
            // Strategy 3: Find JSON object in text
            const jsonMatch = text.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              try {
                parsedFood = JSON.parse(jsonMatch[0]);
              } catch {
                // Strategy 4: More aggressive cleanup
                const aggressive = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
                parsedFood = JSON.parse(aggressive);
              }
            }
          }
        }

        if (!parsedFood || !parsedFood.name) {
          // Retry if JSON parsing failed
          if (attempt < maxAttempts) {
            console.warn(`Invalid JSON on attempt ${attempt}, retrying...`);
            await new Promise(r => setTimeout(r, 1000));
            return performSearch(attempt + 1, maxAttempts);
          }
          throw new Error('No se pudo extraer información válida');
        }

        const p = (v) => Math.max(0, Number(v) || 0);

        const finalFood = {
          name: parsedFood.name || 'Alimento desconocido',
          portion: parsedFood.portion || '100g',
          calories: p(parsedFood.calories),
          protein: p(parsedFood.protein),
          carbs: p(parsedFood.carbs),
          fat: p(parsedFood.fat),
          fiber: p(parsedFood.fiber),
          na: p(parsedFood.na),
          k: p(parsedFood.k),
          ca: p(parsedFood.ca),
          mg: p(parsedFood.mg),
          confidence: parsedFood.confidence || (imageFile ? 'media' : 'estimado'),
          dataSource: 'gemini'
        };

        setSearchResults([finalFood]);
        setFirebaseError(null); // Clear any previous errors on success

      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`Search error (attempt ${attempt}/${maxAttempts}):`, e);

        // Retry on network errors or parsing failures
        if (attempt < maxAttempts && (
          e.name === 'AbortError' ||
          e.message.includes('Failed to fetch') ||
          e.message.includes('NetworkError') ||
          e.message.includes('extraer información')
        )) {
          console.warn(`Retrying due to ${e.message}...`);
          await new Promise(r => setTimeout(r, 2000 * attempt));
          return performSearch(attempt + 1, maxAttempts);
        }

        // Final error handling
        if (e.name === 'AbortError') {
          setFirebaseError("Búsqueda cancelada por timeout. Intenta de nuevo.");
        } else if (e.message.includes('429') || e.message.includes('quota')) {
          setFirebaseError("Servidor saturado. Espera unos segundos.");
        } else if (e.message.includes('404') || e.message.includes('not found')) {
          setFirebaseError("Modelo IA no disponible.");
        } else {
          setFirebaseError(`Error: ${e.message}`);
        }

        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    // Execute the search
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
    a.download = `nutriminerals-backup-${todayISO}.json`;
    a.click();
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
    { id: 'mis_alimentos', label: 'Catálogo', icon: Icons.Wheat }, // Moved here and renamed
    { id: 'diario', label: 'Diario', icon: Icons.Book },
    { id: 'salud', label: 'Salud', icon: Icons.Activity },
    { id: 'historial', label: 'Historial', icon: Icons.History },
    { id: 'coach', label: 'Entrenador', icon: Icons.Bike }, // Renamed
  ];

  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const renderView = () => {
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
          />
        </SafeView>;
      case 'diario':
        return <SafeView><DiaryView
          logs={logs} onDelete={deleteLog} thresholds={HEALTH_THRESHOLDS} tssToday={0}
          onSaveFood={saveToMyFoods} myFoods={myFoods} manualDayType={manualDayType} onSaveManualDayType={saveManualDayType} /></SafeView>;
      case 'salud':
        return <SafeView><SaludView allLogs={logs} dayLogs={todayLogs} tssToday={0} dinnerFeedback={dinnerFeedback} onSaveFeedback={saveDinnerFeedback} manualDayType={manualDayType} onSaveManualDayType={saveManualDayType} /></SafeView>;
      case 'mis_alimentos':
        return <SafeView><MyFoodsView
          myFoods={myFoods} onSave={saveToMyFoods} onDelete={deleteMyFood}
          onAddToLog={(f) => addLog(f)} /></SafeView>;
      case 'historial':
        return <SafeView><HistoryView
          logs={logs} onExport={exportData} onImport={importData}
          user={user} onSaveFood={saveToMyFoods} myFoods={myFoods} /></SafeView>;
      case 'coach':
        return <SafeView><CoachHub logs={logs} useFirebase={!!db} dbRef={dbRef} appId={APP_ID} /></SafeView>;
      default:
        return <SafeView><EntryView today={todayLogs} loading={loading} query={query} setQuery={setQuery} searchFoods={searchFoods} searchResults={searchResults} addLog={addLog} deleteLog={deleteLog} firebaseError={firebaseError} myFoods={myFoods} allLogs={logs} /></SafeView>;
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
        <p className="text-secondary text-xs font-bold uppercase tracking-widest mt-2 opacity-50">Nutriminerals Pro v2.0</p>
      </div>
    );
  }

  return (
    <div className="bg-app min-h-[101vh]">
      <header className="fixed top-0 inset-x-0 bg-gradient-to-r from-indigo-700 to-indigo-600 text-white px-5 py-4 flex items-center justify-between pt-safe shadow-lg z-50 h-16">
        <h1 className="text-xl font-black tracking-tighter uppercase italic flex items-center gap-2">
          <span className="bg-white text-indigo-700 px-1.5 rounded-lg not-italic">N</span>
          Nutriminerals
          <span className="text-[8px] opacity-50 ml-2 font-mono bg-indigo-800/50 px-1 py-0.5 rounded">v2.1</span>
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

      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-theme pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50">
        <div className="flex justify-around items-center h-16 max-w-xl mx-auto px-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative active:scale-95 ${isActive ? 'text-indigo-600' : 'text-secondary hover:text-primary'}`}
              >
                {isActive && <span className="absolute -top-0.5 w-8 h-1 bg-indigo-600 rounded-full"></span>}
                <Icon size={isActive ? 24 : 20} className={isActive ? 'mb-0.5' : ''} />
                <span className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isActive ? 'opacity-100' : 'opacity-40'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div >
  );
}

export default App;
