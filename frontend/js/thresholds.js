const API = 'http://localhost:3000/api';
let allThresholds = [];
let editingId = null;

async function loadThresholds() {
    try {
        const res = await fetch(`${API}/thresholds`);
        allThresholds = await res.json();

        // Populate sector filter
        const sectors = [...new Set(allThresholds.map(t => t.sector))];
        const sectorFilter = document.getElementById('sectorFilter');
        sectors.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });

        renderTable(allThresholds);
    } catch (err) {
        console.error('Error loading thresholds:', err);
    }
}

function renderTable(thresholds) {
    const tbody = document.getElementById('thresholdsTable');

    if (thresholds.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;">
                    No thresholds found
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = thresholds.map(t => {
        const metricIcon =
            t.metric_type === 'environmental' ? '🌱' :
            t.metric_type === 'social' ? '👥' : '🏛️';

        return `
            <tr>
                <td><b>${t.sector}</b></td>
                <td>${metricIcon} ${t.metric_type}</td>
                <td>
                    <span class="badge badge-high">
                        Below ${t.poor_below}
                    </span>
                </td>
                <td>
                    <span class="badge badge-low">
                        Above ${t.good_above}
                    </span>
                </td>
                <td>
                    <span style="background:#f3e5f5; color:#7b1fa2;
                        padding:4px 10px; border-radius:20px;
                        font-size:0.8rem; font-weight:bold;">
                        Above ${t.suspicious_above}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary"
                        style="padding:5px 10px; font-size:0.8rem;"
                        onclick="openEdit(${t.id}, '${t.sector}',
                        '${t.metric_type}', ${t.poor_below},
                        ${t.good_above}, ${t.suspicious_above})">
                        ✏️ Edit
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter by sector
document.getElementById('sectorFilter').addEventListener('change', function() {
    const sector = this.value;
    const filtered = sector === ''
        ? allThresholds
        : allThresholds.filter(t => t.sector === sector);
    renderTable(filtered);
});

// Edit Modal
function openEdit(id, sector, metric, poor, good, suspicious) {
    editingId = id;
    document.getElementById('editLabel').textContent =
        `${sector} — ${metric}`;
    document.getElementById('editPoor').value = poor;
    document.getElementById('editGood').value = good;
    document.getElementById('editSuspicious').value = suspicious;
    document.getElementById('editModal').style.display = 'block';
    document.getElementById('editResult').style.display = 'none';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    editingId = null;
}

async function saveThreshold() {
    const poor_below = parseFloat(document.getElementById('editPoor').value);
    const good_above = parseFloat(document.getElementById('editGood').value);
    const suspicious_above = parseFloat(document.getElementById('editSuspicious').value);

    if (poor_below >= good_above) {
        document.getElementById('editResult').style.display = 'block';
        document.getElementById('editResult').innerHTML =
            `<div class="result-error">❌ Poor Below must be less than Good Above!</div>`;
        return;
    }

    // Show loading message
    document.getElementById('editResult').style.display = 'block';
    document.getElementById('editResult').innerHTML =
        `<div style="background:#fff8e1; padding:15px; border-radius:8px; color:#f57c00;">
            ⏳ Updating threshold and recalculating all anomalies... please wait
        </div>`;

    try {
        const res = await fetch(`${API}/thresholds/update/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ poor_below, good_above, suspicious_above })
        });

        const data = await res.json();
        const resultDiv = document.getElementById('editResult');
        resultDiv.style.display = 'block';

        if (res.ok) {
            resultDiv.innerHTML =
                `<div class="result-success">✅ ${data.message}</div>`;
            setTimeout(() => {
                closeModal();
                loadThresholds();
            }, 2000);
        } else {
            resultDiv.innerHTML =
                `<div class="result-error">❌ ${data.error}</div>`;
        }
    } catch (err) {
        console.error('Error updating threshold:', err);
    }
}

loadThresholds();