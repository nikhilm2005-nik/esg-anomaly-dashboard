const db = require('../db/db');

exports.getAllAnomalies = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.*, c.name, c.sector 
            FROM anomalies a
            JOIN companies c ON a.company_id = c.id
            ORDER BY FIELD(a.severity, 'HIGH', 'MEDIUM', 'LOW')
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getAnomaliesByCompany = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM anomalies WHERE company_id = ?',
            [req.params.companyId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};