const mongoose = require('mongoose');

// keeping it basic for now
const userSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
    // match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
  },
  password: { type: String, required: true },
  ward: { type: Number, required: true },
  precinct: { type: Number, required: true }
});

module.exports = mongoose.model('User', userSchema);