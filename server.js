// init project
const express = require('express');
const app = express();
const bodyparser = require("body-parser");
const flash = require('connect-flash');
const mongoose = require('mongoose');
const passport = require("passport");
const session = require("express-session");


// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));
app.set('view engine', 'pug');

// bodyparser middleware
app.use(bodyparser.urlencoded({ extended: false }));
app.use(bodyparser.json());

// express-session middleware
app.use(session({
  secret: process.env.SECRET,
  resave: true,
  saveUninitialized: true
}));

// express-messages middleware
app.use(flash());
app.use((req, res, next) => {
  res.locals.errors = req.flash("error");
  res.locals.successes = req.flash("success");
  next();
});

app.use(express.json());

// import passport-config file
require("./passport-config")(passport);

// passport middleware
app.use(passport.initialize());
app.use(passport.session());

const routes = require('./routes.js');
routes(app);

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
