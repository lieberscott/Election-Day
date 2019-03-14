// libraries
const bcrypt = require("bcryptjs");
const { check, validationResult } = require('express-validator/check');
const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path"); // native to Node
const passport = require("passport");
const mongoose = require('mongoose');
const mongo = require('mongodb').MongoClient;
const nodemailer = require("nodemailer");
const ObjectId = require('mongodb').ObjectID;
const randomstring = require("randomstring");
const Siawuser = require("./models/siawuser.js"); // admins and pollwatchers
const Siaw = require("./models/Siaw.js"); // voters
const Campaign = require("./models/campaign.js"); // voters
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
        res.redirect("/admin");
        
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
          
          let id = req.user.campaigns[0]._id;
          
          console.log(charge);
                    
          if (charge.paid) {
            db.collection("siawusers").update({ "campaigns._id": id }, { $set: { "campaigns.$.paid": true } }, (err, doc) => {
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


      app.get('/login', loginpageMiddleware, (req, res, next) => {
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
        // need to check for current_index, and update current_index for all users
        if (req.user.paid) {
          res.redirect('/admin');
        }
        else {
          res.redirect('/login');
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
        
        let email = req.body.email;
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
                
        bcrypt.genSalt(10, (salt_err, salt) => {
          if (salt_err) {
            console.log(salt_err);
            res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error. Please try again. If this problem persists, please contact support."  }] });
          }
          
          else { // salt generated
            bcrypt.hash(pass, salt, (err, hash) => {
              
              if (err) {
                console.log(err); // send error message: Error: Registration error. Try again. If this problem persists, contact support at scott@election-day.com
                res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error. Please try again. If this problem persists, please contact support." }] });

              }
              
              else { // hash generated
                let campaigninfo = {
                  database,
                  public_name,
                  admin: true,
                  paid: false
                };

                let newuser = new Siawuser({
                  email,
                  password: hash,
                  user_first,
                  user_last,
                  campaigns: [campaigninfo]
                });
                
                
                Siawuser.findOneAndUpdate({ email }, newuser, { upsert: true }, async (error, user) => {
                  if (error) {
                    console.log(error);
                    res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Registration error. Please try again. If this problem persists, please contact support." }] });

                  }
                  
                  else { // user added or updated (have to check in this else condition)
                    if (!user) { // no previous user, meaning you need to send an email and add to verification database, and add to campaign database
                      
                      let token = randomstring.generate();
                      
                      let verification = {
                        email,
                        token,
                        expireAfterSeconds: 172800
                      };
                      
                      db.collection("verification").insertOne(verification, async (ver_err, ver_doc) => {
                        if (ver_err) {
                          console.log(ver_err);
                          res.render(process.cwd() + "/views/pug/register", { errors: [{msg: "Verification could not be generated. Please request another verification email in order to verify your account." }] });
                        }
                        
                        else { // new user, and verification added to verification database

                          // send verification email
                          const html = '<p>Hi ' + email + ',</p><p>Thank you for signing up with Turnout the Vote!</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + token + '">https://election-day3.glitch.me/verify/' + token + '</a></p><p> Have a pleasant day!</p>';
                          console.log(html);
                          console.log("await coming");
                          await sendEmail("scott@voterturnout.com", email, "Please verify your account", html)
                          .then(() => {
                            let campaign = new Campaign({
                              database,
                              public_name,
                              ward,
                              no_of_precincts,
                              candidate_first,
                              candidate_last,
                              precincts: []
                            })


                            // add to campaign database
                            db.collection("campaign").insertOne(campaign, (campaign_error, campaign_doc) => {
                              if (campaign_error) {
                                console.log(campaign_error); // send message: Error: Your campaign could not be saved. Please contact support for help
                              }
                              else {
                                res.redirect("/payment"); // add note about verifying email address (this on-screen message goes to admin though, not pollwatcher)
                              }
                            });
                          })
                          .catch((email_err) => {
                            console.log("email error");
                            res.render(process.cwd() + "/views/pug/register", { errors: [{ msg: "Error: Account created, but verification email failed. Please log in to request a new verification email in order to verify account." }] });
                          });
                          
                          

                        }
                      });
                      
                      
                      
                    }
                  }
                  
                })
              }
                
            })
          }
        })
        
        
        
//         // check if email is already registered
//         Siawuser.findOne({ email: email })
//         .exec()
//         .then((user) => {
//           if (user) {
//             return res.status(422).json({ message: "email already exists" });
//           }
//           else {
            
//             bcrypt.genSalt(10, (err, salt) => {

//               bcrypt.hash(pass, salt, (error, hash) => {
//                 if (error) { console.log("error"); }
//                 else {
//                   const user = new Siawuser({
//                     email,
//                     password: hash,
//                     campaigns: [
//                       {
//                         database: database,
//                         public_name: candlast + " for " + ward,
//                         candidate_first: candfirst,
//                         candidate_last: candlast,
//                         ward: ward,
//                         no_of_precincts: precincts,
//                         admin: true
//                       }
//                     ], // database names
//                   });
//                   user.save()
//                   .then((result) => {

//                     req.login(user, (err) => {
//                       if (err) {
//                         console.log(error);
//                         res.status(500).json({ error : error });
                        
//                       }
//                       else {
//                         console.log(user);
                        
//                         db.collection("verification").insertOne(verification, async (err, ver) => {
//                           if (err) { console.log(err); }
//                           else {

//                             // send verification email
//                             const html = '<p>Hi ' + email + ',</p><p>Thank you for signing up with Turnout the Vote!</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + token + '">https://election-day3.glitch.me/verify/' + token + '</a></p><p> Have a pleasant day!</p>';
//                             console.log(html);
//                             await sendEmail("scott@voterturnout.com", email, "Please verify your account", html);

//                             res.redirect("/pollwatchers"); // add note about verifying email address (this on-screen message goes to admin though, not pollwatcher)
//                           }
//                         });
                        
                        
//                         db.collection("campaigns").insertOne({
                          
//                         });
//                         res.redirect('/payment');
//                       }
//                     })
//                   })
//                   .catch((error) => {
//                     console.log(error);
//                     res.status(500).json({ error : error });
//                   })
//                 };
//               })
//             })
//           }
//         });
        
//         Siawuser.findOneAndUpdate({ email }, user, { upsert: true }, (err, doc) => { // upsert means if user is not in database, they will be inserted
          
//           if (err) { console.log(err); }
          
//           else { // no errors
            
//             if (doc == null) { // user does not exist
//               // send email and add to verification database
//               // no need to add to user database, as upsert will do that for us
//               db.collection("verification").insertOne(verification, async (err, ver) => {
//                 if (err) { console.log(err); }
//                 else {
                  
//                   // send verification email
//                   const html = '<p>Hi ' + email + ',</p><p>Thank you for signing up with Turnout the Vote!</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + token + '">https://election-day3.glitch.me/verify/' + token + '</a></p><p> Have a pleasant day!</p>';
//                   console.log(html);
//                   await sendEmail("scott@voterturnout.com", email, "Please verify your account", html);
                  
//                   res.redirect("/pollwatchers"); // add note about verifying email address (this on-screen message goes to admin though, not pollwatcher)
//                 }
//               });
//             }
            
//             else if (doc && doc.campaigns && doc.campaigns.some(elem => elem.database == database)) { // user exists and is signed up for our campaign
//               console.log("user exists and is signed up for our campaign");
//               console.log("doc : ", doc);
//               // no need to send email or do anything
//               // send error message and redirect to pollwatchers list
//               res.redirect("/pollwatchers");
//             }
            
//             else { // user exists and is not signed up for our campaign
//               // add our campaign to their campaigns list]
//               console.log("user exists and is not signed up for our campaign");
//               console.log("doc : ", doc);
//               doc.campaigns.push(campaign);
//               doc.save();
              
//               res.redirect("/pollwatchers");
              
//             }
//           }
//         });

        
        
        
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
        let index = req.user.current_index;
        let database = req.user.campaigns[index].database;
        
        
        Siawuser.find({ campaigns: { $elemMatch: { database } }, campaigns: { $elemMatch: { admin: false } } }, (err, docs) => {
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
        const string = randomstring.generate(); // delete (should be in .post)
        console.log(string);
        res.render(process.cwd() + "/views/pug/addpollwatcher", { admin: true });
      });
      
      
      app.post("/addpollwatcher", /* add expressValidator middleware, */ (req, res) => {
        // add pollwatcher to database, add verification to database, and send email to pollwatcher
        
        // verification variables
        const token = randomstring.generate();
        
        // pollwatcher variables
        const email = req.body.email;
        const first = req.body.firstname || "";
        const last = req.body.lastname || "";
        const precinct = req.body.precinct || "";
        
        // campaign variables
        const index = req.user.current_index;
        const database = req.user.campaigns[index].database;
        const public_name = req.user.campaigns[index].public_name;
        const ward = req.user.campaigns[index].ward;
        const no_of_precincts = req.user.campaigns[index].no_of_precincts;
        const candidate_first = req.user.campaigns[index].candidate_first;
        const candidate_last = req.user.campaigns[index].candidate_last;
        
        const campaign = {
          database,
          public_name,
          ward,
          precinct,
          no_of_precincts,
          candidate_first,
          candidate_last,
          admin: false,
          paid: false
        };
        
        let user = new Siawuser({
          email,
          user_first: first,
          user_last: last,
          campaigns: [campaign]
        });
        
        let verification = {
          email,
          token,
          expireAfterSeconds: 172800
        };
        
        Siawuser.findOneAndUpdate({ email }, user, { upsert: true }, (err, doc) => { // upsert means if user is not in database, they will be inserted
          
          if (err) { console.log(err); }
          
          else { // no errors
            
            if (doc == null) { // user does not exist
              // send email and add to verification database
              // no need to add to user database, as upsert will do that for us
              db.collection("verification").insertOne(verification, async (err, ver) => {
                if (err) { console.log(err); }
                else {
                  
                  // send verification email
                  const html = '<p>Hi ' + email + ',</p><p>Thank you for signing up with Turnout the Vote!</p><p>Please verify your email address by clicking the following link:</p><p><a href="https://election-day3.glitch.me/verify/' + token + '">https://election-day3.glitch.me/verify/' + token + '</a></p><p> Have a pleasant day!</p>';
                  console.log(html);
                  
                  console.log("await coming");
                  await sendEmail("scott@voterturnout.com", email, "Please verify your account", html).catch((email_err) => {
                    console.log("rejected");
                    res.render(process.cwd() + "/views/pug/register", { msg: "Verification could not be generated. Please request another verification email" });
                    return;

                  });
                  
                  // res.redirect("/pollwatchers"); // add note about verifying email address (this on-screen message goes to admin though, not pollwatcher)
                }
              });
            }
            
            else if (doc && doc.campaigns && doc.campaigns.some(elem => elem.database == database)) { // user exists and is signed up for our campaign
              console.log("user exists and is signed up for our campaign");
              console.log("doc : ", doc);
              // no need to send email or do anything
              // send error message and redirect to pollwatchers list
              res.redirect("/pollwatchers");
            }
            
            else { // user exists and is not signed up for our campaign
              // add our campaign to their campaigns list]
              console.log("user exists and is not signed up for our campaign");
              console.log("doc : ", doc);
              doc.campaigns.push(campaign);
              doc.save();
              
              res.redirect("/pollwatchers");
              
            }
          }
        });

        // db.collection("verification").update({ email }, { email, token, expireAfterSeconds: 172800 }, { upsert: true }, (err, doc) => {
        //   if (err) { console.log(err); }
        //   else {
        //     db.collection("siawusers").update({ email }, {
        //       email,
        //       user_first: first,
        //       user_last: last,
        //       campaigns: [{
        //         database,
        //         public_name,
        //         ward,
        //         precinct,
        //         no_of_precincts,
        //         candidate_first,
        //         candidate_last,
        //         admin: false,
        //         paid: false
        //       }]
        //     },
        //     { upsert: true }, (err, doc) => {
        //       if (err) { console.log(err); }
        //       else {
        //         res.redirect("/pollwatchers");
        //       }
        //     })
        //   }
        // })
      });
      
      app.post("/deletepollwatcher", (req, res) => {
        let id = req.body.clickedId;
        let index = req.user.current_index;
        let database = req.user.campaigns[index].database;
        
        Siawuser.findOneAndUpdate({ _id: id }, { $pull: { "campaigns" : { database } } }, (err, doc) => {
          if (err) { console.log(err); }
          else {
            console.log(doc);
            doc.save();
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
          if (err) { console.log(err); } // return error: "Error: Unable to change precinct. Please try again.
          else {
            console.log(doc);
            
            let index = doc.current_index;
            doc.campaigns[index].precinct = precinct;
            doc.save();
            res.json({ msg: "Success" });
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
    let index = req.user.current_index;
    if (req.campaigns[index].paid) {
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