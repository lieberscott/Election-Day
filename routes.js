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
const Negronuser = require("./models/negronuser.js");

module.exports = (app, db) => {
  
  mongo.connect(process.env.DATABASE, (err, client) => {
    if(err) { console.log('Database error: ' + err) }
    
    else {

      let db = client.db('freecodecamp2018');

      app.get('/', mainpageMiddleware, (req, res) => {
        let ward = req.user.ward;
        let precinct = req.user.precinct;
        console.log("user : ", req.user);
        let pollwatcher = req.user.pollwatcher;
        console.log("pollwatcher : ", req.user.pollwatcher);
        db.collection('negron').find( { ward: ward, precinct: precinct, voted: 0 }, { sort: { lastname: 1 } }, (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                arr = docs;
              res.render(process.cwd() + '/views/pug/index', { arr, pollwatcher });
            });
          }
        });
      });
      
      
      app.get("/voted", (req, res) => {
        let id = ObjectId(req.query.clickedId);
        let pollwatcher = req.query.pollwatcher;
        let tempdate= new Date().toString().split("GMT+0000 (UTC)")[0].split(" 2019");
        let d = tempdate[1].split(":");
        let time = Number(d[0]);
        console.log("time : ", time);
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
        
        
        
        
        db.collection('negron').findOneAndUpdate({ _id: id }, { $set: { voted : true, enteredBy: pollwatcher, date } }, (err, doc) => {
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
      
      app.post('/login', passport.authenticate("local", { failureRedirect: "/login" }), (req, res) => {
          if (req.user.email == "admin") {
            console.log("admin");
            res.redirect('/admin');
          }
          else if (req.user.email) {
            console.log("email");
            res.redirect('/name');
          }
        });
      
      app.get("/name", mainpageMiddleware, (req, res) => {
        res.render(process.cwd() + "/views/pug/name.pug");
      });
      
      app.post("/name", (req, res) => {
        console.log(req.body.name);
        console.log(req.user.email);
        db.collection('negronusers').findOneAndUpdate({ email: req.user.email }, { $set: { pollwatcher : req.body.name } }, (err, doc) => {
          if (err) { console.log(err) }
          else {
            console.log("success");
            res.redirect("/choice");
          }
        })
      });
      
      app.get("/choice", mainpageMiddleware, (req, res) => {
        res.render(process.cwd() + "/views/pug/choice.pug");
      });
      
      app.get("/report", mainpageMiddleware, (req, res) => {
        res.render(process.cwd() + "/views/pug/report.pug");
      });
      
      app.post("/report", (req, res) => {
        
        let precinct = req.user.precinct;
        console.log(precinct);
        
        let name = req.body.name;
        
        let dordek = Number(req.body.dordek);
        let jenkins = Number(req.body.jenkins);
        let ladien = Number(req.body.ladien);
        let maloney = Number(req.body.maloney);
        let martin = Number(req.body.martin);
        let negron = Number(req.body.negron);
        let schwartzers = Number(req.body.schwartzers);
        let kitzes = Number(req.body.kitzes);
        
        // check if email is already registered
        db.collection("negronvoteresults").update({ precinct }, {
          dordek,
          jenkins,
          ladien,
          maloney,
          martin,
          negron,
          schwartzers,
          kitzes,
          name,
          precinct
        }, { upsert: true }, (err, doc) => {
          if (err) { console.log(err); }
          else {
            res.redirect("/");
          }
        })
      });
      
      app.get("/votertotals", (req, res) => {
        db.collection('negronvoteresults').find({ }, { sort: { precinct: 1 } }, (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                arr = docs;
              res.render(process.cwd() + '/views/pug/votertotals', { arr });
            });
          }
        })
      });
      

      app.get("/logout", (req, res) => {
        req.logout();
        res.redirect("/login");
      });
      
      app.get("/register", (req, res) => {
        
        let email = req.body.email;
        let pass = req.body.password;
        let ward = req.body.ward;
        let precinct = req.body.precinct;
        
        console.log(email, pass, ward, precinct);
        
        // check if email is already registered
        Negronuser.findOne({ email: email })
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
                  const user = new Negronuser({
                    email: email,
                    password: hash,
                    ward: ward,
                    precinct: precinct
                  });
                  user.save()
                  .then((result) => {
                    console.log(result);
                    // res.status(201).json({ message: "User created" });
                    res.redirect("/");
                  })
                  .catch((error) => {
                    console.log(error);
                    res.status(500).json({ error : error });
                  })
                }
              });
            })
          }
        })
        
        
        res.render(process.cwd() + "/views/pug/register.pug");
      });
      
      app.post("/register", (req, res) => {
        
        let email = req.body.email;
        let pass = req.body.password;
        let ward = req.body.ward;
        let precinct = req.body.precinct;
        
        console.log(email, pass, ward, precinct);
        
        // check if email is already registered
        Negronuser.findOne({ email: email })
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
                  const user = new Negronuser({
                    email: email,
                    password: hash,
                    ward: ward,
                    precinct: precinct
                  });
                  user.save()
                  .then((result) => {
                    console.log(result);
                    // res.status(201).json({ message: "User created" });
                    res.redirect("/");
                  })
                  .catch((error) => {
                    console.log(error);
                    res.status(500).json({ error : error });
                  })
                }
              });
            })
          }
        })
      });
      
      app.get("/admin", adminMiddleware, (req, res) => {
        
        let x = db.collection("negron").aggregate([
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
              res.render(process.cwd() + '/views/pug/admin', { arr, count });
            });
          }
        });

      });
      
      app.get("/view/:precinct", adminMiddleware, (req, res) => {
        
        // convert param from string into a number
        let precinct = Number(req.params.precinct);
        
        db.collection('negron').find({ precinct }, { sort: { voted: 1, date: -1 } }, (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                arr = docs;
              res.render(process.cwd() + '/views/pug/view', { arr });
            });
          }
        })
      })

      
      // app.get("/upload", (req, res) => {
      //   db.collection('negron').insertMany([], (err, doc) => {
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
  if (req.isAuthenticated()) {
    console.log(req.user.email);
    next();
  }
  else {
    res.redirect("/login");
  }
}

// only for "/" page (if person is not logged in, it will redirect to login page rather than render main page)
const adminMiddleware = (req, res, next) => {
  if (req.user.email == "admin") {
    next();
  }
  else {
    res.redirect("/login");
  }
}