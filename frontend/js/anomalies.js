const API = 'http://localhost:3000/api';
let allAnomalies = [];

async function loadAnomalies() {
    try {
        const res = await fetch(`${API}/anomalies`);
        allAnomalies = await res.json();

        const high = allAnomalies.filter(a => a.severity === 'HIGH').length;
        const medium = allAnomalies.filter(a => a.severity === 'MEDIUM').length;
        const low = allAnomalies.filter(a => a.severity === 'LOW').length;

        document.getElementById('highCount').textContent = high;
        document.getElementById('mediumCount').textContent = medium;
        document.getElementById('lowCount').textContent = low;

        renderTable(allAnomalies);
    } catch (err) {
        console.error('Error loading anomalies:', err);
    }
}

function renderTable(anomalies) {
    const tbody = document.getElementById('anomaliesTable');

    if (anomalies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No anomalies found</td></tr>';
        return;
    }

    tbody.innerHTML = anomalies.map(a => {
        const badgeClass = a.severity === 'HIGH' ? 'badge-high' :
                           a.severity === 'MEDIUM' ? 'badge-medium' : 'badge-low';
        const icon = a.severity === 'HIGH' ? '🔴' :
                     a.severity === 'MEDIUM' ? '🟡' : '🟢';

        return `
            <tr>
                <td><b>${a.name}</b></td>
                <td>${a.sector || 'Unknown'}</td>
                <td style="text-transform:capitalize;">${a.metric_type}</td>
                <td><span class="badge ${badgeClass}">${icon} ${a.severity}</span></td>
                <td style="color:#555; font-size:0.85rem;">${a.reason}</td>
            </tr>
        `;
    }).join('');
}

document.getElementById('searchInput').addEventListener('input', filterTable);
document.getElementById('severityFilter').addEventListener('change', filterTable);
document.getElementById('metricFilter').addEventListener('change', filterTable);

function filterTable() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const severity = document.getElementById('severityFilter').value;
    const metric = document.getElementById('metricFilter').value;

    const filtered = allAnomalies.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search);
        const matchesSeverity = severity === '' || a.severity === severity;
        const matchesMetric = metric === '' || a.metric_type === metric;
        return matchesSearch && matchesSeverity && matchesMetric;
    });

    renderTable(filtered);
}

loadAnomalies();