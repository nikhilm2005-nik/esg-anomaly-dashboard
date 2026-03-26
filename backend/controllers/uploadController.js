const db = require('../db/db');
const fs = require('fs');
const csv = require('csv-parser');

exports.uploadCSV = async (req, res) => {
    try {
        const results = [];

        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                let inserted = 0;
                let skipped = 0;
                let anomaliesDetected = 0;

                for (const row of results) {
                    if (!row.name || !row.environment_score) continue;

                    
                    const [existing] = await db.query(
                        'SELECT id FROM companies WHERE name = ?',
                        [row.name]
                    );

                    if (existing.length > 0) {
                        skipped++;
                        continue; 
                    }

                    
                    const [company] = await db.query(
                        `INSERT INTO companies (name, sector, country) 
                         VALUES (?, ?, ?)`,
                        [
                            row.name,
                            row.industry || 'Unknown',
                            row.exchange || 'Unknown'
                        ]
                    );

                    const companyId = company.insertId;

                    
                    await db.query(
                        `INSERT INTO esg_metrics 
                         (company_id, year, environmental_score, social_score, governance_score, total_score)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            companyId,
                            row.last_processing_date || '2024',
                            parseFloat(row.environment_score) || 0,
                            parseFloat(row.social_score) || 0,
                            parseFloat(row.governance_score) || 0,
                            parseFloat(row.total_score) || 0
                        ]
                    );
                    inserted++;

                    
                    anomaliesDetected += await detectAnomalies(companyId, row);
                }

                
                fs.unlinkSync(req.file.path);

                res.json({
                    message: `✅ Import complete! ${inserted} new companies added, ${skipped} duplicates skipped, ${anomaliesDetected} anomalies detected!`
                });
            });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

async function detectAnomalies(companyId, row) {
    let count = 0;
    const envScore = parseFloat(row.environment_score) || 0;
    const socScore = parseFloat(row.social_score) || 0;
    const govScore = parseFloat(row.governance_score) || 0;
    const sector = row.industry || 'Unknown';
    const year = row.last_processing_date || '2024';

    const [industryData] = await db.query(
        `SELECT AVG(e.environmental_score) as avgEnv,
                AVG(e.social_score) as avgSoc,
                AVG(e.governance_score) as avgGov,
                STDDEV(e.environmental_score) as stdEnv,
                STDDEV(e.social_score) as stdSoc,
                STDDEV(e.governance_score) as stdGov
         FROM esg_metrics e
         JOIN companies c ON e.company_id = c.id
         WHERE c.sector = ?`,
        [sector]
    );

    const avg = industryData[0];

    const metrics = [
        { name: 'environmental', score: envScore, avg: avg.avgEnv, std: avg.stdEnv },
        { name: 'social', score: socScore, avg: avg.avgSoc, std: avg.stdSoc },
        { name: 'governance', score: govScore, avg: avg.avgGov, std: avg.stdGov },
    ];

    for (const metric of metrics) {
        if (metric.std && metric.std > 0) {
            const z = (metric.score - metric.avg) / metric.std;
            if (Math.abs(z) > 2) {
                const severity = Math.abs(z) > 3 ? 'HIGH' : 'MEDIUM';
                await db.query(
                    `INSERT INTO anomalies (company_id, year, metric_type, severity, reason)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        companyId, year, metric.name, severity,
                        `${metric.name} score of ${metric.score.toFixed(1)} is ${Math.abs(z).toFixed(2)} standard deviations from the ${sector} industry average of ${parseFloat(metric.avg).toFixed(1)}`
                    ]
                );
                count++;
            }
        }
    }
    return count;
}