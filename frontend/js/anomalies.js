const API = 'http://localhost:3000/api';
let allAnomalies = [];

async function loadAnomalies() {
    try {
        const res = await fetch(`${API}/anomalies`);
        allAnomalies = await res.json();

        // Count by category
        const suspicious = allAnomalies.filter(a => a.severity === 'SUSPICIOUS').length;
        const poor = allAnomalies.filter(a => a.severity === 'POOR').length;
        const good = allAnomalies.filter(a => a.severity === 'GOOD').length;

        document.getElementById('highCount').textContent = suspicious;
        document.getElementById('mediumCount').textContent = poor;
        document.getElementById('lowCount').textContent = good;

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
        let badgeClass, icon;

        if (a.severity === 'SUSPICIOUS') {
            badgeClass = 'badge-high';
            icon = '⚠️';
        } else if (a.severity === 'POOR') {
            badgeClass = 'badge-medium';
            icon = '🔴';
        } else if (a.severity === 'GOOD') {
            badgeClass = 'badge-low';
            icon = '🟢';
        } else {
            badgeClass = 'badge-low';
            icon = '🟡';
        }

        return `
            <tr>
                <td><b>${a.name}</b></td>
                <td>${a.sector || 'Unknown'}</td>
                <td style="text-transform:capitalize;">${a.metric_type}</td>
                <td>
                    <span class="badge ${badgeClass}">
                        ${icon} ${a.severity}
                    </span>
                </td>
                <td style="color:#555; font-size:0.85rem;">${a.reason}</td>
            </tr>
        `;
    }).join('');
}

// Filters
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