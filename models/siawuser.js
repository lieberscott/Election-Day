const mongoose = require('mongoose');

const siawuserSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
    // match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
  },
  password: { type: String, default: "" },
  phone: { type: String, default: "" },
  user_first: { type: String, default: "" },
  user_last: { type: String, default: "" },
  ward: { type: Number, required: true },
  precinct: { type: Number, default: 0 },
  database: { type: String, default: "" },
  public_name: { type: String, default: "" },
  admin: { type: Boolean, required: true, default: false }, // needs to be changed for admins
  paid: { type: Boolean, required: true, default: false }, // only for admins
  authenticated: { type: Boolean, default: false },
  resetPassword: String,
  resetPasswordExpires: Date
});

module.exports = mongoose.model('Siawuser', siawuserSchema);