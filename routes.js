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

// const Mendoza = require('./models/Mendoza.js');

module.exports = (app, db) => {
  
  mongo.connect(process.env.DATABASE, (err, client) => {
    if(err) { console.log('Database error: ' + err) }
    
    else {

      let db = client.db('freecodecamp2018');

      app.get('/', mainpageMiddleware, (req, res) => {
        console.log(req.body.ward);
        db.collection('negron').find( { }, {sort: { lastname: 1 } }, (err, cursor) => {
          if (err) { console.log(err); }
          else {
            let arr = [];
            cursor.toArray()
              .then((docs) => {
                for (let doc of docs) {
                  let obj = {};
                  obj.lastname = doc.lastname;
                  obj.firstname = doc.firstname;
                  obj.address = doc.address;
                  obj._id = doc._id;
                  arr.push(obj);
                }
              res.render(process.cwd() + '/views/pug/index', { arr });
            });
          }
        });
      });


      app.get("/delete", (req, res) => {
        db.collection('negron').deleteOne({ _id: ObjectId(req.query.clickedId) }, true, (err, doc) => {
          if (err) { console.log(err) }
          else {
            console.log("success : ", err);
          }
        })
      });


      app.get('/login', loginpageMiddleware, (req, res, next) => {
        res.render(process.cwd() + "/views/login.pug");
      });


      app.post('/login', (req, res, next) => {
        passport.authenticate("local", {
          successRedirect: "/",
          failureRedirect: "/login",
          failureFlash: true
        })(req, res, next);
      });

      app.get("/logout", (req, res) => {
        req.logout();
        res.redirect("/login");
      });
      
      app.get("/register", (req, res) => {
        res.render(process.cwd() + "/views/register.pug");
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

      
      // app.get("/upload", (req, res) => {
      //   db.collection('negron').insertMany([], (err, doc) => {
      //     if (err) { console.log(err) }
      //     else {
      //       console.log("success!");
      //       res.render(process.cwd() + "/views/login.pug");
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
    next();
  }
  else {
    res.redirect("/login");
  }
}