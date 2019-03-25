const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const mongoose = require('mongoose');
const Siawuser = require('./models/siawuser.js');

mongoose.connect(process.env.DATABASE, { useNewUrlParser: true, useCreateIndex: true });
mongoose.Promise = global.Promise;

module.exports = (passport) => {
  // passport is smart enough to capture 'username' and 'password' from login page (must be named 'username' and 'password' on login page for passport to get them)
  // i'm calling them 'email' and 'pass' below because that's what they are, but they are just the user's inputs from the login page
  passport.use(new LocalStrategy((e_mail, pass, done) => {
    
    let email = e_mail.toLowerCase();
    
    let query = { email: email };
    
    Siawuser.findOne(query, (err, user) => {
      if (err) { console.log(err); }
      if (!user) {
        return done(null, false, { message: "No user found or password incorrect" });
      }
      
      bcrypt.compare(pass, user.password, (error, isMatch) => {
        if (error) { console.log(error); }
        else {
          if (isMatch) {
            return done(null, user);
          }
          else {
            return done(null, false, { message: "No user found or password incorrect" });
          }
        }
      });
    });
  }));
  
  passport.serializeUser((user, done) => {
    done(null, user._id)
  });
  
  passport.deserializeUser((id, done) => {
    Siawuser.findById(id, (err, user) => {
      done(err, user);
    });
  });

};