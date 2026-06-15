async function analyzeSymptoms() {
    const symptoms = document.getElementById("symptoms").value;
    const resultBox = document.getElementById("result");

    if (!symptoms.trim()) {
        alert("Please enter your symptoms");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ symptoms })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Something went wrong");
            return;
        }

        resultBox.classList.remove("hidden");
        resultBox.innerHTML = `
            <span class="badge ${data.risk}">${data.risk}</span>
            <h2>Suggested Doctor: ${data.doctor}</h2>
            <p><strong>Entered Symptoms:</strong> ${data.entered_symptoms}</p>
            <p><strong>Matched Symptom:</strong> ${data.matched_symptom}</p>
            <p><strong>Advice:</strong> ${data.advice}</p>
            <a class="map-link" target="_blank" href="https://www.openstreetmap.org/search?query=hospitals+near+me">
                Find nearby hospitals
            </a>
        `;
    } catch (error) {
        alert("Backend is not running. Please start Flask backend first.");
    }
}
