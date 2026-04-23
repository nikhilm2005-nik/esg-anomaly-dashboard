const API = 'http://localhost:3000/api';
let allCompanies = [];
let editingId = null;

async function loadCompanies() {
    try {
        const res = await fetch(`${API}/companies`);
        allCompanies = await res.json();

        // Populate sector filter
        const sectors = [...new Set(allCompanies.map(c => c.sector).filter(Boolean))];
        const sectorFilter = document.getElementById('sectorFilter');
        sectorFilter.innerHTML = '<option value="">All Sectors</option>';
        sectors.sort().forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });

        renderTable(allCompanies);
    } catch (err) {
        console.error('Error loading companies:', err);
        document.getElementById('companiesTable').innerHTML =
            `<tr><td colspan="7" style="text-align:center; color:var(--accent-red); padding:32px;">
                ❌ Could not connect to server. Make sure backend is running!
            </td></tr>`;
    }
}

function renderTable(companies) {
    const tbody = document.getElementById('companiesTable');

    if (companies.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted);">
                No companies found
            </td></tr>`;
        return;
    }

    tbody.innerHTML = companies.map(c => {
        const score = c.avg_score ? parseFloat(c.avg_score).toFixed(1) : 'N/A';
        const anomalyCount = c.anomaly_count || 0;
        const status = anomalyCount > 0
            ? `<span class="badge badge-flagged">🚨 Flagged</span>`
            : `<span class="badge badge-normal">✅ Normal</span>`;

        return `
            <tr>
                <td><span style="font-weight:600;">${c.name}</span></td>
                <td style="color:var(--text-secondary);">${c.sector || '—'}</td>
                <td style="color:var(--text-secondary);">${c.country || '—'}</td>
                <td><span style="font-weight:600; color:var(--accent-cyan);">${score}</span></td>
                <td>${anomalyCount > 0
                    ? `<span style="color:var(--accent-orange); font-weight:600;">${anomalyCount}</span>`
                    : `<span style="color:var(--text-muted);">0</span>`}
                </td>
                <td>${status}</td>
                <td>
                    <button class="action-btn action-btn-edit" onclick="openEdit(${c.id})">
                        ✏️ Edit
                    </button>
                    <button class="action-btn action-btn-delete" onclick="deleteCompany(${c.id}, '${c.name.replace(/'/g, "\\'")}')">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Search and Filter
document.getElementById('searchInput').addEventListener('input', filterTable);
document.getElementById('sectorFilter').addEventListener('change', filterTable);
document.getElementById('statusFilter').addEventListener('change', filterTable);

function filterTable() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const sector = document.getElementById('sectorFilter').value;
    const status = document.getElementById('statusFilter').value;

    const filtered = allCompanies.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search);
        const matchesSector = sector === '' || c.sector === sector;
        const matchesStatus = status === '' ||
            (status === 'flagged' && c.anomaly_count > 0) ||
            (status === 'normal' && c.anomaly_count === 0);
        return matchesSearch && matchesSector && matchesStatus;
    });

    renderTable(filtered);
}

// ---- EDIT ----
async function openEdit(id) {
    editingId = id;
    const company = allCompanies.find(c => c.id === id);
    const res = await fetch(`${API}/esg/${id}`);
    const metrics = await res.json();
    const m = metrics[0] || {};

    document.getElementById('editName').value = company.name || '';
    document.getElementById('editSector').value = company.sector || '';
    document.getElementById('editCountry').value = company.country || '';
    document.getElementById('editYear').value = m.year || '2024';
    document.getElementById('editEnv').value = m.environmental_score || '';
    document.getElementById('editSoc').value = m.social_score || '';
    document.getElementById('editGov').value = m.governance_score || '';
    document.getElementById('editTotal').value = m.total_score || '';

    document.getElementById('editModal').style.display = 'block';
    document.getElementById('editResult').style.display = 'none';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    editingId = null;
}

async function saveEdit() {
    const body = {
        name: document.getElementById('editName').value,
        sector: document.getElementById('editSector').value,
        country: document.getElementById('editCountry').value,
        year: document.getElementById('editYear').value,
        environmental_score: parseFloat(document.getElementById('editEnv').value),
        social_score: parseFloat(document.getElementById('editSoc').value),
        governance_score: parseFloat(document.getElementById('editGov').value),
        total_score: parseFloat(document.getElementById('editTotal').value),
    };

    try {
        const res = await fetch(`${API}/companies/update/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        const resultDiv = document.getElementById('editResult');
        resultDiv.style.display = 'block';

        if (res.ok) {
            resultDiv.innerHTML = `<div class="result-success">✅ ${data.message}</div>`;
            setTimeout(() => { closeModal(); loadCompanies(); }, 1500);
        } else {
            resultDiv.innerHTML = `<div class="result-error">❌ ${data.error}</div>`;
        }
    } catch (err) {
        console.error('Error updating:', err);
    }
}

// ---- DELETE ----
async function deleteCompany(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?\nThis will also delete all its ESG metrics and anomalies.`)) return;

    try {
        const res = await fetch(`${API}/companies/delete/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            alert(`✅ ${data.message}`);
            loadCompanies();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (err) {
        console.error('Error deleting:', err);
    }
}

loadCompanies();