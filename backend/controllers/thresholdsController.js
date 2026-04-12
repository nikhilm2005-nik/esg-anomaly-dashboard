const db = require('../db/db');

exports.getAllThresholds = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM sector_thresholds ORDER BY sector, metric_type'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getThresholdsBySector = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM sector_thresholds WHERE sector = ?',
            [req.params.sector]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateThreshold = async (req, res) => {
    try {
        const { poor_below, good_above, suspicious_above } = req.body;

        await db.query(
            `UPDATE sector_thresholds
             SET poor_below = ?, good_above = ?, suspicious_above = ?
             WHERE id = ?`,
            [poor_below, good_above, suspicious_above, req.params.id]
        );

        // Delete all old anomalies
        await db.query('DELETE FROM anomalies');

        // Re-run detection for all companies
        const [allCompanies] = await db.query(
            `SELECT c.id, c.sector, e.environmental_score,
                    e.social_score, e.governance_score, e.year
             FROM companies c
             JOIN esg_metrics e ON c.id = e.company_id`
        );

        let anomaliesDetected = 0;
        for (const company of allCompanies) {
            anomaliesDetected += await detectAnomalies(
                company.id, company.sector, company.year,
                parseFloat(company.environmental_score),
                parseFloat(company.social_score),
                parseFloat(company.governance_score)
            );
        }

        res.json({
            message: `Threshold updated! Anomalies recalculated — ${anomaliesDetected} total anomalies detected.`
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

async function detectAnomalies(companyId, sector, year, envScore, socScore, govScore) {
    let count = 0;

    const [sectorAvg] = await db.query(
        `SELECT
            AVG(e.environmental_score) as avg_env,
            AVG(e.social_score) as avg_soc,
            AVG(e.governance_score) as avg_gov
         FROM esg_metrics e
         JOIN companies c ON e.company_id = c.id
         WHERE c.sector = ?`,
        [sector]
    );

    if (!sectorAvg[0].avg_env) return count;

    const avg = sectorAvg[0];

    const metrics = [
        { name: 'environmental', score: envScore, avg: parseFloat(avg.avg_env) },
        { name: 'social', score: socScore, avg: parseFloat(avg.avg_soc) },
        { name: 'governance', score: govScore, avg: parseFloat(avg.avg_gov) }
    ];

    for (const metric of metrics) {
        const ratio = metric.score / metric.avg;
        let severity = null;
        let reason = null;

        if (ratio > 1.6) {
            severity = 'HIGH';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is ${((ratio - 1) * 100).toFixed(0)}% above the ${sector} sector average of ${metric.avg.toFixed(1)} — suspiciously high, possible greenwashing`;
        } else if (ratio < 0.7) {
            severity = 'MEDIUM';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is ${((1 - ratio) * 100).toFixed(0)}% below the ${sector} sector average of ${metric.avg.toFixed(1)} — underperforming sector peers`;
        } else if (ratio > 1.3) {
            severity = 'LOW';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is ${((ratio - 1) * 100).toFixed(0)}% above the ${sector} sector average of ${metric.avg.toFixed(1)} — performing above sector average`;
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