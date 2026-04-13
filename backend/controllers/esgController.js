const db = require('../db/db');

exports.getESGByCompany = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM esg_metrics WHERE company_id = ? ORDER BY year',
            [req.params.companyId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.compareCompanies = async (req, res) => {
    try {
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
        res.json({ company1, company2 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};