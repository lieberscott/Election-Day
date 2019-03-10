const mongoose = require('mongoose');

// keeping it basic for now
const siawuserSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
    // match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
  },
  password: { type: String, required: true },
  ward: { type: Number, required: true },
  // precinct: { type: Number, default: -1 },
  no_of_precincts: { type: Number, required: true },
  candidate_first: { type: String, required: true },
  candidate_last: { type: String, required: true },
  admin: { type: Boolean, required: true, default: true }, // default: true, needs to be changed for pollwatchers
  paid: { type: Boolean, required: true, default: false },
  campaigns: [{ database: String, public_name: String }], // database names
  pollwatcher_name: { type: String, required: false }, // for pollwatchers only, maybe delete from admin schema?
});

module.exports = mongoose.model('Siawuser', siawuserSchema);