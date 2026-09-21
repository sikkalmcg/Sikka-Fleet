const express = require('express');
const GpsSetting = require('../models/GpsSetting');
const { verifyToken, checkPageAccess } = require('../middleware/auth');
const { syncGpsPositions, testGpsConnection } = require('../services/gpsPollerService');

const router = express.Router();

// Require authenticated user with 'GPS' page permission
router.use(verifyToken, checkPageAccess('GPS'));

// GET /api/gps - Retrieve current GPS configuration
router.get('/', async (req, res) => {
  try {
    let setting = await GpsSetting.findOne().sort({ updatedAt: -1 });

    if (!setting) {
      setting = await GpsSetting.create({
        provider: 'Fleet Telematics GPS Provider',
        apiUrl: 'https://api.telematics-provider.local/v1/vehicles',
        encryptedApiKey: 'sikka_live_gps_key_9948271',
        status: 'Active',
        connectionStatus: 'Connected',
        lastSync: new Date(),
        pollIntervalSeconds: 15,
      });
    }

    const maskedSetting = {
      _id: setting._id,
      provider: setting.provider,
      apiUrl: setting.apiUrl,
      status: setting.status,
      connectionStatus: setting.connectionStatus || 'Connected',
      lastSync: setting.lastSync,
      lastError: setting.lastError,
      pollIntervalSeconds: setting.pollIntervalSeconds,
      hasApiKey: Boolean(setting.encryptedApiKey),
      maskedApiKey: setting.encryptedApiKey
        ? `••••••••••••${setting.encryptedApiKey.slice(-4)}`
        : '',
      hasApiSecret: Boolean(setting.apiSecret),
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };

    res.json(maskedSetting);
  } catch (error) {
    console.error('[Get GPS Setting Error]:', error);
    res.status(500).json({ error: 'GPS service temporarily unavailable.' });
  }
});

// POST /api/gps - Save or update GPS configuration
router.post('/', async (req, res) => {
  try {
    const { provider, apiUrl, apiKey, apiSecret, status, pollIntervalSeconds } = req.body;

    if (!provider || !provider.trim()) {
      return res.status(400).json({ error: 'GPS Provider is required.' });
    }

    let setting = await GpsSetting.findOne().sort({ updatedAt: -1 });

    const updateData = {
      provider: provider.trim(),
      apiUrl: apiUrl ? apiUrl.trim() : '',
      status: status === 'Inactive' ? 'Inactive' : 'Active',
      pollIntervalSeconds: Number(pollIntervalSeconds) || 15,
    };

    if (apiKey && !apiKey.includes('••••')) {
      updateData.encryptedApiKey = apiKey.trim();
    }
    if (apiSecret && !apiSecret.includes('••••')) {
      updateData.apiSecret = apiSecret.trim();
    }

    if (setting) {
      Object.assign(setting, updateData);
      await setting.save();
    } else {
      setting = await GpsSetting.create(updateData);
    }

    res.json({
      message: 'GPS configuration saved successfully.',
      setting: {
        _id: setting._id,
        provider: setting.provider,
        apiUrl: setting.apiUrl,
        status: setting.status,
        connectionStatus: setting.connectionStatus,
        lastSync: setting.lastSync,
        lastError: setting.lastError,
        pollIntervalSeconds: setting.pollIntervalSeconds,
        hasApiKey: Boolean(setting.encryptedApiKey),
        maskedApiKey: setting.encryptedApiKey
          ? `••••••••••••${setting.encryptedApiKey.slice(-4)}`
          : '',
      },
    });
  } catch (error) {
    console.error('[Save GPS Setting Error]:', error);
    res.status(500).json({ error: 'Unable to connect to GPS provider.' });
  }
});

// POST /api/gps/test-connection - Test provider connection
router.post('/test-connection', async (req, res) => {
  try {
    const result = await testGpsConnection();
    res.json(result);
  } catch (error) {
    console.error('[Test GPS Connection Error]:', error);
    res.status(500).json({
      status: 'Connection Failed',
      message: 'Unable to connect to GPS provider.',
      lastError: error.message,
    });
  }
});

// POST /api/gps/trigger-sync - Manual GPS sync trigger
router.post('/trigger-sync', async (req, res) => {
  try {
    const result = await syncGpsPositions();
    res.json({
      message: 'GPS synchronization completed successfully.',
      ...result,
    });
  } catch (error) {
    console.error('[Trigger GPS Sync Error]:', error);
    res.status(500).json({ error: 'Unable to connect to GPS provider.' });
  }
});

// GET /api/gps/live-vehicles - Live vehicle stream with current loading & geofences
router.get('/live-vehicles', async (req, res) => {
  try {
    const Plant = require('../models/Plant');
    const Vehicle = require('../models/Vehicle');
    const VehicleCurrentStatus = require('../models/VehicleCurrentStatus');
    const { fetchGpsLocations } = require('../services/gpsSimulatorService');
    const { calculateHaversineDistance } = require('../services/geofenceService');

    const setting = await GpsSetting.findOne().sort({ updatedAt: -1 });
    const rawPoints = await fetchGpsLocations(setting);
    const activePlants = await Plant.find({ status: 'Active' });

    // Lookup existing vehicles and their status & plans
    const vehicles = await Vehicle.find();
    const vehicleByNum = new Map();
    for (const v of vehicles) {
      vehicleByNum.set(v.vehicleNumber.toUpperCase(), v);
    }

    const statuses = await VehicleCurrentStatus.find().populate('currentPlantId', 'plantName');
    const statusByVehId = new Map();
    for (const s of statuses) {
      statusByVehId.set(s.vehicleId.toString(), s);
    }

    const liveVehicles = rawPoints.map((pt) => {
      const vNum = pt.vehicleNumber ? pt.vehicleNumber.toUpperCase() : '';
      const matchedVeh = vehicleByNum.get(vNum);
      const matchedStatus = matchedVeh ? statusByVehId.get(matchedVeh._id.toString()) : null;

      // Geofence calculation
      let matchedPlant = null;
      let minDistance = Infinity;

      for (const plant of activePlants) {
        const radius = plant.radiusMeters || plant.radiusMeter || 500;
        const dist = calculateHaversineDistance(pt.latitude, pt.longitude, plant.latitude, plant.longitude);
        if (dist <= radius && dist < minDistance) {
          minDistance = dist;
          matchedPlant = plant;
        }
      }

      // Nearest plant overall for distance reference
      let nearestPlantName = '';
      let nearestDistance = Infinity;
      for (const plant of activePlants) {
        const dist = calculateHaversineDistance(pt.latitude, pt.longitude, plant.latitude, plant.longitude);
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestPlantName = plant.plantName;
        }
      }

      const plans = matchedStatus && Array.isArray(matchedStatus.plans) ? matchedStatus.plans : [];
      const latestPlan = plans.length > 0 ? plans[plans.length - 1] : null;

      return {
        vehicleNumber: vNum,
        vehicleId: matchedVeh ? matchedVeh._id : null,
        driverName: matchedVeh ? matchedVeh.driverName : 'Fleet Driver',
        mobile: matchedVeh ? matchedVeh.mobile : '+91 9876543210',
        deviceNumber: pt.deviceNumber || 'N/A',
        vendorName: pt.vendorName || 'Vaibhav Sikka',
        vehicleType: pt.vehicleType || 'Commercial',
        latitude: pt.latitude,
        longitude: pt.longitude,
        speed: pt.speed || 0,
        ignition: pt.ignition,
        angle: pt.angle || 0,
        chargeOn: pt.chargeOn,
        timestamp: pt.timestamp,
        readableTime: pt.readableTime,
        geofence: {
          status: matchedPlant ? 'Inside' : 'Outside',
          plantName: matchedPlant ? matchedPlant.plantName : 'Outside All Plants',
          distanceMeter: matchedPlant ? minDistance : nearestDistance,
          nearestPlant: nearestPlantName,
        },
        loadingPlan: {
          currentPlan: latestPlan ? latestPlan.planText : '',
          authorName: latestPlan ? latestPlan.authorName : '',
          createdAt: latestPlan ? latestPlan.createdAt : null,
          history: plans,
        },
      };
    });

    res.json({
      totalCount: liveVehicles.length,
      provider: setting ? setting.provider : 'WheelsEye GPS',
      apiUrl: setting ? setting.apiUrl : '',
      lastSync: new Date(),
      vehicles: liveVehicles,
    });
  } catch (error) {
    console.error('[Live Vehicles Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve live telemetry vehicles.' });
  }
});

module.exports = router;
