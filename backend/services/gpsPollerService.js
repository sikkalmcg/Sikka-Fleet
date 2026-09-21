const GpsSetting = require('../models/GpsSetting');
const Vehicle = require('../models/Vehicle');
const { fetchGpsLocations } = require('./gpsSimulatorService');
const { processVehicleLocation } = require('./geofenceService');

let pollerIntervalId = null;
let isPolling = false;

async function syncGpsPositions() {
  if (isPolling) return { success: true, message: 'Sync in progress' };
  isPolling = true;

  try {
    const config = await GpsSetting.findOne().sort({ updatedAt: -1 });
    if (config && config.status === 'Inactive') {
      return { success: true, message: 'GPS Service is inactive' };
    }

    const gpsPoints = await fetchGpsLocations(config);
    const activeVehicles = await Vehicle.find({ status: 'Active' });

    const vehicleById = new Map();
    const vehicleByNumber = new Map();
    for (const v of activeVehicles) {
      vehicleById.set(v._id.toString(), v);
      vehicleByNumber.set(v.vehicleNumber.toUpperCase(), v);
    }

    let processedCount = 0;

    for (const point of gpsPoints) {
      let vehicle = null;
      if (point.vehicleId && vehicleById.has(point.vehicleId.toString())) {
        vehicle = vehicleById.get(point.vehicleId.toString());
      } else if (point.vehicleNumber && vehicleByNumber.has(point.vehicleNumber.toUpperCase())) {
        vehicle = vehicleByNumber.get(point.vehicleNumber.toUpperCase());
      }

      if (!vehicle && point.vehicleNumber) {
        try {
          vehicle = await Vehicle.create({
            vehicleNumber: point.vehicleNumber.toUpperCase(),
            driverName: '',
            mobile: '',
            fleetType: 'Own Fleet',
            gpsDeviceId: point.deviceNumber || point.vehicleNumber,
            status: 'Active',
          });
          vehicleById.set(vehicle._id.toString(), vehicle);
          vehicleByNumber.set(vehicle.vehicleNumber.toUpperCase(), vehicle);
          console.log(`[Auto-Enroll] Enrolled vehicle ${vehicle.vehicleNumber} from WheelsEye GPS.`);
        } catch (e) {
          vehicle = await Vehicle.findOne({ vehicleNumber: point.vehicleNumber.toUpperCase() });
        }
      }

      if (vehicle && typeof point.latitude === 'number' && typeof point.longitude === 'number') {
        await processVehicleLocation(
          vehicle,
          point.latitude,
          point.longitude,
          point.timestamp ? new Date(point.timestamp) : new Date(),
          config ? config.provider : 'GPS Service'
        );
        processedCount++;
      }
    }

    // Update GPS settings sync status
    if (config) {
      config.lastSync = new Date();
      config.connectionStatus = 'Connected';
      config.lastError = '';
      await config.save();
    }

    return { success: true, processedCount, lastSync: new Date() };
  } catch (error) {
    console.error('[GPS Poller Error]:', error.message);
    const config = await GpsSetting.findOne().sort({ updatedAt: -1 });
    if (config) {
      config.connectionStatus = 'Connection Failed';
      config.lastError = error.message;
      await config.save();
    }
    throw error;
  } finally {
    isPolling = false;
  }
}

async function testGpsConnection() {
  try {
    const config = await GpsSetting.findOne().sort({ updatedAt: -1 });
    if (!config) {
      return {
        status: 'Connected',
        message: 'Built-in telematics simulator ready and active.',
        lastSync: new Date(),
      };
    }

    // Test fetching locations
    const points = await fetchGpsLocations(config);
    config.connectionStatus = 'Connected';
    config.lastSync = new Date();
    config.lastError = '';
    await config.save();

    return {
      status: 'Connected',
      message: `Successfully connected to ${config.provider}. Verified ${points.length} telemetry streams.`,
      lastSync: config.lastSync,
    };
  } catch (error) {
    const config = await GpsSetting.findOne().sort({ updatedAt: -1 });
    if (config) {
      config.connectionStatus = 'Connection Failed';
      config.lastError = error.message;
      await config.save();
    }
    return {
      status: 'Connection Failed',
      message: error.message || 'Unable to connect to GPS provider.',
      lastError: error.message,
    };
  }
}

function startGpsPoller(intervalSeconds = 1200) {
  if (pollerIntervalId) {
    clearInterval(pollerIntervalId);
  }

  console.log(`[GPS Poller] Polling worker running (every ${intervalSeconds}s)`);
  syncGpsPositions().catch((err) => console.error('[Initial GPS Sync Error]:', err.message));

  pollerIntervalId = setInterval(() => {
    syncGpsPositions().catch((err) => console.error('[GPS Sync Error]:', err.message));
  }, intervalSeconds * 1000);
}

function stopGpsPoller() {
  if (pollerIntervalId) {
    clearInterval(pollerIntervalId);
    pollerIntervalId = null;
  }
}

module.exports = {
  syncGpsPositions,
  testGpsConnection,
  startGpsPoller,
  stopGpsPoller,
};
