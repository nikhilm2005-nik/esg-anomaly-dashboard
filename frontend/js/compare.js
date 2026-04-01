const API = 'http://localhost:3000/api';
let radarChart = null;

async function loadCompanies() {
    try {
        const res = await fetch(`${API}/companies`);
        const companies = await res.json();

        const select1 = document.getElementById('company1');
        const select2 = document.getElementById('company2');

        companies.forEach(c => {
            const opt1 = new Option(c.name, c.id);
            const opt2 = new Option(c.name, c.id);
            select1.appendChild(opt1);
            select2.appendChild(opt2);
        });
    } catch (err) {
        console.error('Error loading companies:', err);
    }
}

async function compareCompanies() {
    const id1 = document.getElementById('company1').value;
    const id2 = document.getElementById('company2').value;

    if (!id1 || !id2) {
        alert('Please select both companies!');
        return;
    }

    if (id1 === id2) {
        alert('Please select two different companies!');
        return;
    }

    try {
        const res = await fetch(`${API}/esg/compare/${id1}/${id2}`);
        const data = await res.json();

        const c1 = data.company1[0];
        const c2 = data.company2[0];

        if (!c1 || !c2) {
            alert('No ESG data found for one or both companies!');
            return;
        }

        document.getElementById('resultsArea').style.display = 'block';

        // Update company names
        document.getElementById('company1Name').textContent = c1.name;
        document.getElementById('company2Name').textContent = c2.name;

        // Render score tables
        renderScoreTable('company1Table', c1);
        renderScoreTable('company2Table', c2);

        // Render radar chart
        renderRadarChart(c1, c2);

    } catch (err) {
        console.error('Error comparing companies:', err);
    }
}

function renderScoreTable(tableId, company) {
    const tbody = document.getElementById(tableId);
    const metrics = [
        { label: '🌱 Environmental', value: company.environmental_score },
        { label: '👥 Social', value: company.social_score },
        { label: '🏛️ Governance', value: company.governance_score },
        { label: '📊 Total', value: company.total_score },
    ];

    tbody.innerHTML = metrics.map(m => `
        <tr>
            <td>${m.label}</td>
            <td><b>${m.value ? parseFloat(m.value).toFixed(1) : 'N/A'}</b></td>
        </tr>
    `).join('');
}

function renderRadarChart(c1, c2) {
    if (radarChart) radarChart.destroy();

    const ctx = document.getElementById('radarChart').getContext('2d');
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Environmental', 'Social', 'Governance', 'Total'],
            datasets: [
                {
                    label: c1.name,
                    data: [
                        c1.environmental_score,
                        c1.social_score,
                        c1.governance_score,
                        c1.total_score
                    ],
                    backgroundColor: 'rgba(78, 204, 163, 0.2)',
                    borderColor: '#4ecca3',
                    pointBackgroundColor: '#4ecca3',
                },
                {
                    label: c2.name,
                    data: [
                        c2.environmental_score,
                        c2.social_score,
                        c2.governance_score,
                        c2.total_score
                    ],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: '#ff6384',
                    pointBackgroundColor: '#ff6384',
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

loadCompanies();