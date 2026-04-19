const API = 'http://localhost:3000/api';
let allThresholds = [];
let editingId = null;

async function loadThresholds() {
    try {
        const res = await fetch(`${API}/thresholds`);
        allThresholds = await res.json();

        const sectors = [...new Set(allThresholds.map(t => t.sector))];
        const sectorFilter = document.getElementById('sectorFilter');
        sectorFilter.innerHTML = '<option value="">All Sectors</option>';
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
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No benchmarks found</td></tr>`;
        return;
    }

    tbody.innerHTML = thresholds.map(t => {
        const poor = (t.benchmark * 0.8).toFixed(1);
        const good = (t.benchmark * 1.2).toFixed(1);
        const suspicious = (t.benchmark * 1.5).toFixed(1);

        const metricIcon =
            t.metric_type === 'environmental' ? '🌱' :
            t.metric_type === 'social' ? '👥' : '🏛️';

        return `
            <tr>
                <td><b>${t.sector}</b></td>
                <td>${metricIcon} ${t.metric_type}</td>
                <td>
                    <span style="background:#e3f2fd; color:#1565c0;
                        padding:4px 12px; border-radius:20px;
                        font-weight:bold; font-size:0.9rem;">
                        ${t.benchmark}
                    </span>
                </td>
                <td><span class="badge badge-high">< ${poor}</span></td>
                <td><span class="badge badge-low">> ${good}</span></td>
                <td>
                    <span style="background:#f3e5f5; color:#7b1fa2;
                        padding:4px 10px; border-radius:20px;
                        font-size:0.8rem; font-weight:bold;">
                        > ${suspicious}
                    </span>
                </td>
                <td>
                    <button class="btn btn-primary"
                        style="padding:5px 10px; font-size:0.8rem;"
                        onclick="openEdit(${t.id}, '${t.sector}',
                        '${t.metric_type}', ${t.benchmark})">
                        ✏️ Edit
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

document.getElementById('sectorFilter').addEventListener('change', function() {
    const sector = this.value;
    const filtered = sector === ''
        ? allThresholds
        : allThresholds.filter(t => t.sector === sector);
    renderTable(filtered);
});

function openEdit(id, sector, metric, benchmark) {
    editingId = id;
    document.getElementById('editLabel').textContent = `${sector} — ${metric}`;
    document.getElementById('editBenchmark').value = benchmark;
    document.getElementById('editModal').style.display = 'block';
    document.getElementById('editResult').style.display = 'none';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    editingId = null;
}

async function saveThreshold() {
    const benchmark = parseFloat(document.getElementById('editBenchmark').value);

    if (!benchmark || benchmark <= 0 || benchmark > 100) {
        document.getElementById('editResult').style.display = 'block';
        document.getElementById('editResult').innerHTML =
            `<div class="result-error">❌ Please enter a valid value between 0 and 100!</div>`;
        return;
    }

    document.getElementById('editResult').style.display = 'block';
    document.getElementById('editResult').innerHTML =
        `<div style="background:#fff8e1; padding:12px; border-radius:8px; color:#f57c00;">
            ⏳ Updating benchmark and recalculating all anomalies... please wait
        </div>`;

    try {
        const res = await fetch(`${API}/thresholds/update/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ benchmark })
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('editResult').innerHTML =
                `<div class="result-success">✅ ${data.message}</div>`;
            setTimeout(() => {
                closeModal();
                loadThresholds();
            }, 2000);
        } else {
            document.getElementById('editResult').innerHTML =
                `<div class="result-error">❌ ${data.error}</div>`;
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

loadThresholds();