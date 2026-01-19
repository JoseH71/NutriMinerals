import { useState } from 'react';
import { Icons } from './Icons';

export const CoachView = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'coach',
            text: '¡Hola! Soy tu coach nutricional. Puedo ayudarte con consejos personalizados sobre tu alimentación. ¿En qué te puedo ayudar hoy?',
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');

    const quickQuestions = [
        '¿Cómo mejorar mi ratio Na/K?',
        '¿Qué alimentos tienen más potasio?',
        'Necesito más magnesio',
        'Opciones bajas en sodio',
    ];

    const handleSend = () => {
        if (!input.trim()) return;

        const userMessage = {
            id: Date.now(),
            sender: 'user',
            text: input,
            timestamp: new Date(),
        };

        setMessages([...messages, userMessage]);

        // Simulate AI response
        setTimeout(() => {
            const response = generateResponse(input);
            const coachMessage = {
                id: Date.now() + 1,
                sender: 'coach',
                text: response,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, coachMessage]);
        }, 1000);

        setInput('');
    };

    const generateResponse = (question) => {
        const q = question.toLowerCase();

        if (q.includes('ratio') || q.includes('na/k')) {
            return 'Para mejorar tu ratio Na/K:\n\n1. **Aumenta potasio**: plátanos, espinacas, aguacate, patatas\n2. **Reduce sodio**: evita sal añadida, procesados y embutidos\n3. **Meta óptima**: ratio <0.5 (1:2)\n\nCon un ratio equilibrado, reduces riesgo cardiovascular hasta 55%.';
        }

        if (q.includes('potasio') || q.includes('k')) {
            return '**Top alimentos en potasio** (por porción):\n\n🥔 Patata: 846mg\n🥑 Aguacate: 485mg\n🍠 Boniato: 670mg\n🍌 Plátano: 422mg\n🥬 Espinacas: 558mg\n🥦 Brócoli: 632mg\n\nMeta diaria: 3500mg';
        }

        if (q.includes('magnesio') || q.includes('mg')) {
            return '**Top alimentos en magnesio**:\n\n🌰 Pipas de calabaza: 156mg\n🥜 Nueces de brasil: 113mg\n🌰 Almendras: 76mg\n🥬 Espinacas: 79mg\n🐟 Bacalao: 51mg\n\nMeta diaria: 400mg\n\nEl magnesio ayuda con energía, sueño y salud muscular.';
        }

        if (q.includes('sodio') || q.includes('bajo')) {
            return '**Opciones bajas en sodio**:\n\n✅ Todas las frutas frescas\n✅ Verduras frescas\n✅ Frutos secos naturales (sin sal)\n✅ Pescado fresco\n✅ Huevos\n\n⚠️ **Evita**:\n❌ Embutidos\n❌ Aceitunas\n❌ Quesos curados\n❌ Salsas y procesados';
        }

        if (q.includes('proteína') || q.includes('protein')) {
            return '**Mejores fuentes de proteína**:\n\n🐟 Pescados: 25-30g por 150g\n🍗 Pollo: 31g por 150g\n🥩 Ternera: 32g por 150g\n🥚 Huevos: 6g por unidad\n🥜 Crema cacahuete: 8g por 30g\n\nMeta: 1.6-2g por kg de peso corporal.';
        }

        return 'Entiendo tu pregunta. Como coach nutricional, te recomiendo:\n\n1. Revisa tu pestaña de **Salud** para ver tu estado actual\n2. Mira tu **Historial** para identificar patrones\n3. Ajusta tu dieta según tus objetivos\n\n¿Hay algún nutriente específico que te preocupe?';
    };

    const handleQuickQuestion = (question) => {
        setInput(question);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.sender === 'user'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-card border border-theme text-primary'
                                }`}
                        >
                            {message.sender === 'coach' && (
                                <div className="flex items-center gap-2 mb-2">
                                    <Icons.Brain className="w-4 h-4 text-indigo-600" />
                                    <span className="text-xs font-bold text-indigo-600">Coach IA</span>
                                </div>
                            )}
                            <div className="whitespace-pre-line text-sm">{message.text}</div>
                            <div
                                className={`text-[10px] mt-1 ${message.sender === 'user' ? 'text-white/70' : 'text-secondary'
                                    }`}
                            >
                                {message.timestamp.toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Questions */}
            {messages.length <= 1 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-theme">
                    <div className="text-xs font-bold text-secondary mb-2">Preguntas frecuentes:</div>
                    <div className="flex flex-wrap gap-2">
                        {quickQuestions.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => handleQuickQuestion(q)}
                                className="px-3 py-2 bg-card border border-theme rounded-full text-xs font-medium text-primary hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 bg-card border-t border-theme">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escribe tu pregunta..."
                        className="flex-1 px-4 py-3 rounded-xl border border-theme bg-app text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Icons.Send />
                    </button>
                </div>
            </div>
        </div>
    );
};
