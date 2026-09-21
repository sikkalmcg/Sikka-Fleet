const mongoose = require('mongoose');

const plantEntryEventSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plant',
      required: true,
      index: true,
    },
    entryDateTime: {
      type: Date,
      default: Date.now,
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
    distanceMeter: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

plantEntryEventSchema.index({ vehicleId: 1, plantId: 1, entryDateTime: -1 });

module.exports = mongoose.model('PlantEntryEvent', plantEntryEventSchema);
