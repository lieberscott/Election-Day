const mongoose = require('mongoose');

// keeping it basic for now
const negronuserSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
    // match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
  },
  password: { type: String, required: true },
  ward: { type: Number, required: true },
  precinct: { type: Number, required: true },
  pollwatcher: { type: String, required: false }
});

module.exports = mongoose.model('Negronuser', negronuserSchema);