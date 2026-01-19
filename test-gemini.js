
const apiKey = "AIzaSyCnjQ0E5QjoIfaJCJX1p0l3rv4CoWnf01o";

async function listModels() {
    console.log("Listing models...");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) {
            console.error(`Status: ${res.status}`);
            console.error(`Error: ${await res.text()}`);
        } else {
            const data = await res.json();
            console.log("Available Models:");
            if (data.models) {
                data.models.forEach(m => {
                    if (m.name.includes("gemini")) console.log(`- ${m.name}`);
                });
            } else {
                console.log("No models found in response", data);
            }
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

listModels();
