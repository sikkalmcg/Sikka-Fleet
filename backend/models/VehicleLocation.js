const mongoose = require('mongoose');

const vehicleLocationSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    gpsDateTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    speed: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      default: 'GPS Telematics',
    },
  },
  {
    collection: 'vehicleLocations',
    timestamps: true,
  }
);

vehicleLocationSchema.index({ vehicleNumber: 1, gpsDateTime: -1 });

module.exports = mongoose.model('VehicleLocation', vehicleLocationSchema);
