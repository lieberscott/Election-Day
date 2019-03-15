const mongoose = require('mongoose');

const campaignSchema = mongoose.Schema({
  database: { type: String, required: true },
  public_name: { type: String, required: true },
  ward: { type: Number, required: true },
  no_of_precincts: { type: Number, default: 0 },
  candidate_first: { type: String, default: "" },
  candidate_last: { type: String, default: "" },
  precincts: [{
    number: { type: Number, default: 1 }, // 1
    total_votes: {type: Number, default: 0 }, // 342
    last_updated: { type: String, default: "" }, // total votes last_updated, manipulate a Date object to get this to be human readable
    updated_by: { type: String, default: "" }, // total votes updated by
    opponent_votes: { type: mongoose.Schema.Types.Mixed, default: {} } // Types.Mixed allows you to save an empty object as a default, also must includle { minimize: false } as second argument of schema (as seen below0
    // only will be reported once, at the end of the night
    /*
    opponent_votes: {
      "Matt Martin": 45,
      "Eileen Dordek": 39,
      "Jeff Jenkins": 14 
    }
    */
  }]
}, { minimize: false });

module.exports = mongoose.model('Campaign', campaignSchema);

/*
By default (in an effort to minimize data stored in MongoDB),
Mongoose will not save empty objects to your database.
You can override this behavior by setting the minimize flag
to false when you create your schema.
https://stackoverflow.com/questions/29188131/mongoose-set-default-as-empty-object
*/