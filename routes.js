// libraries
const async = require("async");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { check, validationResult } = require('express-validator/check');
const fs = require("fs");
const jsonstream = require("JSONStream");
const path = require("path"); // native to Node (using?)
const passport = require("passport");
const mongoose = require('mongoose');
const mongo = require('mongodb').MongoClient;
const nodemailer = require("nodemailer");
const ObjectId = require('mongodb').ObjectID; // using?
const json2csvtransform = require('json2csv').Transform;
const randomstring = require("randomstring");
const Siawuser = require("./models/siawuser.js"); // admins and pollwatchers
const Campaign = require("./models/campaign.js");
const transport = nodemailer.createTransport({
  service: "Mailgun",
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Set your secret key: remember to change this to your live secret key in production
// See your keys here: https://dashboard.stripe.com/account/apikeys
let stripe = require("stripe")("sk_test_4eC39HqLyjWDarjtT1zdp7dc");

const multer = require("multer");
const csv = require("csvtojson");

const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // fileSize limit is set at 5MB
  fileFilter: (req, file, cb) => { path.extname(file.originalname) == ".csv" ? cb(null, true) : cb("Must be a .csv file") }
}).single("file");

let filename;


module.exports = (app, db) => {
  
  mongo.connect(process.env.DATABASE, { useNewUrlParser: true }, (err, client) => {
    if(err) { console.log('Database error: ' + err); }
    
    else {

      let db = client.db('freecodecamp2018');
      
      /*
      /
      /
      / Pages in which you don't need to be signed in
      /
      /login
      /logout
      /register
      /verify/:token/:email
      /requestreset
      /resetpassword/:token
      /delete (you do need to be signed in, but it's not specific to admin or pollwatcher). doing check within route, not with middleware
      /contact
      / vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
      /
      /
      */

      app.get('/', /* mainpageMiddleware, */ (req, res) => {
        res.redirect("/login");
        
      });
      
      app.get('/login', loginpageMiddleware, (req, res) => {
        res.render(process.cwd() + "/views/pug/login.pug");
      });

      app.post('/login', (req, res, next) => {
        passport.authenticate("local", {
          successRedirect: "/login",
          failureRedirect: "/login",
          failureFlash: true
        })(req, res, next);
      });
      
      
      app.get("/logout", (req, res) => {
        req.logout();
        res.redirect("/login");
      });
      
      app.get("/register", (req, res) => {
        res.render(process.cwd() + "/views/pug/register.pug");
      });
      
      app.post("/register", [
        check('email').isEmail().withMessage("Invalid email"),
        check('password').isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
        check("password").custom((val, {req, loc, path}) => {
          if (val !== req.body.password2) {
            throw new Error("Passwords don't match");
          }
          else {
            return val;
          }
        }),
        check("ward").isInt().withMessage("Ward must be a number"),
        check("precincts").isInt().withMessage("Precincts must be a number"),
        check("candidatefirst").isString(),
        check("candidatelast").isString(),
        check("userfirst").isString(),
        check("userlast").isString()
        ],
        checkValidationResult,
        (req, res) => {
        
        let email = req.body.email.toLowerCase();
        let pass = req.body.password;
        let pass2 = req.body.password2;
        let ward = req.body.ward;
        let no_of_precincts = req.body.precincts;
        let candidate_first = req.body.candidatefirst;
        let candidate_last = req.body.candidatelast;
        let user_first = req.body.userfirst;
        let user_last = req.body.userlast;
        
        let database = candidate_last + "-" + Date.now();        
        let public_name = candidate_last + " for " + ward;
        
         // check if email is already registered
        Siawuser.findOne({ email })
        .exec()
        .then((user) => {
          if (user) {
            req.flash("error", "Email already exists.");
            res.render(process.cwd() + "/views/pug/register", { errors: req.flash("error") });
          }
          
          else { // FIRST ELSE: IT IS A NEW USER
            bcrypt.genSalt(10, (err, salt) => {
              if (err) {
                console.log(err);
                req.flash("error", "Registration error. Please try again.");
                res.render(process.cwd() + "/views/pug/register", { errors: req.flash("error") });
              }

              else { // SECOND ELSE: PASSWORD SALTED
                bcrypt.hash(pass, salt, (error, hash) => {
                  if (error) {
                    console.log(error);
                    req.flash("error", "Registration error. Please try again.");
                    res.render(process.cwd() + "/views/pug/register", { errors: req.flash("error") });
                  }
                  else { // THIRD ELSE: PASSWORD HASHED
                    
                    let verification_token = randomstring.generate();
                      
                    const user = new Siawuser({
                      email,
                      password: hash,
                      user_first,
                      user_last,
                      ward,
                      database,
                      public_name,
                      admin: true,
                      paid: false,
                      authenticated: false,
                      verification_token
                    });
                    user.save()
                    .then(async (result) => {
                      
                      // send verification email
                      const html = '<p>Hi ' + user_first + ',</p><p>Thank you for signing up with Turnout the Vote!</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + verification_token + '/' + email + '">https://election-day3.glitch.me/verify/' + verification_token + '/' + email + '</a></p><p> Have a pleasant day!</p>';
                      try {
                        await sendEmail("robot@voterturnout.com", email, "Please verify your account", html);
                      }
                      catch (email_err) {
                        console.log(email_err);
                      }
                      
                      req.login(user, (login_err) => {
                        if (login_err) {
                          console.log(error);
                          req.flash("error", "Registration successful, but login error. Please log in below.");
                          res.redirect("/login");
                        }
                        else { // FOURTH ELSE: USER CREATED, AND ABLE TO LOG IN
                          
                          let precincts = [];
                          
                          for (let i = 0; i < no_of_precincts; i++) {
                            let obj = {};
                            
                            obj.number = i + 1;
                            obj.total_votes = 0;
                            obj.last_updated = "";
                            obj.updated_by = "";
                            obj.candidate_votes = {
                              cand_1: 0,
                              cand_2: 0
                            };
                            
                            precincts.push(obj);
                          }
                          
                          let campaign = {
                            database,
                            public_name,
                            ward,
                            no_of_precincts,
                            candidate_first,
                            candidate_last,
                            precincts
                          }

                          
                          Campaign.create(campaign, (campaigns_error, doc) => {
                            if (campaigns_error) {
                              console.log(campaigns_error);
                              req.flash("error", "Error: Unable to create campaign. Please contact Election Day support.");
                              res.redirect("/register");
                            }
                            else { // FIFTH ELSE: CAMPAIGN INSERTED INTO CAMPAIGNS DATABASE
                              
                              db.collection(database).createIndex( { "van_id": 1 }, { unique: true } );
                              
                              req.flash("success", "Registration complete! Please verfiy your account from your email address, and enter payment information below to access the full site.");
                              res.redirect("/payment"); // add note about verifying email address (this on-screen message goes to admin though, not pollwatcher)
                            }
                          })
                        }
                      })
                    })
                    .catch((catch_err) => {
                      console.log(catch_err);
                      req.flash("error", "There was an error with your registration. Please contact support for help.");
                      res.render("/register", { errors: req.flash("error") });
                    });
                  };
                })
              }
            });
          }
        });
      });
      
      
      app.get("/verify/:token/:email", (req, res) => {
        
        let clicked_token = req.params.token; // user "entered" token
        let email = req.params.email;
        
        Siawuser.findOne({ email }, (err, user) => {
          if (err) {
            req.flash("error", "Database error. Please try again.");
            res.render(process.cwd() + "/views/pug/verified", { errors: req.flash("error") });
          }
          else { 
            
            if (user) {
              let verification_token = user.verification_token;

                if (verification_token == clicked_token) { // token matches
                  user.authenticated = true;
                  user.save()
                  .then(() => {
                    req.flash("success", "Success! You are now verified.");
                    res.render(process.cwd() + "/views/pug/verified", { successes: req.flash("success") });
                  })
                  .catch((error) => {
                    console.log(error);
                    req.flash("error", "Error: Unable to verify account. Please try again.");
                    res.redirect("/login");
                  });
                }
                else { // token doesn't match
                  req.flash("error", "Verification failed. No user found or token invalid.");
                  res.render(process.cwd() + "/views/pug/verified", { errors: req.flash("error") });
                }
              }
            
            else { // no user found
              req.flash("error", "Verification failed. No user found or token invalid.");
              res.render(process.cwd() + "/views/pug/verified", { errors: req.flash("error") });
            }
          }
        });
      });
      
      
      app.get("/requestreset", (req, res) => {
        res.render(process.cwd() + "/views/pug/requestreset");
      });
      
      app.post("/requestreset", (req, res) => {
        let token = randomstring.generate();
        let email = req.body.email.toLowerCase();
        
        Siawuser.findOne({ email }, (err, user) => {
          if (err) {
            console.log(err);
            req.flash("error", err);
            return res.redirect("/requestreset");
          }

          else { // User found
            user.resetPassword = token;
            user.save()
            .then(async () => {
              let user_first = user.user_first;

              const html = '<p>Hi ' + user_first + ',</p><p>A password reset was recently requested for this email address</p><p>To change your password, use the following link:</p><p><a href="https://election-day3.glitch.me/resetpassword/' + token + '">https://election-day3.glitch.me/resetpassword/' + token + '"</a>.</p><p>If you didn\'t make this request, you can ignore this message and your password will remain unchanged.</p><p>Have a pleasant day!</p>';
              
              try {
                await sendEmail("robot@voterturnout.com", email, "Your password reset request", html);

                req.flash("success", "Success! An email has been sent to the email address you provided. Click the link to reset your password.");
                res.redirect("/requestreset");
              }
              catch (email_err) {
                console.log(email_err);
                req.flash("error", "Error: Unable to send reset email. Please try again.");
                res.redirect("/requestreset");
              }
            })
            .catch((error) => {
              console.log(error);
              req.flash("error", "Error: Unable to generate new token for verification. Please try again.");
              res.redirect("/login");
            });
          }
        });

      });
      
      app.get("/resetpassword/:token", (req, res) => {
        
        let token = req.params.token;
        
        Siawuser.findOne({ resetPassword: token, resetPasswordExpires: { $gte: Date.now() } }, (err, user) => {
          if (err) {
            console.log(err);
            req.flash("error", "Password reset is invalid or has expired.");
            res.render(process.cwd() + "/views/pug/resetpassword", { errors: [{ msg: "Password reset is invalid or has expired." }] });
          }
          
          else {
            res.render(process.cwd() + "/views/pug/resetpassword", { token });
          }
        });        
      });
      
      app.post("/resetpassword/:token", [
        check('password').isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
        check("confirmpassword").custom((val, {req, loc, path}) => {
          if (val !== req.body.password) {
            throw new Error("Passwords don't match");
          }
          else {
            return val;
          }
        })
        ], checkValidationResult, (req, res) => {
        
        let token = req.params.token;
        let pass = req.body.password;
        
        Siawuser.findOne({ resetPassword: token }, (err, user) => {
          if (err) {
            console.log(err);
            req.flash("error", "Password reset is invalid or has expired.");
            res.redirect("/login");
          }
          
          else { // FIRST ELSE: USER FOUND
            bcrypt.genSalt(10, (err, salt) => {
              if (err) {
                console.log(err);
                req.flash("error", "Registration error. Please try again.");
                res.render(process.cwd() + "/views/pug/register", { errors: req.flash("error") });
              }

              else { // SECOND ELSE: PASSWORD SALTED
                bcrypt.hash(pass, salt, (error, hash) => {
                  if (error) {
                    console.log(error);
                    req.flash("error", "Registration error: Please try again.");
                    res.render(process.cwd() + "/views/pug/register", { errors: req.flash("error") });
                  }
                  else { // THIRD ELSE: PASSWORD HASHED
                    user.password = hash;
                    user.save()
                    .then(() => {
                      
                      req.login(user, async (login_err) => {
                        if (login_err) {
                          console.log(login_err);
                          req.flash("error", "Password changed, but unable to log in. Please try logging in below.");
                          res.redirect("/login");
                        }

                        else { // FOURTH ELSE: USER SAVED AND LOGGING IN

                          req.flash("success", "Success! Password changed.");
                          res.redirect("/admin");
                        }

                      });
                    })
                    .catch((error) => {
                      console.log(error);
                      req.flash("error", "Error: Unable to reset password. Please try again.");
                      req.redirect("/admin");
                    });
                  }        
                })
              }
            })
          }
        });        
      });
      
      
      app.get("/pollwatcherconfirm", (req, res) => {
        res.render(process.cwd() + "/views/pug/pollwatcherconfirm");
      });
      
      app.post("/pollwatcherconfirm", (req, res) => {
        let email = req.body.email.toLowerCase();
        let verification_token = req.body.token;
        let pass = req.body.password;
        let confirmpassword = req.body.confirmpassword;

        
        Siawuser.findOne({ email, verification_token }, (err, user) => {
          if (err) {
            console.log(err);
            req.flash("error", "Token is invalid");
            res.render(process.cwd() + "/views/pug/pollwatcherconfirm", { errors: req.flash("error") });
          }
          
          else { // FIRST ELSE: NO DATABASE ERROR
            bcrypt.genSalt(10, (err, salt) => {
              if (err) {
                console.log(err);
                req.flash("error", "Registration error: Please try again.");
                res.render(process.cwd() + "/views/pug/pollwatcherconfirm", { errors: req.flash("error") });
              }

              else { // SECOND ELSE: PASSWORD SALTED
                bcrypt.hash(pass, salt, (error, hash) => {
                  if (error) {
                    console.log(error);
                    req.flash("error", "Registration error: Please try again.");
                    res.render(process.cwd() + "/views/pug/pollwatcherconfirm", { errors: req.flash("error") });
                  }
                  else { // THIRD ELSE: PASSWORD HASHED
                    
                    if (user) {
                      user.password = hash;
                      user.authenticated = true;
                      user.save()
                      .then(() => {
                        req.login(user, (login_err) => {
                          if (login_err) {
                            console.log(login_err);
                            req.flash("error", "Authentication successful, but unable to log in. Please try logging in below.");
                            res.redirect("/login");
                          }

                          else { // FOURTH ELSE: USER SAVED AND LOGGING IN

                            let admin = req.user.admin;
                            req.flash("success", "Success! You are registered and authenticated.");
                            res.redirect("/login");
                          }

                        });
                      })
                      .catch((error) => {
                        console.log(error);
                        req.flash("error", "Error: Unable to confirm account. Please try again.");
                        req.redirect("/pollwatcherconfirm");
                      });
                    }
                    else {
                      req.flash("error", "Error: No user found");
                      res.redirect("/pollwatcherconfirm");
                    }
                  }
                })
              }
            })
          }
        })
      });
      
      app.post("/deleteaccount", (req, res) => {
        
        if (req.user) {
          let email = req.user.email;

          Siawuser.findOneAndRemove({ email }, (err, doc) => {
            if (err) {
              req.flash("error", "Error: Please try again.");
              res.redirect("/logout");
            }

            else {
              req.flash("success", "Your account has been deleted");
              res.redirect("/logout");
            }
          })
        }
        
        else {
          req.flash("Error: You must be signed in to access this route");
          res.redirect("/login");
        }
      });
      
      app.get("/contact", (req, res) => {
        res.render(process.cwd() + "/views/pug/contact");
      });

      
      
      /*
      /
      / ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      / Pages in which you don't need to be signed in
      /
      /
      / Pollwatcher pages
      /
      /choice
      /watch
      /voted
      /report
      / vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
      /
      */

      
      app.get("/choice", pollwatcherProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        res.render(process.cwd() + "/views/pug/choice.pug", { admin });
      });
      
      app.get("/watch", pollwatcherProtectedMiddleware, (req, res) => { // pollwatcher watching their location
        
        let admin = req.user.admin;
        
        let database = req.user.database;
        let precinct = req.user.precinct.toString();
        let ward = req.user.ward.toString();

        db.collection(database).find( { ward, precinct, voted: "0" }, { sort: { lastname: 1 } }, (err, cursor) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error retrieving data: Please try again");
            res.redirect("/choice");
          }
          else {
            let arr = [];
            cursor.toArray()
            .then((docs) => {
              arr = docs;
              res.render(process.cwd() + '/views/pug/watch', { admin, arr });
            })
            .catch((error) => {
              console.log(error);
              req.flash("error", "Error retrieving records: Please try again");
              res.redirect("/choice");
            });
          }
        });
      });
      
      app.post("/voted", pollwatcherProtectedMiddleware, (req, res) => {
        
        let database = req.user.database;
        
        let id = ObjectId(req.body.clickedId);
        let pollwatcher = req.body.pollwatcher;
        let tempdate= new Date().toString().split("GMT+0000 (UTC)")[0].split(" 2019");
        let d = tempdate[1].split(":");
        let time = Number(d[0]);
        let t = (time % 12) - 5;
        if (time == 0) { t = 5 }
        else if (time == -1) { t = 4 }
        else if (time == -2) { t = 3 }
        else if (time == -3) { t = 2 }
        else if (time == -4) { t = 1 }
        else if (time == -5) { t = 12 }
        let date = tempdate[0] + " " + t + ":" + d[1] + ":" + d[2];
        
        db.collection(database).findOneAndUpdate({ _id: id }, { $set: { voted: "1", enteredBy: pollwatcher, date } }, (err, doc) => {
          if (err) {
            console.log(err);
            req.flash("error", "Unable to count voter. Please try again.");
            req.redirect("/choice");
          }
          else {
            console.log("success");
          }
        })
      });
      
      
      app.get("/report", pollwatcherProtectedMiddleware, (req, res) => { // pollwatcher page for reporting numbers
        let precinct = req.user.precinct;
        let database = req.user.database;

        db.collection("campaigns").findOne({ database }, (err, doc) => {
          if (err) {
            console.log(err);
            req.flash("error", "Could not retrieve data. Please try again.");
            res.render(process.cwd() + "/views/pug/report");
          }

          else {
            res.render(process.cwd() + "/views/pug/report", { doc, precinct });
          }

        })
      });
      
      app.post("/report", pollwatcherProtectedMiddleware, (req, res) => { // pollwatcher page for reporting numbers
        
        let precinct = req.user.precinct;
        let database = req.user.database;
        let candidate_votes = req.body;
        let total_votes = req.body.total;
        delete candidate_votes.total;
        
        let candidates = Object.keys(candidate_votes);
        let len = candidates.length;
        
        for (let i = 0; i < len; i++) {
          let candidate = candidates[i];
          let str = candidate_votes[candidate];
          let num = parseInt(str);
          candidate_votes[candidate] = num;
        }
        
        let tempdate= new Date().toString().split("GMT+0000 (UTC)")[0].split(" 2019");
        let d = tempdate[1].split(":");
        let time = Number(d[0]);
        let t = (time % 12) - 5;
        if (time == 0) { t = 5 }
        else if (time == -1) { t = 4 }
        else if (time == -2) { t = 3 }
        else if (time == -3) { t = 2 }
        else if (time == -4) { t = 1 }
        else if (time == -5) { t = 12 }
        let date = tempdate[0] + " " + t + ":" + d[1] + ":" + d[2];
        let user_first = req.user.user_first;
        let user_last = req.user.user_last;
        
        let last_updated = date + " by " + user_first + " " + user_last;
                
        // update database
        Campaign.findOne({ database })
        .exec()
        .then((doc) => {
          doc.precincts[precinct - 1].candidate_votes = candidate_votes; // <- HACKY. USING [precinct - 1] TO IDENTIFY THE ARRAY INDEX, RATHER THAN CAPTURING THE OBJECT FOR WHICH PRECINCT = 1. PRECINCT 1 WILL BE AT INDEX 0, PRECINCT 2 AT INDEX 1, AND SO ON.
          doc.precincts[precinct - 1].total_votes = total_votes; // <- HACKY
          doc.precincts[precinct - 1].last_updated = last_updated; // <- HACKY
          doc.save()
          .then(() => {
            res.redirect("/report");
          })
          .catch((error) => {
            console.log(error);
            req.flash("error", "Unable to report numbers. Please try again.");
            res.redirect("/choice");
          });
        })
        .catch((err) => {
          console.log(err);
          req.flash("error", "Unable to report numbers. Please try again.");
          res.redirect("/choice");
        });
        
      });
      
      app.get("/pollwatcherconfigure", pollwatcherProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        res.render(process.cwd() + "/views/pug/pollwatcherconfigure", { admin });
      });
      
      
      /*
      /
      / ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      / Pollwatcher pages
      /
      /
      / Admin pages
      / vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
      /
      */
      
      
      app.get("/payment", adminMiddleware, (req, res) => {
        let admin = req.user.admin;
        let paid = req.user.paid;
        let authenticated = req.user.authenticated;
        res.render(process.cwd() + '/views/pug/payment', { admin, paid, authenticated });
      });
      
      
      app.get("/admin", adminProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        res.render(process.cwd() + '/views/pug/admin', { admin });
      });
      
      
      app.get("/upload", adminProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        
        const directory = 'public/uploads';

        fs.readdir(directory, (err, files) => {
          if (err) {
            console.log(err);
            res.render(process.cwd() + "/views/pug/upload.pug", { admin });
          }

          for (const file of files) {
            fs.unlink(path.join(directory, file), err => {
              if (err) {
                console.log(err);
                res.render(process.cwd() + "/views/pug/upload.pug", { admin });
              }
            });
          }
          res.render(process.cwd() + "/views/pug/upload.pug", { admin });
        });
        
      });
      
      app.post("/addfile", adminProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        upload(req, res, (err) => {
          if (err) {
            console.log(err);
            req.flash("error", err);
            res.render(process.cwd() + "/views/pug/upload.pug", { admin, errors: req.flash("error") });
          }
          else {
            if (req.file == undefined) {
              req.flash("error", "No file selected.");
              res.redirect("/upload");
            }
            else {
              const csvFilePath = "public/uploads/" + req.file.filename;
              filename = req.file.filename;
              csv()
              .fromFile(csvFilePath)
              .then((jsonObj)=> {
                let obj = jsonObj.slice(0, 10);
                res.render(process.cwd() + "/views/pug/upload.pug", { admin, file: obj });
              });
            }
          }
        });
      });
      
      app.post("/addtomongo", adminProtectedMiddleware, (req, res) => {

        let opt = req.body.radios; // "addto" or "override"
        let database = req.user.database;

        const csvFilePath = "public/uploads/" + filename;
        csv()
        .fromFile(csvFilePath)
        .then((jsonObj)=> {

          if (opt == "override") {
            db.collection(database).remove({}, (err, removed) => {
              if (err) {
                req.flash("error", "Unknown error: Please try again.");
                res.redirect("/upload");
              }
              else {
                db.collection(database).insertMany(jsonObj, (err, doc) => {
                  if (err) {
                    req.flash("error", "Error: Previous list data removed, but unable to add new items. Please try again.");
                    res.redirect("/upload");
                  }
                  else {
                    req.flash("success", "Success! New data uploaded");
                    res.redirect("/upload");
                  }
                });
              }
            });
          }

          else if (opt == "addto") {
            db.collection(database).insertMany(jsonObj, { ordered: false }, (err, doc) => {
              if (err) {
                if (err.result.result.ok >= 1) { // insertmany had conflicts with van_id, but some items were new
                  req.flash("success", "Success! File uploaded.");
                  req.flash("success", "Note: Your file contained records that were already in your database. These records were not double-added, while unique records were added successfully.");
                  res.redirect("/upload");
                }
                else { // insertmany had conflicts with van_id, and none of the items were new
                  req.flash("error", "Documents failed to upload. Please try again.");
                  res.redirect("/upload");
                }
              }
              else {
                req.flash("success", "Success! Documents added.");
                res.redirect("/upload");
              }
            });
          }
        })
      });
      
      app.post("/stripe", (req, res) => {

        // Token is created using Checkout or Elements!
        // Get the payment token ID submitted by the form:
        const token = req.body.stripeToken; // Using Express

        (async () => {
          const charge = await stripe.charges.create({
            amount: 999,
            currency: 'usd',
            description: 'Example charge',
            source: token,
          });
          
          let id = req.user._id;
                              
          if (charge.paid) {
            db.collection("siawusers").updateOne({ _id: id }, { $set: { paid: true } }, (err, doc) => {
              if (err) {
                console.log(err)
                req.flash("error", err);
                res.redirect("/payment");
              }
              else {
                req.flash("success", "Thank you for your payment. You are now free to use the Election Day platform.");
                res.redirect("/admin");
              }
            });
          }
          
          else {
            req.flash("error", "Payment did not complete. Please try again.");
            res.redirect("/payment");
          }
        })();
      });
      
      
      app.get("/electionresults", adminProtectedMiddleware, (req, res) => {
        
        let database = req.user.database;
        let admin = req.user.admin;
        
        db.collection('campaigns').findOne({ database }, (err, doc) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error: Unable to get election results.");
            res.redirect("/admin");
          }
          else {
            let obj = {};
            obj = doc;
            res.render(process.cwd() + '/views/pug/electionresults', { obj, admin });
          }
        })
      });
      
      
      app.get("/precincts", adminProtectedMiddleware, (req, res) => {
        
        let database = req.user.database;
        let admin = req.user.admin;
        
        let x = db.collection(database).aggregate([
          { $match : { } },
          // sorts by precinct, and gets number who voted and who haven't voted
          { $group : { _id: "$precinct", voted: { $sum: { $cond: [ { $eq: ["$voted", "1"] }, 1, 0 ] } }, notvoted: { $sum: { $cond: [{ $eq: ["$voted", "1"] }, 0, 1 ] } } } },
          { $sort: { _id: 1 } }
        ], (err, cursor) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error: Unable to fetch data. Please try again.");
            req.redirect("/admin");
          }
          else {
            let arr;
            cursor.toArray()
            .then((docs) => {
              arr = docs;
              res.render(process.cwd() + '/views/pug/precincts', { arr, admin });
            });
          }
        });

      });
      
      app.get("/pollwatchers", adminProtectedMiddleware, (req, res) => {
        // get pollwatcher info from database
        let database = req.user.database;
        let admin = req.user.admin;
        
        Siawuser.find({ database, admin: false })
        .sort({ precinct: 1 } )
        .exec((err, docs) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error: Unable to fetch the data. Please try again.");
            res.redirect("/admin");
          }
          else {
            res.render(process.cwd() + "/views/pug/pollwatchers", { arr: docs, admin });
          }
        });
      });
      
      
      app.post("/pollwatchers", adminProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        // change the precinct/phone number/email/name on a pollwatcher
        let arr = [];     
        res.render(process.cwd() + "/views/pug/pollwatchers", { arr, admin });
      });
      
      app.get("/addpollwatcher", adminProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        res.render(process.cwd() + "/views/pug/addpollwatcher", { admin });
      });
      
      
      app.post("/addpollwatcher", adminProtectedMiddleware, [
        check("email").isEmail().withMessage("Invalid email"),
        check("firstname").not().isEmpty().withMessage("First name must be included"),
        check("lastname").not().isEmpty().withMessage("Last name must be included")
        ], checkValidationResult, (req, res) => {
        
        let admin = req.user.admin;
        
        // add pollwatcher to database, add verification to database, and send email to pollwatcher
        
        // verification variables
        const token = randomstring.generate();
        
        // pollwatcher variables
        const email = req.body.email.toLowerCase();
        const phone = req.body.phone || "";
        const user_first = req.body.firstname || "";
        const user_last = req.body.lastname || "";
        const precinct = req.body.precinct || "";
        
        // campaign variables
        const database = req.user.database;
        const public_name = req.user.public_name;
        const ward = req.user.ward;
        const no_of_precincts = req.user.no_of_precincts;
        const candidate_first = req.user.candidate_first;
        const candidate_last = req.user.candidate_last;
        
        let user = new Siawuser({
          email,
          phone,
          user_first,
          user_last,
          ward,
          precinct,
          database,
          public_name,
          verification_token: token,
          admin: false,
          paid: false,
          authenticated: false
        });
        
        
        Siawuser.create(user, async (err, doc) => {
          
          if (err) {
            req.flash("error", "User already signed up for another campaign. If user is not in your campaign, and you want them for your campaign, they must delete their current account. You can then invite them to your campaign.");
            res.render(process.cwd() + "/views/pug/addpollwatcher", { admin, errors: req.flash("error") });
          }
          
          else { // no errors
            
            const html = '<p>Hi ' + user_first + ',</p><p>You have been requested to join the ' + public_name + ' campaign.</p><p>Your token is ' + token + '</p><p>Use the following link to create an account and complete your registration:</p><p><a href="https://election-day3.glitch.me/pollwatcherconfirm">https://election-day3.glitch.me/pollwatcherconfirm</a></p><p>Have a pleasant day!</p>';
            
            try {
              await sendEmail("robot@voterturnout.com", email, "Please verify your account", html);
              req.flash("success", "User added! Please have user authenticate their account and set their password.");
              res.render(process.cwd() + "/views/pug/addpollwatcher", { admin, successes: req.flash("success") });
            }
            catch (email_err) {
              console.log(email_err);
              req.flash("error", "Error: Unable to send verification email to user. Please delete them under your pollwatcher tab, and then re-invite them.");
              req.redirect("/admin");
              
            }
            
          }
        });

      });
      
      app.post("/deletepollwatcher", adminProtectedMiddleware, (req, res) => {
        let id = req.body.clickedId;
        let database = req.user.database; // <- necessary?
        
        Siawuser.findOneAndRemove({ _id: id }, (err, doc) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error: Unable to delete pollwatcher. Please try again.");
            res.redirect("/admin");
          }
          else {
            res.json({ success: "success" });
          }
        });
      });
      
      
      app.post("/changeprecinct/:userid", adminProtectedMiddleware, (req, res) => {
        let precinct = req.body.precinct;
        let id = req.params.userid;
        
        Siawuser.findOneAndUpdate({ _id: id }, { precinct }, { new: true }, (err, doc) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error: Unable to change precinct. Please try again.");
            res.redirect("/pollwatchers");
          }
          else {
            doc.precinct = precinct;
            doc.save()
            .then(() => {
              req.flash("success", "Success! Pollwatcher precinct changed.");
              res.redirect("/pollwatchers");
            })
            .catch((error) => {
              console.log(error);
              req.flash("error", "Error: Unable to change precinct. Please try again.");
              res.redirect("/pollwatchers");
            });
          }
        });
      });
      
      app.post("/changephone/:userid", adminProtectedMiddleware, (req, res) => {
        let phone = req.body.phone;
        let id = req.params.userid;
        
        Siawuser.findOneAndUpdate({ _id: id }, { phone }, { new: true }, (err, doc) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error: Unable to change phone. Please try again.");
            res.redirect("/pollwatchers");
          }
          else {
            doc.phone = phone;
            doc.save()
            .then(() => {
              req.flash("success", "Success! Pollwatcher phone changed.");
              res.redirect("/pollwatchers");
            })
            .catch((error) => {
              console.log(error);
              req.flash("error", "Error: Unable to change phone. Please try again.");
              res.redirect("/pollwatchers");
            });
          }
        });
      });
      
      
      app.get("/view/:precinct", adminProtectedMiddleware, (req, res) => {
        
        // convert param from string into a number
        let precinct = req.params.precinct;
        let database = req.user.database;
        let admin = req.user.admin;
        
        db.collection(database).find({ precinct }, { sort: { voted: 1, date: -1 } }, (err, cursor) => {
          if (err) {
            req.flash("error", "Unable to fetch data. Please try again.");
            res.redirect("/admin");
            console.log(err);
          }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                arr = docs;
              res.render(process.cwd() + '/views/pug/view', { admin, arr });
            });
          }
        })
      });
      
      
      app.get("/configure", adminProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        res.render(process.cwd() + "/views/pug/configure", { admin });
      });
      
      
      app.post("/addcandidates", adminProtectedMiddleware, [
        check("candidates").custom((val) => {
          
          let len = val.split(",").length - 1;
          
          if (len >= 10) {
            throw new Error("Our application only supports 10 candidates max at this time.");
          }
          else {
            return val;
          }
        })
        ], checkValidationResult, (req, res) => {
        
        let database = req.user.database;
        let admin = req.user.admin;
        
        let candidates_string = req.body.candidates; // "Dwight D. Eisenhower, John F. Kennedy, Woodrow Wilson"
        let regex = /,\s*/g;
        let candidates = candidates_string.split(regex);
        let len = candidates.length;
        let obj = {};
        for (let i = 0; i < len; i++) {
          let candidate = candidates[i] // "Dwight D. Eisenhower"
          obj[candidate] = 0; // "Dwight D. Eisenhower": 0
        }
        
        Campaign.findOneAndUpdate( { database }, { $set: { "precincts.$[elem].candidate_votes": obj } }, { "arrayFilters": [{ "elem.number": { $gte: 1 } }], "multi": true }, (err, doc) => {
          if (err) {
            console.log(err);
            req.flash("error", "Error: Could not update precincts at this time. Please try again.");
            res.render(process.cwd() + "/views/pug/configure", { admin, errors: req.flash("error") });
          }
          
          else {
            req.flash("success", "Database successfully updated");
            res.render(process.cwd() + "/views/pug/configure", { admin, successes: req.flash("success") });
          }
        });
      });
      
      
      app.post("/changeprecincts", adminProtectedMiddleware, (req, res) => { // Change number of precincts in campagin
        let database = req.user.database;
        let new_no_of_precincts = parseInt(req.body.precincts);

        Campaign.findOne({ database })
        .exec()
        .then((doc) => {
          // Step 1: Check if user added or subtracted precincts
          // Step 2: If subtracted, pop off the difference from the document array
          // Step 3: If added, copy the first precinct object in the campaign, create a loop so you change the precinct_number to the old total number of precincts + 1, push into array. Repeat until you reach the new total number of precincts

          let difference = doc.no_of_precincts - new_no_of_precincts; // will be positive or negative
          let precincts = doc.precincts; // Array of objects
          let len = precincts.length; // will be 1 by default, or some larger positive number if user specified so during registration

          doc.no_of_precincts = new_no_of_precincts;

          if (difference > 0) { // admin lowered the number of precincts, so need to remove them from Mongo doc
            for (let i = 0; i < difference; i++) {
              doc.precincts.pop();
            }
            doc.save()
            .then(() => {
              req.flash("success", "Precincts successfully updated.");
              res.render(process.cwd() + "/views/pug/configure", { successes: req.flash("success") });
            })
            .catch((err) => {
              console.log(err);
              req.flash("error", "Error: Unable to change the number of precincts. Please try again.");
              res.redirect("/configure");
            });

          }

          else if (difference < 0) { // admin increased the number of precincts, so need to add them

            let obj = doc.precincts[0];

            for (let i = 0; i > difference; i--) {
              len++; // increase last precinct added by one, so if user previously identified 40 precincts, this number is now 41
              obj.number = len; // 41st precinct
              doc.precincts.push(obj); // push 41st precinct object into precincts array
            }
            
            doc.save()
            .then(() => {
              req.flash("success", "Success! Precincts successfully updated.");
              res.render(process.cwd() + "/views/pug/configure", { successes: req.flash("success") });
            })
            .catch((err) => {
              console.log(err);
              req.flash("error", "Error: Unable to change the number of precincts. Please try again.");
              res.redirect("/configure");
            });
          }

          else { // difference is 0 (they entered same number as before), or they entered a non-number
            req.flash("error", "Error: Same number of precincts as already on file, or invalid entry.");
            res.redirect("/configure");
          }
        })
        .catch((err) => {
          console.log(err);
          req.flash("error", "Error: Unable to change precincts. Please try again.");
          res.render("/views/pug/configure", { errors: req.flash("error") });
        })
      })

      
      app.post("/resendverification", adminMiddleware, (req, res) => { // resend verification button at /payment page
        let email = req.user.email;
        let user_first = req.user.user_first;
        let verification_token = randomstring.generate();
        
        Siawuser.findOne({ email })
        .exec()
        .then(async (user) => {
          user.verification_token = verification_token;
          user.save();
          
          const html = '<p>Hi ' + user_first + ',</p><p>A request was made to resend a verification token for your account.</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + verification_token + '/' + email + '">https://election-day3.glitch.me/verify/' + verification_token + '/' + email + '</a></p><p> Have a pleasant day!</p>';
          
          try {
            await sendEmail("robot@voterturnout.com", email, "Please verify your account", html);
            req.flash("success", "Email sent!");
            res.redirect("/payment");
          }
          catch (email_err) {
            req.flash("error", "Error: Could not send verification email. Please click 'Send verification' to try again.");
            res.redirect("/payment");
          }

        })
        .catch((err) => {
          console.log(err);
          req.flash("error", "An error ocurred. Please try again.");
          res.redirect("/payment");
        });
      });
      
      
      app.post("/export", adminProtectedMiddleware, (req, res) => {
        let database = req.user.database;
        
        // set up variables for piping new data using jsonstream module and json2csv module
        let date = Date.now();
        const directory = "public/uploads";
        const file = "voterdata" + date + ".csv";
        const output = fs.createWriteStream(directory + "/" + file, { encoding: 'utf8' });
        const json2csv = new json2csvtransform();
        
        
        db.collection(database).find({}, (err, cursor) => {
          
          if (err) {
            console.log(err);
            req.flash("error", err);
            res.redirect("/configure");
          }
          
          else {
            try {
              // stream from the cursor (from Mongo), then stringify using jsonstream, then pipe to json2csv, then pipe to the output file
              let stream = cursor.stream().pipe(jsonstream.stringify()).pipe(json2csv).pipe(output);
              // download locally when piping is finished
              stream.on("finish", () => {
                res.download(directory + "/" + file, (download_err) => {
                  // delete the file
                  fs.unlink(path.join(directory, file));
                });
              });
              
            } catch (stream_err) {
              console.error(stream_err);
              req.flash("error", stream_err);
              res.redirect("/configure");
            }
          }
        
        });
      });
      
      app.get("/howto", adminProtectedMiddleware, (req, res) => {
        let admin = req.user.admin;
        res.render(process.cwd() + "/views/pug/howto", { admin });
      });
      
      app.get('*', (req, res) => {
        res.send("The route was not found. Please go back to the homepage and try again.", 404);
      });
      
      
      // app.get("/upload", (req, res) => {
      //   db.collection('siaw').insertMany([], (err, doc) => {
      //     if (err) { console.log(err) }
      //     else {
      //       console.log("success!");
      //       res.render(process.cwd() + "/views/pug/login.pug");
      //     }
      //   })
      // });
    }
  })
}

// only for /login page (if person is logged in, it will redirect to main page rather than render login page)
const loginpageMiddleware = (req, res, next) => {
  if (req.isAuthenticated() && req.user.admin) {
    res.redirect("/admin");
  }
  
  else if (req.isAuthenticated() && !req.user.admin) {
    res.redirect("/choice");
  }
  else {
    next();
  }
}

// middleware for admin pages
const adminProtectedMiddleware = (req, res, next) => {
  
  if (req.user) {
    if (req.user.paid && req.user.authenticated) {
      next();
    }
    else {
      res.redirect("/payment");
    }
  }
  else {
    res.redirect("/login");
  }
}

// middleware for pollwatcher pages
const pollwatcherProtectedMiddleware = (req, res, next) => {
  
  if (req.isAuthenticated()) {
    res.query = req.query;
    next();
  }
  else {
    res.redirect("/login");
  }
}

const adminMiddleware = (req, res, next) => { // for /payment
  if (req.isAuthenticated() && req.user.admin) {
    next();
  }
  
  else {
    res.redirect("/logout");
  }
  
};

const checkValidationResult = (req, res, next) => {
  const result = validationResult(req);
  const referer = req.headers.referer;
  let url = referer.split("https://election-day3.glitch.me")[1];

  if (result.isEmpty()) {
      return next();
  }
  res.render(process.cwd() + "/views/pug/failure", { errors: result.array(), url });
}

const sendEmail = (from, to, subject, html) => {
  return new Promise((resolve, reject) => {
    transport.sendMail({ from, subject, to, html }, (err, info) => {
      if (err) {
        reject(err);
      } // unsure what to do here! error message: could not send verification email, please try again later
      else {
        resolve(info)
      }
    });
  });
  
}