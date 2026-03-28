const API = 'http://localhost:3000/api';

async function loadDashboard() {
    try {
        const res = await fetch(`${API}/dashboard/stats`);
        const data = await res.json();

        document.getElementById('totalCompanies').textContent = data.totalCompanies;
        document.getElementById('totalAnomalies').textContent = data.totalAnomalies;
        document.getElementById('avgScore').textContent = data.avgScore || '0';
        document.getElementById('highRisk').textContent = data.highRisk;

        const tbody = document.getElementById('topFlaggedTable');
        if (data.topFlagged.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2">No data yet — upload a CSV to get started</td></tr>';
        } else {
            tbody.innerHTML = data.topFlagged.map(c => `
                <tr>
                    <td>${c.name}</td>
                    <td><span class="badge badge-high">${c.anomaly_count} anomalies</span></td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

loadDashboard();