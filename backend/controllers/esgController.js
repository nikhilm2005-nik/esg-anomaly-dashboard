const db = require('../db/db');

exports.getESGByCompany = async (req, res) => {
    try {
        const [[{ maxScore }]] = await db.query(
            'SELECT MAX(total_score) as maxScore FROM esg_metrics'
        );

        const [rows] = await db.query(
            'SELECT * FROM esg_metrics WHERE company_id = ? ORDER BY year',
            [req.params.companyId]
        );

        const normalized = rows.map(row => ({
            ...row,
            environmental_score: row.environmental_score
                ? ((row.environmental_score / maxScore) * 100).toFixed(1)
                : 0,
            social_score: row.social_score
                ? ((row.social_score / maxScore) * 100).toFixed(1)
                : 0,
            governance_score: row.governance_score
                ? ((row.governance_score / maxScore) * 100).toFixed(1)
                : 0,
            total_score: row.total_score
                ? ((row.total_score / maxScore) * 100).toFixed(1)
                : 0,
        }));

        res.json(normalized);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.compareCompanies = async (req, res) => {
    try {
        const [[{ maxScore }]] = await db.query(
            'SELECT MAX(total_score) as maxScore FROM esg_metrics'
        );

        const [company1] = await db.query(
            `SELECT c.name, e.* FROM esg_metrics e 
             JOIN companies c ON e.company_id = c.id 
             WHERE e.company_id = ?`,
            [req.params.id1]
        );

        const [company2] = await db.query(
            `SELECT c.name, e.* FROM esg_metrics e 
             JOIN companies c ON e.company_id = c.id 
             WHERE e.company_id = ?`,
            [req.params.id2]
        );

        // Normalize both companies
        const normalize = (rows) => rows.map(row => ({
            ...row,
            environmental_score: row.environmental_score
                ? ((row.environmental_score / maxScore) * 100).toFixed(1)
                : 0,
            social_score: row.social_score
                ? ((row.social_score / maxScore) * 100).toFixed(1)
                : 0,
            governance_score: row.governance_score
                ? ((row.governance_score / maxScore) * 100).toFixed(1)
                : 0,
            total_score: row.total_score
                ? ((row.total_score / maxScore) * 100).toFixed(1)
                : 0,
        }));

        res.json({
            company1: normalize(company1),
            company2: normalize(company2)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};