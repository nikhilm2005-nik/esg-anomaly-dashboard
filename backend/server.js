const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const companyRoutes = require('./routes/companies');
const esgRoutes = require('./routes/esg');
const anomalyRoutes = require('./routes/anomalies');
const uploadRoutes = require('./routes/upload');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/companies', companyRoutes);
app.use('/api/esg', esgRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('Server running! Open your dashboard:');
    console.log('http://127.0.0.1:5500/esg-anomaly-dashboard/frontend/index.html');
    console.log('');
});
