const mongoose = require('mongoose');

const siawuserSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
    // match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
  },
  password: { type: String },
  phone: { type: String, default: "" },
  user_first: { type: String, default: "" },
  user_last: { type: String, default: "" },
  current_index: { type: Number, default: 0 }, // this identifies which index in the [campaigns] array is pointed to, gets updated upon signin
  campaigns: [
    {
      database: String,
      public_name: String,
      ward: { type: String, default: 0 },
      precinct: { type: String, default: 0 },
      no_of_precincts: { type: Number, default: 0 },
      candidate_first: { type: String, default: "" },
      candidate_last: { type: String, defult: "" },
      admin: { type: Boolean, required: true, default: false }, // needs to be changed for admins
      paid: { type: Boolean, required: true, default: false } // only for admins
    }
  ], // database names (for dropdown menu, if someone is signed up for more than one
  authenticated: { type: Boolean, default: false }
});

module.exports = mongoose.model('Siawuser', siawuserSchema);