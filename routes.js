// libraries
const async = require("async");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { check, validationResult } = require('express-validator/check');
const fs = require("fs");
const jwt = require("jsonwebtoken"); // using?
const path = require("path"); // native to Node (using?)
const passport = require("passport");
const mongoose = require('mongoose');
const mongo = require('mongodb').MongoClient;
const nodemailer = require("nodemailer");
const ObjectId = require('mongodb').ObjectID; // using?
const randomstring = require("randomstring");
const Siawuser = require("./models/siawuser.js"); // admins and pollwatchers
const Siaw = require("./models/Siaw.js"); // voters
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

// const parserParams = {
//   delimiter: ";"
// }

const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 6000000 }, // fileSize limit is set at 5MB
  fileFilter: (req, file, cb) => { path.extname(file.originalname) == ".csv" ? cb(null, true) : cb("Must be a .csv file") }
}).single("file");

let filename;


module.exports = (app, db) => {
  
  mongo.connect(process.env.DATABASE, { useNewUrlParser: true }, (err, client) => {
    if(err) { console.log('Database error: ' + err) }
    
    else {

      let db = client.db('freecodecamp2018');

      app.get('/', /* mainpageMiddleware, */ (req, res) => {
        console.log("hello2");
        res.redirect("/login");
        
        /*
        let ward = req.user.ward;
        let precinct = req.user.precinct;

        db.collection('siaw').find( { ward: ward, precinct: precinct, voted: 0 }, { sort: { lastname: 1 } }, (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                arr = docs;
              console.log("docs : ", docs);
              console.log("arr : ", arr);
              res.render(process.cwd() + '/views/pug/index', { arr });
            });
          }
        }); */
      });
      
      app.get("/upload", (req, res) => {
        res.render(process.cwd() + "/views/pug/upload.pug", { admin: true });
      });
      
      app.post("/addfile", (req, res) => {
        upload(req, res, (err) => {
          if (err) {
            console.log(err);
            res.render(process.cwd() + "/views/pug/upload.pug", { msg: err });
          }
          else {
            if (req.file == undefined) {
              res.render(process.cwd() + "/views/pug/upload.pug", { msg: "Error: No file selected" });
            }
            else {
              const csvFilePath = "public/uploads/" + req.file.filename;
              filename = req.file.filename;
              csv()
              .fromFile(csvFilePath)
              .then((jsonObj)=> {
                res.render(process.cwd() + "/views/pug/upload.pug", { file: jsonObj });
              });

              // res.render(process.cwd() + "/views/pug/choice.pug", { msg: "File uploaded", file: `uploads/${req.file.filename}` });
            }
          }
        });
      });
      
      app.post("/addtomongo", (req, res) => {
        
        let opt = req.body.radios; // "addto" or "override"
        
        const csvFilePath = "public/uploads/" + filename;
        csv()
        .fromFile(csvFilePath)
        .then((jsonObj)=> {
          
          if (opt == "override") {
            Siaw.remove({}, (err, removed) => {
              if (err) { res.render(process.cwd() + "/views/pug/upload.pug", { msg: "Error: Please try again" }); }
              else {
                Siaw.insertMany(jsonObj, (err, doc) => {
                  if (err) {
                    res.render(process.cwd() + "/views/pug/upload.pug", { msg: "Error: Please try again" });
                  }
                  else {
                    console.log("success!");
                    res.render(process.cwd() + "/views/pug/upload.pug", { msg: "File uploaded" });
                  }
                });
              }
            });
          }
          
          else if (opt == "addto") {
            Siaw.insertMany(jsonObj, { ordered: false }, (err, doc) => {
              if (err) {
                if (err.result.result.ok >= 1) { // insertmany had conflicts with van_id, but some items were new
                  res.render(process.cwd() + "/views/pug/upload.pug", { msg: "File uploaded" });
                }
                else { // insertmany had conflicts with van_id, and none of the items were new
                  res.render(process.cwd() + "/views/pug/upload.pug", { msg: "Error: Please try again" });
                }
              }
              else {
                console.log("success!");
                res.render(process.cwd() + "/views/pug/upload.pug", { msg: "File uploaded" });
              }
            });
          }

        });
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
          console.log(id);
          console.log(req.user.email);
          
          console.log(charge);
                    
          if (charge.paid) {
            db.collection("siawusers").updateOne({ _id: id }, { $set: { paid: true } }, (err, doc) => {
              if (err) { console.log(err) }
              else {
                console.log(doc);
              }
            });
            
            
            res.redirect("/admin");
          }
          
        })();
        
        
      });
      
      
      app.get("/voted", (req, res) => {
        let id = ObjectId(req.query.clickedId);
        let pollwatcher = req.query.pollwatcher;
        let tempdate= new Date().toString().split("GMT+0000 (UTC)")[0].split(" 2019");
        let d = tempdate[1].split(":");
        let time = Number(d[0]);
        let t;
        if (time >= 7) { t = time - 6; }
        else if (time == 0) { t = 6 }
        else if (time == 1) { t = 7 }
        else if (time == 2) { t = 8 }
        else if (time == 3) { t = 9 }
        else if (time == 4) { t = 10 }
        else if (time == 5) { t = 11 }
        else if (time == 6) { t = 12 }
        let date = tempdate[0] + " " + t + ":" + d[1] + ":" + d[2];
        
        
        
        
        db.collection('siaw').findOneAndUpdate({ _id: id }, { $set: { voted : true, enteredBy: pollwatcher, date } }, (err, doc) => {
          if (err) { console.log(err) }
          else {
            console.log("success : ", err);
          }
        })
      });


      app.get('/login', /* loginpageMiddleware, */ (req, res, next) => {
        console.log("login");
        res.render(process.cwd() + "/views/pug/login.pug");
      });


      // app.post('/login', (req, res, next) => {
      //   passport.authenticate("local", {
      //     successRedirect: "/",
      //     failureRedirect: "/login",
      //     failureFlash: true
      //   })(req, res, next);
      // });
      
      app.post('/login', passport.authenticate("local", { failureRedirect: "/register" }), (req, res) => {

        if (req.user.admin && req.user.paid) {
          res.redirect('/admin');
        }
        else if (req.user.admin && !req.user.paid) {
          res.redirect('/payment');
        }
        
        else { // req.user.admin = false (pollwatcher)
          res.redirect("/choice");
        }
      });
      
      app.get("/choice", /* mainpageMiddleware, */ (req, res) => {
        res.render(process.cwd() + "/views/pug/choice.pug");
      });
      
      app.get("/report", mainpageMiddleware, (req, res) => {
        
        let precinct = req.user.precinct;
        
        res.render(process.cwd() + "/views/pug/report.pug", { precinct });
      });
      
      app.post("/report", (req, res) => {
        
        let precinct = req.user.precinct;
        let num = Number(req.body.number);
        
        let tempdate= new Date().toString().split("GMT+0000 (UTC)")[0].split(" 2019");
        let d = tempdate[1].split(":");
        let time = Number(d[0]);
        let t;
        if (time >= 7) { t = time - 6; }
        else if (time == 0) { t = 6 }
        else if (time == 1) { t = 7 }
        else if (time == 2) { t = 8 }
        else if (time == 3) { t = 9 }
        else if (time == 4) { t = 10 }
        else if (time == 5) { t = 11 }
        else if (time == 6) { t = 12 }
        let date = tempdate[0] + " " + t + ":" + d[1] + ":" + d[2];
        
        
        // check if email is already registered
        db.collection("siawvoteresults").update({ precinct }, {
          precinct, num, date
        }, { upsert: true }, (err, doc) => {
          if (err) { console.log(err); }
          else {
            res.redirect("/");
          }
        })
      });
      
      app.get("/totals", adminMiddleware, (req, res) => {
        db.collection('siawvoteresults').find({ }, { sort: { precinct: 1 } }, (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                arr = docs;
              res.render(process.cwd() + '/views/pug/totals', { arr, admin: true });
            });
          }
        })
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
            res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Email already exists" }] });
          }
          
          else { // FIRST ELSE: IT IS A NEW USER
            bcrypt.genSalt(10, (err, salt) => {
              if (err) {
                console.log(err);
                res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error: Please try again" }] });
              }

              else { // SECOND ELSE: PASSWORD SALTED
                bcrypt.hash(pass, salt, (error, hash) => {
                  if (error) {
                    console.log(error);
                    res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error: Please try again" }] });
                  }
                  else { // THIRD ELSE: PASSWORD HASHED
                      
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
                      authenticated: false
                    });
                    user.save()
                    .then((result) => {
                      console.log("result! : ", result);
                      req.login(user, (login_err) => {
                        if (login_err) {
                          console.log(error);
                          res.redirect("/login"); // add error message about registrtion successful but login failure. pleasa try to login below.

                        }
                        else { // FOURTH ELSE: USER CREATED, AND ABLE TO LOG IN
                          
                          let precincts = [];
                          
                          for (let i = 0; i < no_of_precincts; i++) {
                            let obj = {};
                            
                            obj.number = i + 1;
                            obj.total_votes = 0;
                            obj.last_updated = "";
                            obj.updated_by = "";
                            obj.opponent_votes = {};
                            
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
                              res.redirect("/register", { errors: [{ msg: "Error: Database failure. Contact support to help set up database." }] });
                            }
                            else { // FIFTH ELSE: CAMPAIGN INSERTED INTO CAMPAIGNS DATABASE
                              let token = randomstring.generate();

                              let verification = {
                                email,
                                token,
                                expireAfterSeconds: 172800
                              };
                              
                              db.collection("verification").insertOne(verification, async (verification_err, ver) => {

                                if (verification_err) {
                                  console.log(err);
                                  res.render("/register", { errors: [{ msg: "Error: Account created, but verification email failed. Log in to request another verificaiton email to verify your account." }] });
                                }
                                else { // SIXTH ELSE: VERIFICATION INSERTED INTO VERIFICATION DATABASE
                                  // send verification email
                                  const html = '<p>Hi ' + user_first + ',</p><p>Thank you for signing up with Turnout the Vote!</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + token + '">https://election-day3.glitch.me/verify/' + token + '</a></p><p> Have a pleasant day!</p>';
                                  await sendEmail("scott@voterturnout.com", email, "Please verify your account", html);

                                  res.redirect("/payment"); // add note about verifying email address (this on-screen message goes to admin though, not pollwatcher)
                                }
                              });
                            }
                          })
                        }
                      })
                    })
                    .catch((catch_err) => {
                      console.log(catch_err);
                      res.render("/register", { errors: [{ msg: "There was an error with your registration. That's all we know right now. Please contact support for help." }] });
                    });
                  };
                })
              }
            });
          }
        });
      });      
      app.get("/payment", /* paymentMiddleware, */ (req, res) => {
        res.render(process.cwd() + '/views/pug/payment');
      });
      
      app.get("/admin", /* adminMiddleware, */ (req, res) => {
        res.render(process.cwd() + '/views/pug/admin', { admin: true  });
      });
      
      
      app.get("/precincts", /* adminMiddleware, */ (req, res) => {
        
        let x = db.collection("siaw").aggregate([
          { $match : { } },
          // sorts by precinct, and gets number who voted and who haven't voted
          { $group : { _id: "$precinct", voted: { $sum: { $cond: ["$voted", 1, 0 ] } }, notvoted: { $sum: { $cond: ["$voted", 0, 1 ] } } } },
          { $sort: { _id: 1 } }
        ], (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr;
            cursor.toArray()
            .then((docs) => {
              arr = docs;
              let count = 0;
              res.render(process.cwd() + '/views/pug/precincts', { arr, count, admin: true  });
            });
          }
        });

      });
      
      app.get("/pollwatchers", (req, res) => {
        // get pollwatcher info from database
        let database = req.user.database;
        
        
        Siawuser.find({ database, admin: false },  (err, docs) => {
          if (err) { console.log(err); }
          else {
            console.log("Docs : ", docs);
            res.render(process.cwd() + "/views/pug/pollwatchers", { arr: docs, admin: true });
          }
        });
      });
      
      
      app.post("/pollwatchers", (req, res) => {
        // change the precinct/phone number/email/name on a pollwatcher
        let arr = [];     
        res.render(process.cwd() + "/views/pug/pollwatchers", { arr, admin: true });
      });
      
      app.get("/addpollwatcher", (req, res) => {
        res.render(process.cwd() + "/views/pug/addpollwatcher", { admin: true });
      });
      
      
      app.post("/addpollwatcher", /* add expressValidator middleware, */ (req, res) => {
        // add pollwatcher to database, add verification to database, and send email to pollwatcher
        
        // verification variables
        const token = randomstring.generate();
        
        // pollwatcher variables
        const email = req.body.email.toLowerCase();
        const first = req.body.firstname || "";
        const last = req.body.lastname || "";
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
          user_first: first,
          user_last: last,
          ward,
          precinct,
          database,
          public_name,
          admin: false,
          paid: false,
          authenticated: false
        });
        
        let verification = {
          email,
          token,
          expireAfterSeconds: 172800
        };
        
        Siawuser.create(user, (err, doc) => {
          
          if (err) {
            console.log("add pollwatcher error : ", err);
            // req.flash("danger", "User already signed up for another campaign. If user is not in your campaign, and you want them for your campaign, they must delete their current account and have you invte them to your campaign.");
            console.log(req.flash);
            res.render(process.cwd() + "/views/pug/addpollwatcher", { errors: [{ msg: "Second message for testing purposes" }] });
          }
          
          else { // no errors
            req.flash("success", "User added. Have user check their email to authenticate their account.");
            res.render(process.cwd() + "/views/pug/addpollwatcher", { errors: [{ msg: "Second message for testing purposes" }] });
          }
        });

      });
      
      app.post("/deletepollwatcher", (req, res) => {
        let id = req.body.clickedId;
        let database = req.user.catabase;
        
        Siawuser.findOneAndURemove({ _id: id }, (err, doc) => {
          if (err) { console.log(err); }
          else {

            console.log(doc);
            res.json({ success: "success" });
          }
        });
      });
      
      
      app.post("/changeprecinct/:userid", (req, res) => {
        let precinct = req.body.precinct;
        let id = req.params.userid;
        
        console.log(precinct);
        console.log(id);
        
        Siawuser.findOneAndUpdate({ _id: id }, { precinct }, { new: true }, (err, doc) => {
          if (err) {
            console.log(err);
            res.redirect("/pollwatchers"); // add error: "Error: Unable to change precinct. Please try again. If the problem persists, contact support
          }
          else {
            doc.precinct = precinct;
            doc.save();
            res.redirect("/pollwatchers");
          }
        });
        
      });
      
      
      app.get("/verify/:token", (req, res) => {
        
        let clicked_token = req.params.token; // user "entered" token
        
        db.collection("verification").findOne({ token: clicked_token }, (err, user) => {
          if (err) {
            res.render(process.cwd() + "/views/pug/verified", { msg: "Verification failed: Unknown error" });
            console.log(err);
          } // send an error message to page
          else { // user was found
            
            let email = user.email;
            let real_token = user.token;
            
            Siawuser.findOneAndUpdate({ email }, { authenticated: true }, (error, doc) => {
              if (err) {
                console.log(err);
                res.render(process.cwd() + "/views/pug/verified", { msg: "Verification failed: Unknown error" });
              }
              else {
                
                if (real_token == clicked_token) { // token matches
                  res.render(process.cwd() + "/views/pug/verified", { msg: "You are now verified" });
                }
                else { // token doesn't match
                  res.render(process.cwd() + "/views/pug/verified", { msg: "Verification failed: Token incorrect" });
                }
              }
            });
            
          }
        });
      });
      
      
      app.get("/view/:precinct", adminMiddleware, (req, res) => {
        
        // convert param from string into a number
        let precinct = Number(req.params.precinct);
        
        db.collection('siaw').find({ precinct }, { sort: { voted: 1, date: -1 } }, (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                arr = docs;
              res.render(process.cwd() + '/views/pug/view', { arr, admin: true });
            });
          }
        })
      });
      
      app.get("/configure", (req, res) => {
        
        let admin = req.user.admin;
        
        res.render(process.cwd() + "/views/pug/configure", { admin: true });
      });
      
      app.post("/addopponents", (req, res) => {
        
        let database = req.user.database;
        
        
        let opponents_string = req.body.opponents; // "Dwight D. Eisenhower, John F. Kennedy, Woodrow Wilson"
        let regex = /,\s*/g;
        let opponents = opponents_string.split(regex);
        let len = opponents.length;
        let obj = {};
        for (let i = 0; i < len; i++) {
          let opponent = opponents[i] // "Dwight D. Eisenhower"
          obj[opponent] = 0; // "Dwight D. Eisenhower": 0
        }
        
        Campaign.findOneAndUpdate( { database }, { $set: { "precincts.$[elem].opponent_votes": obj } }, { "arrayFilters": [{ "elem.number": { $gte: 1 } }], "multi": true }, (err, doc) => {
          if (err) {
            console.log(err);
            res.render(process.cwd() + "/views/pug/configure", { admin: true, errors: [{ msg: "Could not update precincts at this time. Please try again." }] });
          }
          
          else {
            res.render(process.cwd() + "/views/pug/configure", { admin: true, successes: [{ msg: "Database successfully updated" }] });
          }
          
          
        });
        
      });
      
      app.get("/campaigns", (req, res) => {
        console.log("req : ", req);
        console.log("req.body : ", req.body);
        console.log("req.query : ", req.query);
        res.render(process.cwd() + "/views/pug/campaigns", { arr: [] });
      });
      
      app.post("/changeprecincts", (req, res) => {
        let database = req.user.database;
        let new_no_of_precincts = parseInt(req.body.precincts);

        Campaign.findOne({ database })
        .exec()
        .then((doc) => {
          console.log("doc : ", doc);

          // Step 1: Check if user added or subtracted precincts
          // Step 2: If lowered, pop off the difference from the document array
          // Step 3: If increased, copy the first precinct object in the campaign, create a loop so you change the precinct_number to the old total number of precincts + 1, push into array. Repeat until you reach the new total number of precincts

          let difference = doc.no_of_precincts - new_no_of_precincts; // will be positive or negative
          let precincts = doc.precincts; // Array of objects
          let len = precincts.length; // will be 1 by default, or some larger positive number if user specified so during registration


          console.log("doc.no_of_precincts : ", doc.no_of_precincts);
          console.log("new_no_of_precincts : ", new_no_of_precincts);
          console.log("difference : ", difference);

          doc.no_of_precincts = new_no_of_precincts;

          if (difference > 0) { // admin lowered the number of precincts, so need to remove them from Mongo doc
            for (let i = 0; i < difference; i++) {
              doc.precincts.pop();
            }
            doc.save();
            res.render(process.cwd() + "/views/pug/configure", { successes: [{ msg: "Precincts successfully changed." }] });

          }

          else if (difference < 0) { // admin increased the number of precincts, so need to add them

            let obj = doc.precincts[0];

            for (let i = 0; i > difference; i--) {
              len++; // increase last precinct added by one, so if user previously identified 40 precincts, this number is now 41
              obj.number = len; // 41st precinct
              doc.precincts.push(obj); // push object into precincts array
            }
            doc.save();
            res.render(process.cwd() + "/views/pug/configure", { successes: [{ msg: "Precincts successfully changed." }] });

          }

          else { // difference is 0 (they entered same number as before)
            res.render(process.cwd() + "/views/pug/configure", { errors: [{ msg: "Same number of precincts as already on file." }] });

          }

        })
      .catch((err) => {
          console.log(err);
          res.render("/views/pug/configure", { errors: [{ msg: "Error: Unable to change precinct numbers. Please try again." }] });
        })
      })

      app.post("/changepassword", (req, res) => {
        let oldpassword = req.body.oldpassword;
        let newpassword1 = req.body.newpassword1;
        let newpassword2 = req.body.newpassword2;
        
        let email = req.user.email;
        
        Siawuser.findOne({ email })
        .exec()
        .then((user) => {
//           bcrypt.compare(oldpassword, user.password, (error, isMatch) => {
 
//             if (error) {
//               console.log(error);
//               res.render("/views/pug/configure", { error: [{ msg: "Old password incorrect. Please" }] });
//             }
//             else {
//               if (isMatch) {
//                 console.log(user);
//                 return done(null, user);
//               }
//               else {
//                 console.log("wrong password");
//                 return done(null, false, { message: "Wrong password" });
//               }
//             }
//           });
//         });
          
          
          
          
//           let currentpassword = user.password;
//           if (user) {
//             res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Email already exists" }] });
//           }
          
//           else { // FIRST ELSE: IT IS A NEW USER
//             bcrypt.genSalt(10, (err, salt) => {
//               if (err) {
//                 console.log(err);
//                 res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error: Please try again" }] });
//               }

//               else { // SECOND ELSE: PASSWORD SALTED
//                 bcrypt.hash(pass, salt, (error, hash) => {
//                   if (error) {
//                     console.log(error);
//                     res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error: Please try again" }] });
//                   }
//                   else { // THIRD ELSE: PASSWORD HASHED
                      
//                     const user = new Siawuser({
//                       email,
//                       password: hash,
//                       user_first,
//                       user_last,
//                       ward,
//                       database,
//                       public_name,
//                       admin: true,
//                       paid: false,
//                       authenticated: false
//                     });
//                     user.save()
//                     .then((result) => {
//                       console.log("result! : ", result);
//                       req.login(user, (login_err) => {
//                         if (login_err) {
//                           console.log(error);
//                           res.redirect("/login"); // add error message about registrtion successful but login failure. pleasa try to login below.

//                         }
//                         else { // FOURTH ELSE: USER CREATED, AND ABLE TO LOG IN
                          
//                           let precincts = [];
                          
//                           for (let i = 0; i < no_of_precincts; i++) {
//                             let obj = {};
                            
//                             obj.number = i + 1;
//                             obj.total_votes = 0;
//                             obj.last_updated = "";
//                             obj.updated_by = "";
//                             obj.opponent_votes = {};
                            
//                             precincts.push(obj);
//                           }
                          
//                           let campaign = {
//                             database,
//                             public_name,
//                             ward,
//                             no_of_precincts,
//                             candidate_first,
//                             candidate_last,
//                             precincts
//                           }

                          
//                           Campaign.create(campaign, (campaigns_error, doc) => {
//                             if (campaigns_error) {
//                               console.log(campaigns_error);
//                               res.redirect("/register", { errors: [{ msg: "Error: Database failure. Contact support to help set up database." }] });
//                             }
//                             else { // FIFTH ELSE: CAMPAIGN INSERTED INTO CAMPAIGNS DATABASE
//                               let token = randomstring.generate();

//                               let verification = {
//                                 email,
//                                 token,
//                                 expireAfterSeconds: 172800
//                               };
                              
//                               db.collection("verification").insertOne(verification, async (verification_err, ver) => {

//                                 if (verification_err) {
//                                   console.log(err);
//                                   res.render("/register", { errors: [{ msg: "Error: Account created, but verification email failed. Log in to request another verificaiton email to verify your account." }] });
//                                 }
//                                 else { // SIXTH ELSE: VERIFICATION INSERTED INTO VERIFICATION DATABASE
//                                   // send verification email
//                                   const html = '<p>Hi ' + email + ',</p><p>Thank you for signing up with Turnout the Vote!</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + token + '">https://election-day3.glitch.me/verify/' + token + '</a></p><p> Have a pleasant day!</p>';
//                                   console.log(html);
//                                   await sendEmail("scott@voterturnout.com", email, "Please verify your account", html);

//                                   res.redirect("/payment"); // add note about verifying email address (this on-screen message goes to admin though, not pollwatcher)
//                                 }
//                               });
//                             }
//                           })
                    //      }
                    //   })
                    // })
            //         .catch((catch_err) => {
            //           console.log(catch_err);
            //           res.render("/register", { errors: [{ msg: "There was an error with your registration. That's all we know right now. Please contact support for help." }] });
            //         });
            //       };
            //     })
            //   }
            // });
          })
        
        
        
        
      });
      
      app.get("/requestreset", (req, res) => {
        res.render(process.cwd() + "/views/pug/requestreset");
      });
      
      app.post("/requestreset", (req, res) => {
        let token = randomstring.generate();

        let email = req.body.email.toLowerCase();

        let date = Date.now() + 3600000;
        
        console.log("token : ", token);

        Siawuser.findOne({ email }, async (err, user) => {
          if (err) {
            console.log(err);
            return res.render(process.cwd() + "/views/pug/requestreset", { errors: [{ msg: "Email does not exist." }] });
          }

          else { // User found
            console.log("hello inside user");
            user.resetPassword = token;
            user.resetPasswordExpires = date;
            user.save();

            let user_first = user.user_first;

            const html = '<p>Hi ' + user_first + ',</p><p>A password reset was recently requested for this email address</p><p>To change your password, use the following link:</p><p><a href="https://election-day3.glitch.me/resetpassword/' + token + '">https://election-day3.glitch.me/resetpassword/' + token + '"</a>. This request will expire in one hour.</p><p>If you didn\'t make this request, you can ignore this message and your password will remain unchanged.</p><p>Have a pleasant day!</p>';
            console.log("html");
            await sendEmail("scott@voterturnout.com", email, "Your password reset request", html);
            console.log("html2");

            req.flash("success", "An email has been sent to the email address you provided. Click the link to reset your password. This request is only valid for one hour.");
            res.redirect("/login");
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
        ], (req, res) => {
        
        let token = req.params.token;
        let pass = req.body.password;
        
        Siawuser.findOne({ resetPassword: token, resetPasswordExpires: { $gte: Date.now() } }, (err, user) => {
          if (err) {
            console.log(err);
            req.flash("error", "Password reset is invalid or has expired.");
            res.render(process.cwd() + "/views/pug/resetpassword", { errors: [{ msg: "Password reset is invalid or has expired." }] });
          }
          
          else { // FIRST ELSE: USER FOUND
            bcrypt.genSalt(10, (err, salt) => {
              if (err) {
                console.log(err);
                res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error: Please try again" }] });
              }

              else { // SECOND ELSE: PASSWORD SALTED
                bcrypt.hash(pass, salt, (error, hash) => {
                  if (error) {
                    console.log(error);
                    res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error: Please try again" }] });
                  }
                  else { // THIRD ELSE: PASSWORD HASHED
                    user.password = hash;
                    user.save();
                    req.login(user, (login_err) => {
                      if (login_err) {
                        console.log(login_err);
                        req.flash("error", "Login successful, but unable to log in. Please try logging in below.");
                      }
                      
                      else { // FOURTH ELSE: USER SAVED AND LOGGING IN
                        req.flash("success", "Password successfully changed.");
                        res.redirect("/admin");
                      }
                      
                    });
                  }
                })
              }
            })
          }
        });        
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
  if (req.isAuthenticated()) {
    res.redirect("/");
  }
  else {
    next();
  }
}

// only for "/" page (if person is not logged in, it will redirect to login page rather than render main page)
const mainpageMiddleware = (req, res, next) => {
  if (req.user && req.user.email == "admin") {
    res.redirect("/admin");
  }
  
  else if (req.isAuthenticated()) {
    next();
  }
  else {
    res.redirect("/login");
  }
}

// if person is  logged in, it will redirect to payment page rather than render main page
const adminMiddleware = (req, res, next) => {
  
  if (req.user) {
    if (req.user.paid) {
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

const checkValidationResult = (req, res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) {
        return next();
    }
    res.render(process.cwd() + '/views/pug/register', { errors: result.array() });
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
