
const apiKey = "AIzaSyDQAP82KX5kqtk_MdVIjkxuuqJqL8Mn8Js";

async function testTextSearch(query) {
    console.log(`Testing Text Search: "${query}"...`);

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

    const prompt = `Calcula nutrición para: "${query}"
          Si hay varios platos, desglósalos. Responde SOLO JSON con esquema: ${jsonSchema}`;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            response_mime_type: "application/json"
        }
    };

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error(`FAILED: ${res.status}`);
            console.error(await res.text());
        } else {
            const data = await res.json();
            console.log("SUCCESS! Full JSON Response:");
            console.log(JSON.stringify(data, null, 2)); // Log full structure
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log("\nExtracted Text:");
            console.log(text);
        }
    } catch (e) {
        console.error("EXCEPTION:", e);
    }
}

testTextSearch("merluza con patatas y pimiento");
