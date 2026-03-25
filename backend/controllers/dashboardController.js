const db = require('../db/db');

exports.getDashboardStats = async (req, res) => {
    try {
        const [[{ totalCompanies }]] = await db.query(
            'SELECT COUNT(*) as totalCompanies FROM companies'
        );
        const [[{ totalAnomalies }]] = await db.query(
            'SELECT COUNT(*) as totalAnomalies FROM anomalies'
        );
        const [[{ maxScore }]] = await db.query(
            'SELECT MAX(total_score) as maxScore FROM esg_metrics'
        );
        const [[{ rawAvg }]] = await db.query(
            'SELECT AVG(total_score) as rawAvg FROM esg_metrics'
        );

        const avgScore = maxScore > 0
            ? ((rawAvg / maxScore) * 100).toFixed(1)
            : 0;

        const [[{ highRisk }]] = await db.query(
            'SELECT COUNT(*) as highRisk FROM anomalies WHERE severity = "HIGH"'
        );
        const [topFlagged] = await db.query(`
            SELECT c.name, COUNT(a.id) as anomaly_count 
            FROM anomalies a
            JOIN companies c ON a.company_id = c.id
            GROUP BY c.id
            ORDER BY anomaly_count DESC
            LIMIT 5
        `);

        res.json({ totalCompanies, totalAnomalies, avgScore, highRisk, topFlagged });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};