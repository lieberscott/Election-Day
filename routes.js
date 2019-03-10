// libraries
const bcrypt = require("bcryptjs");
const { check, validationResult } = require('express-validator/check');
const fs = require("fs");
const jwt = require("jsonwebtoken");
const nodegit = require("nodegit");
const path = require("path"); // native to Node
const passport = require("passport");
const mongoose = require('mongoose');
const mongo = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const Siawuser = require("./models/siawuser.js");
const Siaw = require("./models/Siaw.js");

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
        
        res.redirect("/payment");
        
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
          
          console.log(charge);
                    
          if (charge.paid) {
            Siawuser.findOneAndUpdate({ _id: id }, { paid: true }, {new: true }, (err, doc) => {
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
        check('email').isEmail(),
        // password must be at least 5 chars long
        check('password').isLength({ min: 1 }),
        check("password").custom((val, {req, loc, path}) => {
          if (val !== req.body.password2) {
              throw new Error("Passwords don't match");
          }
          else {
              return val;
          }
        })
        ],
        checkValidationResult,
        (req, res) => {
        
        let email = req.body.email;
        let pass = req.body.password;
        let pass2 = req.body.password2;
        let ward = req.body.ward;
        let precincts = req.body.precincts;
        let candfirst = req.body.candidatefirst;
        let candlast = req.body.candidatelast;
        
        let database = candlast + "-" + Date.now();
        let campaign = candlast + " for " + ward;
        
        // check if email is already registered
        Siawuser.findOne({ email: email })
        .exec()
        .then((user) => {
          if (user) {
            return res.status(422).json({ message: "email already exists" });
          }
          else {
            bcrypt.genSalt(10, (err, salt) => {

              bcrypt.hash(pass, salt, (error, hash) => {
                if (error) { console.log(error); }
                else {
                  const user = new Siawuser({
                    email,
                    password: hash,
                    ward,
                    no_of_precincts: precincts,
                    candidate_first: candfirst,
                    candidate_last: candlast,
                    campaigns: [{ database: database, public_name: candlast + " for " + ward }], // database names
                  });
                  user.save()
                  .then((result) => {
                    console.log(result);
                    req.login(user, (err) => {
                      if (!err) {
                        console.log(user);
                        res.redirect('/payment');
                      }
                      else {
                        console.log(error);
                        res.status(500).json({ error : error });
                      }
                    })
                  })
                  .catch((error) => {
                    console.log(error);
                    res.status(500).json({ error : error });
                  })
                };
              })
            })
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
      })

      
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
  if (req.user && req.user.paid) {
    next();
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