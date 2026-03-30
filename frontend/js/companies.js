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
        sectors.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            sectorFilter.appendChild(option);
        });

        renderTable(allCompanies);
    } catch (err) {
        console.error('Error loading companies:', err);
    }
}

function renderTable(companies) {
    const tbody = document.getElementById('companiesTable');

    if (companies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No companies found</td></tr>';
        return;
    }

    tbody.innerHTML = companies.map(c => {
        const score = c.avg_score ? parseFloat(c.avg_score).toFixed(1) : 'N/A';
        const anomalyCount = c.anomaly_count || 0;
        const status = anomalyCount > 0
            ? `<span class="badge badge-high">🚨 Flagged</span>`
            : `<span class="badge badge-low">✅ Normal</span>`;

        return `
            <tr>
                <td><b>${c.name}</b></td>
                <td>${c.sector || 'Unknown'}</td>
                <td>${c.country || 'Unknown'}</td>
                <td>${score}</td>
                <td>${anomalyCount}</td>
                <td>${status}</td>
                <td>
                    <button class="btn btn-primary" 
                        style="padding:5px 10px; font-size:0.8rem; margin-right:5px;"
                        onclick="openEdit(${c.id})">✏️ Edit</button>
                    <button class="btn" 
                        style="padding:5px 10px; font-size:0.8rem; background:#ffebee; color:#d32f2f;"
                        onclick="deleteCompany(${c.id}, '${c.name}')">🗑️ Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Search and Filter
document.getElementById('searchInput').addEventListener('input', filterTable);
document.getElementById('sectorFilter').addEventListener('change', filterTable);

function filterTable() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const sector = document.getElementById('sectorFilter').value;

    const filtered = allCompanies.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search);
        const matchesSector = sector === '' || c.sector === sector;
        return matchesSearch && matchesSector;
    });

    renderTable(filtered);
}


async function openEdit(id) {
    editingId = id;

    // Get company data
    const company = allCompanies.find(c => c.id === id);

    // Get ESG metrics
    const res = await fetch(`${API}/esg/${id}`);
    const metrics = await res.json();
    const m = metrics[0] || {};

    // Fill form
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
            setTimeout(() => {
                closeModal();
                loadCompanies();
            }, 1500);
        } else {
            resultDiv.innerHTML = `<div class="result-error">❌ ${data.error}</div>`;
        }
    } catch (err) {
        console.error('Error updating company:', err);
    }
}

async function deleteCompany(id, name) {
    const confirm = window.confirm(`Are you sure you want to delete "${name}"?\nThis will also delete all its ESG metrics and anomalies.`);
    if (!confirm) return;

    try {
        const res = await fetch(`${API}/companies/delete/${id}`, {
            method: 'DELETE'
        });

        const data = await res.json();

        if (res.ok) {
            alert(`✅ ${data.message}`);
            loadCompanies();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (err) {
        console.error('Error deleting company:', err);
    }
}

loadCompanies();