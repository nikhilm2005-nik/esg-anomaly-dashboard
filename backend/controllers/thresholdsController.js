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
        const { benchmark } = req.body;

        await db.query(
            'UPDATE sector_thresholds SET benchmark = ? WHERE id = ?',
            [benchmark, req.params.id]
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
            message: `Benchmark updated! Anomalies recalculated — ${anomaliesDetected} total anomalies detected.`
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