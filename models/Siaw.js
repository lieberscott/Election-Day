const mongoose = require('mongoose');

// keeping it basic for now
const siawSchema = mongoose.Schema({
  van_id: { type: Number, required: true, unique: true },
  lastname: { type: String, required: true },
  firstname: { type: String, required: true },
  address: { type: String, required: true },
  ward: { type: Number, required: true },
  precinct: { type: Number, required: true },
  voted: { type: Boolean, required: true },
  enteredBy: { type: String, required: false }
});

module.exports = mongoose.model('Siaw', siawSchema);