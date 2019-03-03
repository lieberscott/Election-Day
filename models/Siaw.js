const mongoose = require('mongoose');

// keeping it basic for now
const siawSchema = mongoose.Schema({
  lastname: { type: String, required: true },
  firstname: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: Number, required: true },
  ward: { type: Number, required: true },
  precinct: { type: Number, required: true },
  voted: { type: Boolean, required: true },
  enteredBy: { type: String, required: false }
});

module.exports = mongoose.model('Siaw', siawSchema);