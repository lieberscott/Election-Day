const mongoose = require('mongoose');

const campaignSchema = mongoose.Schema({
  database: { type: String, required: true },
  public_name: { type: String, required: true },
  ward: { type: Number, required: true },
  no_of_precincts: { type: Number, default: 0 },
  candidate_first: { type: String, default: "" },
  candidate_last: { type: String, default: "" },
  precincts: [{
    number: Number, // 1
    total_votes: Number, // 342
    last_updated: String, // total votes last_updated, manipulate a Date object to get this to be human readable
    updated_by: String, // total votes updated by
    opponent_votes: {} // only will be reported once, at the end of the night
    /*
    opponent_votes: {
      "Matt Martin": 45,
      "Eileen Dordek": 39,
      "Jeff Jenkins": 14 
    }
    */
  }]
})

module.exports = mongoose.model('campaign', campaignSchema);