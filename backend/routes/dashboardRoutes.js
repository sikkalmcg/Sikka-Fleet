const express = require('express');
const Plant = require('../models/Plant');
const Vehicle = require('../models/Vehicle');
const VehicleCurrentStatus = require('../models/VehicleCurrentStatus');
const PlantEntryEvent = require('../models/PlantEntryEvent');
const { verifyToken, checkPageAccess } = require('../middleware/auth');

const router = express.Router();

// Require authenticated user with 'Dashboard' page permission
router.use(verifyToken, checkPageAccess('Dashboard'));

// GET /api/dashboard/summary - Dynamic widgets for active plants and outside
router.get('/summary', async (req, res) => {
  try {
    const plantQuery = { status: 'Active' };

    // RBAC: If user has restricted plant permissions, only include those plants
    if (req.user.accessPlants && req.user.accessPlants.length > 0) {
      const allowedPlantIds = req.user.accessPlants.map((p) => (p._id ? p._id : p));
      plantQuery._id = { $in: allowedPlantIds };
    }

    const activePlants = await Plant.find(plantQuery).sort({ plantName: 1 });

    // Aggregate vehicle counts by currentPlantId and status
    // Only count Active vehicles
    const activeVehicles = await Vehicle.find({ status: 'Active' }).select('_id');
    const activeVehicleIds = activeVehicles.map((v) => v._id);

    const statuses = await VehicleCurrentStatus.find({
      vehicleId: { $in: activeVehicleIds },
    });

    const plantCounts = new Map();
    let outsideCount = 0;

    for (const st of statuses) {
      if (st.status === 'Inside' && st.currentPlantId) {
        const pid = st.currentPlantId.toString();
        plantCounts.set(pid, (plantCounts.get(pid) || 0) + 1);
      } else {
        outsideCount++;
      }
    }

    // Dynamic widgets based on active Plant records (do not hardcode plant names)
    const plantWidgets = activePlants.map((plant) => ({
      id: plant._id,
      name: plant.plantName,
      location: plant.location,
      radiusMeter: plant.radiusMeter,
      latitude: plant.latitude,
      longitude: plant.longitude,
      vehicleCount: plantCounts.get(plant._id.toString()) || 0,
      isOutside: false,
    }));

    res.json({
      plantWidgets,
      outsideWidget: {
        id: 'outside',
        name: 'Outside',
        vehicleCount: outsideCount,
        isOutside: true,
      },
      totalActiveVehicles: activeVehicles.length,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('[Dashboard Summary Error]:', error);
    res.status(500).json({ error: 'Failed to generate dashboard summary.' });
  }
});

// GET /api/dashboard/plants/:plantId/vehicles - Drilldown into vehicles inside a plant
router.get('/plants/:plantId/vehicles', async (req, res) => {
  try {
    const { plantId } = req.params;

    // RBAC check: enforce plant access if user has restrictions
    if (req.user.accessPlants && req.user.accessPlants.length > 0) {
      const allowedPlantIds = req.user.accessPlants.map((p) => (p._id ? p._id.toString() : p.toString()));
      if (!allowedPlantIds.includes(plantId.toString())) {
        return res.status(403).json({ error: 'Access Denied: You do not have permission to view this plant.' });
      }
    }

    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found.' });
    }

    // Find current statuses for this plant
    const currentStatuses = await VehicleCurrentStatus.find({
      currentPlantId: plantId,
      status: 'Inside',
    })
      .populate('vehicleId', 'vehicleNumber driverName mobile fleetType ownerName status')
      .sort({ lastEntryDateTime: -1 });

    const vehicles = currentStatuses
      .filter((item) => item.vehicleId && item.vehicleId.status === 'Active')
      .map((item) => ({
        id: item.vehicleId._id,
        vehicleNumber: item.vehicleId.vehicleNumber,
        driverName: item.vehicleId.driverName,
        mobile: item.vehicleId.mobile,
        fleetType: item.vehicleId.fleetType,
        ownerName: item.vehicleId.ownerName,
        entryDateTime: item.lastEntryDateTime || item.lastUpdatedAt,
        latitude: item.latitude,
        longitude: item.longitude,
        distanceMeter: item.distanceMeter,
        status: 'Inside',
        plans: Array.isArray(item.plans) ? item.plans : [],
      }));

    res.json({
      plant: {
        id: plant._id,
        name: plant.plantName,
        location: plant.location,
        radiusMeter: plant.radiusMeter,
      },
      vehicles,
    });
  } catch (error) {
    console.error('[Dashboard Plant Vehicles Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve plant vehicle list.' });
  }
});

// POST /api/dashboard/vehicles/:vehicleId/plan - Add or edit dispatch plan for a vehicle
router.post('/vehicles/:vehicleId/plan', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { planText } = req.body;

    if (!planText || !planText.trim()) {
      return res.status(400).json({ error: 'Plan description is required.' });
    }

    const trimmedPlan = planText.trim();

    let statusDoc = await VehicleCurrentStatus.findOne({ vehicleId });
    if (!statusDoc) {
      statusDoc = await VehicleCurrentStatus.create({
        vehicleId,
        status: 'Outside',
        latitude: 28.6,
        longitude: 77.3,
        plans: [],
      });
    }

    if (!Array.isArray(statusDoc.plans)) {
      statusDoc.plans = [];
    }

    const newPlanEntry = {
      planText: trimmedPlan,
      authorName: req.user.fullName || req.user.username || 'User',
      authorUsername: req.user.username,
      createdAt: new Date(),
    };

    statusDoc.plans.push(newPlanEntry);
    await statusDoc.save();

    res.json({
      message: 'Plan saved successfully.',
      plan: newPlanEntry,
      plans: statusDoc.plans,
    });
  } catch (error) {
    console.error('[Add Vehicle Plan Error]:', error);
    res.status(500).json({ error: 'Failed to save vehicle plan.' });
  }
});

// GET /api/dashboard/outside/vehicles - Drilldown into vehicles currently Outside
router.get('/outside/vehicles', async (req, res) => {
  try {
    const currentStatuses = await VehicleCurrentStatus.find({
      status: 'Outside',
    })
      .populate('vehicleId', 'vehicleNumber driverName mobile fleetType ownerName status')
      .sort({ lastUpdatedAt: -1 });

    const vehicles = currentStatuses
      .filter((item) => item.vehicleId && item.vehicleId.status === 'Active')
      .map((item) => ({
        id: item.vehicleId._id,
        vehicleNumber: item.vehicleId.vehicleNumber,
        driverName: item.vehicleId.driverName,
        mobile: item.vehicleId.mobile,
        fleetType: item.vehicleId.fleetType,
        ownerName: item.vehicleId.ownerName,
        lastLocationTime: item.lastUpdatedAt,
        latitude: item.latitude,
        longitude: item.longitude,
        status: 'Outside',
      }));

    res.json({
      title: 'Outside Vehicles',
      vehicles,
    });
  } catch (error) {
    console.error('[Dashboard Outside Vehicles Error]:', error);
    res.status(500).json({ error: 'Failed to retrieve outside vehicles.' });
  }
});

// Helper to escape HTML/XML
function escapeXml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatIST(date) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(date);
  }
}

// GET /api/dashboard/plants/:plantId/export - Export plant vehicles as .xls file
router.get('/plants/:plantId/export', async (req, res) => {
  try {
    const { plantId } = req.params;
    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).send('Plant not found');
    }

    const currentStatuses = await VehicleCurrentStatus.find({
      currentPlantId: plantId,
      status: 'Inside',
    })
      .populate('vehicleId', 'vehicleNumber driverName mobile fleetType ownerName status')
      .sort({ lastEntryDateTime: -1 });

    const headers = [
      'Vehicle Number',
      'Entry Date & Time',
      'Driver Name',
      'Mobile',
      'Fleet Type',
      'Distance From Center',
      'Latest Plan',
      'Plan History (Audit Trail)',
    ];

    const headerHtml = `<tr>${headers
      .map(
        (h) =>
          `<th style="background-color:#059669;color:#ffffff;font-weight:bold;padding:10px 14px;border:1px solid #d1d5db;font-family:Arial,sans-serif;font-size:12px;text-align:left;">${escapeXml(
            h
          )}</th>`
      )
      .join('')}</tr>`;

    const rowsHtml = currentStatuses
      .filter((st) => st.vehicleId && st.vehicleId.status === 'Active')
      .map((st) => {
        const v = st.vehicleId;
        const plans = Array.isArray(st.plans) ? st.plans : [];
        const latestPlan = plans.length > 0 ? plans[plans.length - 1] : null;
        const latestPlanStr = latestPlan
          ? `${latestPlan.planText} (by ${latestPlan.authorName} on ${formatIST(latestPlan.createdAt)})`
          : 'No Plan';

        const historyStr =
          plans.length > 1
            ? plans
                .slice(0, -1)
                .map(
                  (p, idx) =>
                    `[Old Plan ${idx + 1} by ${p.authorName} (${formatIST(p.createdAt)}): ${p.planText}]`
                )
                .join('<br/>')
            : 'None';

        const cells = [
          v.vehicleNumber,
          formatIST(st.lastEntryDateTime || st.lastUpdatedAt),
          v.driverName || '—',
          v.mobile || '—',
          v.fleetType,
          `${Math.round(st.distanceMeter || 0)} m`,
          latestPlanStr,
          historyStr,
        ];

        return `<tr>${cells
          .map(
            (c, i) =>
              `<td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:11px;vertical-align:top;${
                i === 0 ? 'font-weight:bold;color:#0f172a;' : 'color:#334155;'
              }">${i === 7 ? c : escapeXml(c)}</td>`
          )
          .join('')}</tr>`;
      })
      .join('');

    const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeXml(plant.plantName)}</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
</head>
<body>
  <table border="1" style="border-collapse:collapse;">
    <thead>${headerHtml}</thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const plantSlug = plant.plantName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${plantSlug}_Vehicles_${dateStr}.xls`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelHtml);
  } catch (error) {
    console.error('[Export Plant Vehicles Error]:', error);
    res.status(500).send('Failed to export plant vehicles.');
  }
});

// GET /api/dashboard/outside/export - Export outside vehicles as .xls file
router.get('/outside/export', async (req, res) => {
  try {
    const currentStatuses = await VehicleCurrentStatus.find({
      status: 'Outside',
    })
      .populate('vehicleId', 'vehicleNumber driverName mobile fleetType ownerName status')
      .sort({ lastUpdatedAt: -1 });

    const headers = [
      'Vehicle Number',
      'Last Location Time',
      'Status',
      'Latitude',
      'Longitude',
      'Driver Name',
      'Fleet Type',
    ];

    const headerHtml = `<tr>${headers
      .map(
        (h) =>
          `<th style="background-color:#f59e0b;color:#ffffff;font-weight:bold;padding:10px 14px;border:1px solid #d1d5db;font-family:Arial,sans-serif;font-size:12px;text-align:left;">${escapeXml(
            h
          )}</th>`
      )
      .join('')}</tr>`;

    const rowsHtml = currentStatuses
      .filter((st) => st.vehicleId && st.vehicleId.status === 'Active')
      .map((st) => {
        const v = st.vehicleId;
        const cells = [
          v.vehicleNumber,
          formatIST(st.lastUpdatedAt),
          'Outside',
          Number(st.latitude || 0).toFixed(6),
          Number(st.longitude || 0).toFixed(6),
          v.driverName || '—',
          v.fleetType,
        ];

        return `<tr>${cells
          .map(
            (c, i) =>
              `<td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:11px;vertical-align:top;${
                i === 0 ? 'font-weight:bold;color:#0f172a;' : 'color:#334155;'
              }">${escapeXml(c)}</td>`
          )
          .join('')}</tr>`;
      })
      .join('');

    const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Outside Vehicles</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
</head>
<body>
  <table border="1" style="border-collapse:collapse;">
    <thead>${headerHtml}</thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Outside_Vehicles_${dateStr}.xls`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(excelHtml);
  } catch (error) {
    console.error('[Export Outside Vehicles Error]:', error);
    res.status(500).send('Failed to export outside vehicles.');
  }
});

module.exports = router;
