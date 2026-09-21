# Sikka Fleet – Fleet Management Application

Enterprise fleet management, plant geofencing, and telematics tracking system built for **Sikka LMC**.

## Features

- **Dashboard**: Live plant geofencing monitoring with entry timestamps, distances, and Excel `.xls` export.
- **Plant Management**: Add, configure, and monitor plants with custom circular geofence perimeters.
- **Vehicle Register**: Manage fleet vehicles (Own Fleet, Hired, Rental) with custom driver attributions.
- **GPS Telematics**: Live WheelsEye GPS integration with automatic 20-minute position polling and dispatch planning.
- **User Management**: Role-based access control (Admin & Plant Operators) with plant-level permissions.
- **MongoDB Atlas Integration**: Cloud MongoDB connection with automatic schema validation and indexes.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express 5, Mongoose 9, JWT Authentication
- **Database**: MongoDB Atlas Cloud
- **Telematics**: WheelsEye GPS API

---

## Quick Start

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/Sikkaindlmc/sikka-fleet.git
cd sikka-fleet

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup
Configure `backend/.env` with your MongoDB Atlas connection string:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_key
MONGODB_URI=mongodb+srv://<username>:<password>@sikka-fleet.hubg2m2.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=sikka_fleet
```

### 3. Run the Application
From the project root:
```bash
# Seed initial database records
npm run seed

# Start backend server (Port 5000)
npm run start:backend

# Start frontend application (Port 3000)
npm run start:frontend
```

---

## Default Access Credentials

- **Administrator**:
  - Username: `ajaysomra`
  - Password: `Somra@2012`
  - Permissions: Full system access (All plants & operations)

---

## License

Proprietary software developed for **Sikka LMC**. All rights reserved.
