const API = 'http://localhost:3000/api';

async function addCompany() {
    const name = document.getElementById('name').value.trim();
    const sector = document.getElementById('sector').value.trim();
    const country = document.getElementById('country').value.trim();
    const year = document.getElementById('year').value.trim();
    const envScore = document.getElementById('envScore').value;
    const socScore = document.getElementById('socScore').value;
    const govScore = document.getElementById('govScore').value;
    const totalScore = document.getElementById('totalScore').value;

    // Validation
    if (!name || !sector || !year || !envScore || !socScore || !govScore || !totalScore) {
        showResult('error', '❌ Please fill in all required fields!');
        return;
    }

    try {
        const res = await fetch(`${API}/companies/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name, sector, country, year,
                environmental_score: parseFloat(envScore),
                social_score: parseFloat(socScore),
                governance_score: parseFloat(govScore),
                total_score: parseFloat(totalScore)
            })
        });

        const data = await res.json();

        if (res.ok) {
            showResult('success', `✅ ${data.message}`);
            clearForm();
            loadRecentCompanies();
        } else {
            showResult('error', `❌ ${data.error}`);
        }
    } catch (err) {
        showResult('error', '❌ Could not connect to server. Make sure backend is running!');
    }
}

function showResult(type, message) {
    const resultArea = document.getElementById('resultArea');
    resultArea.style.display = 'block';
    resultArea.innerHTML = `<div class="result-${type === 'success' ? 'success' : 'error'}">${message}</div>`;
}

function clearForm() {
    ['name', 'sector', 'country', 'year',
     'envScore', 'socScore', 'govScore', 'totalScore']
    .forEach(id => document.getElementById(id).value = '');
}

async function loadRecentCompanies() {
    try {
        const res = await fetch(`${API}/companies/recent`);
        const companies = await res.json();
        const tbody = document.getElementById('recentTable');

        if (companies.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="4" style="text-align:center;
                    color:var(--text-muted); padding:32px;">
                    No manually added companies yet
                </td></tr>`;
            return;
        }

        tbody.innerHTML = companies.map(c => `
            <tr>
                <td><span style="font-weight:600;">${c.name}</span></td>
                <td style="color:var(--text-secondary);">${c.sector || '—'}</td>
                <td><span style="color:var(--accent-cyan); font-weight:600;">
                    ${c.total_score ? parseFloat(c.total_score).toFixed(1) : 'N/A'}
                </span></td>
                <td>${c.anomaly_count > 0
                    ? `<span class="badge badge-flagged">🚨 ${c.anomaly_count}</span>`
                    : `<span class="badge badge-normal">✅ 0</span>`}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error loading recent companies:', err);
    }
}

loadRecentCompanies();