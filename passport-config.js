const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const mongoose = require('mongoose');
const Siawuser = require('./models/siawuser.js');

mongoose.connect(process.env.DATABASE, { useNewUrlParser: true, useCreateIndex: true });
mongoose.Promise = global.Promise;

module.exports = (passport) => {
  // passport is smart enough to capture 'username' and 'password' from login page (must be named 'username' and 'password' on login page for passport to get them)
  // i'm calling them 'email' and 'pass' below because that's what they are, but they are just the user's inputs from the login page
  passport.use(new LocalStrategy((email, pass, done) => {
    
    let query = { email: email };
    
    Siawuser.findOne(query, (err, user) => {
      if (err) { console.log(err); }
      if (!user) {
        console.log("no user found");
        return done(null, false, { message: "No user found" });
      }
      
      console.log("user found");
      bcrypt.compare(pass, user.password, (error, isMatch) => {
        if (error) { console.log(error); }
        else {
          if (isMatch) {
            console.log(user);
            return done(null, user);
          }
          else {
            return done(null, false, { message: "Wrong password" });
          }
        }
      });
    });
  }));
  
  passport.serializeUser((user, done) => {
    console.log("serializeUser called");
    console.log(user);
    done(null, user._id)
  });
  
  passport.deserializeUser((id, done) => {
    console.log("deserialize user called");
    Siawuser.findById(id, (err, user) => {
      done(err, user);
    });
  });
  
  
};