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

                let maxScore = 0;
                for (const row of results) {
                    const total = parseFloat(row.total_score) || 0;
                    if (total > maxScore) maxScore = total;
                }

                let inserted = 0;
                let skipped = 0;

                // First insert ALL companies
                for (const row of results) {
                    if (!row.name || !row.environment_score) continue;

                    const [existing] = await db.query(
                        'SELECT id FROM companies WHERE name = ?', [row.name]
                    );

                    if (existing.length > 0) { skipped++; continue; }

                    const envScore = maxScore > 0 ? ((parseFloat(row.environment_score) || 0) / maxScore) * 100 : 0;
                    const socScore = maxScore > 0 ? ((parseFloat(row.social_score) || 0) / maxScore) * 100 : 0;
                    const govScore = maxScore > 0 ? ((parseFloat(row.governance_score) || 0) / maxScore) * 100 : 0;
                    const totalScore = maxScore > 0 ? ((parseFloat(row.total_score) || 0) / maxScore) * 100 : 0;

                    const [company] = await db.query(
                        'INSERT INTO companies (name, sector, country) VALUES (?, ?, ?)',
                        [row.name, row.industry || 'Unknown', row.exchange || 'Unknown']
                    );

                    await db.query(
                        `INSERT INTO esg_metrics (company_id, year, environmental_score, social_score, governance_score, total_score) VALUES (?, ?, ?, ?, ?, ?)`,
                        [company.insertId, row.last_processing_date || '2024', envScore.toFixed(2), socScore.toFixed(2), govScore.toFixed(2), totalScore.toFixed(2)]
                    );

                    inserted++;
                }

                // Then run anomaly detection AFTER all inserted
                let anomaliesDetected = 0;
                const [allCompanies] = await db.query(
                    `SELECT c.id, c.sector, e.environmental_score,
                            e.social_score, e.governance_score, e.year
                     FROM companies c
                     JOIN esg_metrics e ON c.id = e.company_id`
                );

                for (const company of allCompanies) {
                    anomaliesDetected += await detectAnomalies(
                        company.id, company.sector, company.year,
                        parseFloat(company.environmental_score),
                        parseFloat(company.social_score),
                        parseFloat(company.governance_score)
                    );
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

async function detectAnomalies(companyId, sector, year, envScore, socScore, govScore) {
    let count = 0;

    const [thresholds] = await db.query(
        'SELECT * FROM sector_thresholds WHERE sector = ?',
        [sector]
    );

    const getBenchmark = (metricType) => {
        const t = thresholds.find(t => t.metric_type === metricType);
        return t ? t.benchmark : 40;
    };

    const metrics = [
        { name: 'environmental', score: envScore },
        { name: 'social', score: socScore },
        { name: 'governance', score: govScore }
    ];

    for (const metric of metrics) {
        const benchmark = getBenchmark(metric.name);
        const deviation = ((metric.score - benchmark) / benchmark) * 100;

        let severity = null;
        let reason = null;

        if (deviation >= 50) {
            severity = 'SUSPICIOUS';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is ${deviation.toFixed(1)}% above the ${sector} sector benchmark of ${benchmark} — suspiciously high, possible greenwashing`;
        } else if (deviation >= 20) {
            severity = 'GOOD';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is ${deviation.toFixed(1)}% above the ${sector} sector benchmark of ${benchmark} — performing above market standard`;
        } else if (deviation <= -50) {
            severity = 'POOR';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is ${Math.abs(deviation).toFixed(1)}% below the ${sector} sector benchmark of ${benchmark} — critically underperforming`;
        } else if (deviation <= -20) {
            severity = 'POOR';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is ${Math.abs(deviation).toFixed(1)}% below the ${sector} sector benchmark of ${benchmark} — underperforming market standard`;
        }

        if (severity) {
            await db.query(
                `INSERT INTO anomalies (company_id, year, metric_type, severity, reason) VALUES (?, ?, ?, ?, ?)`,
                [companyId, year, metric.name, severity, reason]
            );
            count++;
        }
    }
    return count;
}