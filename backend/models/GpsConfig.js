const mongoose = require('mongoose');

const gpsConfigSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: [true, 'GPS provider name is required'],
      trim: true,
      default: 'Built-in Live Fleet Telematics Simulator',
    },
    apiUrl: {
      type: String,
      trim: true,
      default: 'https://api.gps-provider.local/v1/vehicles',
    },
    encryptedApiKey: {
      type: String,
      default: 'sikka_live_gps_key_9948271',
    },
    encryptedApiSecret: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    pollIntervalSeconds: {
      type: Number,
      default: 15,
      min: 5,
      max: 300,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GpsConfig', gpsConfigSchema);
