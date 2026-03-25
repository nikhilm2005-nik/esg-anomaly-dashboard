const db = require('../db/db');

exports.getAllCompanies = async (req, res) => {
    try {
        // Get max score for normalization
        const [[{ maxScore }]] = await db.query(
            'SELECT MAX(total_score) as maxScore FROM esg_metrics'
        );

        const [rows] = await db.query(`
            SELECT c.*, 
            AVG(e.total_score) as avg_score,
            AVG(e.environmental_score) as avg_env,
            AVG(e.social_score) as avg_soc,
            AVG(e.governance_score) as avg_gov,
            COUNT(a.id) as anomaly_count
            FROM companies c
            LEFT JOIN esg_metrics e ON c.id = e.company_id
            LEFT JOIN anomalies a ON c.id = a.company_id
            GROUP BY c.id
            ORDER BY anomaly_count DESC
        `);

        // Normalize all scores to 0-100
        const normalized = rows.map(row => ({
            ...row,
            avg_score: row.avg_score
                ? ((row.avg_score / maxScore) * 100).toFixed(1)
                : 'N/A',
            avg_env: row.avg_env
                ? ((row.avg_env / maxScore) * 100).toFixed(1)
                : 'N/A',
            avg_soc: row.avg_soc
                ? ((row.avg_soc / maxScore) * 100).toFixed(1)
                : 'N/A',
            avg_gov: row.avg_gov
                ? ((row.avg_gov / maxScore) * 100).toFixed(1)
                : 'N/A',
        }));

        res.json(normalized);
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
        const [[{ maxScore }]] = await db.query(
            'SELECT MAX(total_score) as maxScore FROM esg_metrics'
        );

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

        // Normalize scores
        const normalized = rows.map(row => ({
            ...row,
            environmental_score: row.environmental_score
                ? ((row.environmental_score / maxScore) * 100).toFixed(1)
                : 'N/A',
            social_score: row.social_score
                ? ((row.social_score / maxScore) * 100).toFixed(1)
                : 'N/A',
            governance_score: row.governance_score
                ? ((row.governance_score / maxScore) * 100).toFixed(1)
                : 'N/A',
            total_score: row.total_score
                ? ((row.total_score / maxScore) * 100).toFixed(1)
                : 'N/A',
        }));

        res.json(normalized);
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
                        `${metric.name} score of ${metric.score} is ${Math.abs(z).toFixed(2)} standard deviations from the ${sector} industry average of ${parseFloat(metric.avg).toFixed(1)}`
                    ]
                );
                count++;
            }
        }
    }
    return count;
}