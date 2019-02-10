const mongoose = require('mongoose');

// keeping it basic for now
const mendozaSchema = mongoose.Schema({
  last_name: { type: String, required: true },
  first_name: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: Number, required: true },
  ward: { type: Number, required: true },
  precinct: { type: Number, required: true }
});

module.exports = mongoose.model('Mendoza', mendozaSchema);