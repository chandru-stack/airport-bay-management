# Automated Bay Allocation and Management System
### Chennai International Airport (MAA)

A real-world full-stack airport operations platform featuring four role-based dashboards for Airline, AOCC, ATC, and Apron teams.

## Tech Stack
- **Frontend:** React.js + Vite
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL
- **Real-time:** Socket.io
- **Auth:** JWT

## Features
- Automated bay allocation algorithm (ICAO size classification)
- Real-time flight status updates via WebSocket
- Role-based dashboards: Airline, AOCC, ATC, Apron
- Conflict detection and emergency reassignment
- Apron lifecycle: ON-BLOCK → PUSHBACK → OFF-BLOCK
- CSV schedule upload for bulk flight imports
- Full audit log and history for all roles
- Delay monitoring with auto-alerts

## Airport Data
- 86 real bays from Chennai MAA (T1, T3, T4)
- Real ICAO aircraft size classification (C, D, E, F)

## Setup Instructions

### 1. Database
```sql
CREATE DATABASE airport_bay_management;
-- Run schema.sql then seed.sql
```

### 2. Backend
```bash
cd server
npm install
# Create .env file with your DB credentials
npm run dev
```

### 3. Frontend
```bash
cd client
npm install
npm run dev
```

## Default Login Credentials
| Role | Email | Password |
|------|-------|----------|
| AOCC | aocc@maa.airport.in | Airport@123 |
| ATC | atc@maa.airport.in | Airport@123 |
| Apron | apron@maa.airport.in | Airport@123 |
| Airline | ops.user@airindia.in | Airport@123 |

## Developer
**Chandru C R** — github.com/chandru-stack