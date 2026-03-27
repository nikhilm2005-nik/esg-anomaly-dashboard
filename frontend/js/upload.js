const API = 'http://localhost:3000/api';

document.getElementById('csvFile').addEventListener('change', function() {
    const fileName = this.files[0]?.name;
    if (fileName) {
        document.getElementById('fileName').textContent = `Selected: ${fileName}`;
        document.getElementById('uploadBtn').style.display = 'inline-block';
    }
});

async function uploadCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a CSV file first!');
        return;
    }


    document.getElementById('progressArea').style.display = 'block';
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('resultArea').style.display = 'none';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        document.getElementById('progressArea').style.display = 'none';
        document.getElementById('resultArea').style.display = 'block';
        document.getElementById('uploadBtn').disabled = false;

        if (res.ok) {
            document.getElementById('resultArea').innerHTML = `
                <div class="result-success">
                    ✅ ${data.message}
                </div>
            `;
        } else {
            document.getElementById('resultArea').innerHTML = `
                <div class="result-error">
                    ❌ Error: ${data.error}
                </div>
            `;
        }
    } catch (err) {
        document.getElementById('progressArea').style.display = 'none';
        document.getElementById('resultArea').style.display = 'block';
        document.getElementById('resultArea').innerHTML = `
            <div class="result-error">
                ❌ Could not connect to server. Make sure backend is running!
            </div>
        `;
        document.getElementById('uploadBtn').disabled = false;
    }
}