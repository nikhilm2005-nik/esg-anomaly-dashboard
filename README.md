# esg-anomaly-dashboard
A full stack web application that detects and visualizes suspicious ESG (Environmental, Social, Governance) compliance data from company sustainability reports using statistical anomaly detection — built with HTML, CSS, JavaScript, Node.js, Express.js, and MySQL.

The Hierarchy in which the file access each other :

MySQL Server (Data Storage)
    ↑
db/db.js (Database Connection)
    ↑
controllers/ (Business Logic)
    ├── companiesController.js
    ├── esgController.js
    ├── anomalyController.js
    ├── uploadController.js
    └── dashboardController.js
    ↑
routes/ (URL Mapping)
    ├── companies.js
    ├── esg.js
    ├── anomalies.js
    ├── upload.js
    └── dashboard.js
    ↑
server.js (Entry Point)
    ↑
HTTP Request (REST API)
    ↑
frontend/js/ (API Calls)
    ├── dashboard.js
    ├── companies.js
    ├── anomalies.js
    ├── upload.js
    ├── compare.js
    └── add-company.js
    ↑
frontend/pages/ (User Interface)
    ├── index.html
    ├── companies.html
    ├── anomalies.html
    ├── upload.html
    ├── compare.html
    └── add-company.html
    ↑
css/style.css (Styling — used by all pages)
    ↑
Browser (What user sees)
