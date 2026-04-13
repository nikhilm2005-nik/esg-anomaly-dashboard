const db = require('../db/db');

exports.getAllCompanies = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*,
            ROUND(AVG(e.total_score), 1) as avg_score,
            ROUND(AVG(e.environmental_score), 1) as avg_env,
            ROUND(AVG(e.social_score), 1) as avg_soc,
            ROUND(AVG(e.governance_score), 1) as avg_gov,
            COUNT(a.id) as anomaly_count
            FROM companies c
            LEFT JOIN esg_metrics e ON c.id = e.company_id
            LEFT JOIN anomalies a ON c.id = a.company_id
            GROUP BY c.id
            ORDER BY anomaly_count DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getCompanyById = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM companies WHERE id = ?',
            [req.params.id]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getRecentCompanies = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, e.environmental_score, e.social_score,
                   e.governance_score, e.total_score,
                   COUNT(a.id) as anomaly_count
            FROM companies c
            LEFT JOIN esg_metrics e ON c.id = e.company_id
            LEFT JOIN anomalies a ON c.id = a.company_id
            WHERE c.id > (SELECT MAX(id) - 10 FROM companies)
            GROUP BY c.id
            ORDER BY c.id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.addCompany = async (req, res) => {
    try {
        const { name, sector, country, year,
                environmental_score, social_score,
                governance_score, total_score } = req.body;

        const [existing] = await db.query(
            'SELECT id FROM companies WHERE name = ?', [name]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Company already exists!' });
        }

        const [company] = await db.query(
            'INSERT INTO companies (name, sector, country) VALUES (?, ?, ?)',
            [name, sector, country || 'Unknown']
        );

        const companyId = company.insertId;

        await db.query(
            `INSERT INTO esg_metrics 
             (company_id, year, environmental_score, social_score, governance_score, total_score)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [companyId, year, environmental_score, social_score, governance_score, total_score]
        );

        const anomalies = await detectAnomalies(
            companyId, sector, year,
            environmental_score, social_score, governance_score
        );

        res.json({
            message: `Company "${name}" added successfully! ${anomalies} anomalies detected.`
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateCompany = async (req, res) => {
    try {
        const { name, sector, country,
                environmental_score, social_score,
                governance_score, total_score, year } = req.body;

        await db.query(
            `UPDATE companies SET name = ?, sector = ?, country = ? WHERE id = ?`,
            [name, sector, country, req.params.id]
        );

        await db.query(
            `UPDATE esg_metrics 
             SET environmental_score = ?, social_score = ?, 
                 governance_score = ?, total_score = ?, year = ?
             WHERE company_id = ?`,
            [environmental_score, social_score, governance_score,
             total_score, year, req.params.id]
        );

        await db.query(
            'DELETE FROM anomalies WHERE company_id = ?',
            [req.params.id]
        );

        const anomalies = await detectAnomalies(
            req.params.id, sector, year,
            environmental_score, social_score, governance_score
        );

        res.json({
            message: `Company updated successfully! ${anomalies} anomalies detected.`
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteCompany = async (req, res) => {
    try {
        const id = req.params.id;

        await db.query('DELETE FROM anomalies WHERE company_id = ?', [id]);
        await db.query('DELETE FROM esg_metrics WHERE company_id = ?', [id]);
        await db.query('DELETE FROM companies WHERE id = ?', [id]);

        res.json({ message: 'Company deleted successfully!' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

async function detectAnomalies(companyId, sector, year, envScore, socScore, govScore) {
    let count = 0;

    // Get all scores in same sector for percentile calculation
    const [sectorData] = await db.query(
        `SELECT e.environmental_score, e.social_score, e.governance_score
         FROM esg_metrics e
         JOIN companies c ON e.company_id = c.id
         WHERE c.sector = ?
         ORDER BY e.environmental_score`,
        [sector]
    );

    if (sectorData.length < 3) return count;

    const metrics = [
        {
            name: 'environmental',
            score: envScore,
            allScores: sectorData.map(r => r.environmental_score).sort((a, b) => a - b)
        },
        {
            name: 'social',
            score: socScore,
            allScores: sectorData.map(r => r.social_score).sort((a, b) => a - b)
        },
        {
            name: 'governance',
            score: govScore,
            allScores: sectorData.map(r => r.governance_score).sort((a, b) => a - b)
        }
    ];

    for (const metric of metrics) {
        const scores = metric.allScores;
        const n = scores.length;

        // Calculate real percentile thresholds
        const p25 = scores[Math.floor(n * 0.25)];  // bottom 25% = poor
        const p75 = scores[Math.floor(n * 0.75)];  // top 25% = good
        const p95 = scores[Math.floor(n * 0.95)];  // top 5% = suspicious

        let severity = null;
        let reason = null;

        if (metric.score >= p95) {
            // Top 5% — suspiciously high
            severity = 'HIGH';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is in the top 5% of the ${sector} sector (above ${p95.toFixed(1)}) — suspiciously high, possible data manipulation`;
        } else if (metric.score <= p25) {
            // Bottom 25% — poor performance
            severity = 'MEDIUM';
            reason = `${metric.name} score of ${metric.score.toFixed(1)} is in the bottom 25% of the ${sector} sector (below ${p25.toFixed(1)}) — underperforming peers`;
        }

        if (severity) {
            await db.query(
                `INSERT INTO anomalies (company_id, year, metric_type, severity, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [companyId, year, metric.name, severity, reason]
            );
            count++;
        }
    }
    return count;
}