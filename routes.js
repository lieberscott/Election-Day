// libraries
// const bcrypt = require("bcryptjs");
// const { check, validationResult } = require('express-validator/check');
// const fs = require("fs");
// const jwt = require("jsonwebtoken");
// const nodegit = require("nodegit");
// const path = require("path"); // native to Node
// const passport = require("passport");
// const mongoose = require('mongoose');
const mongo = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;

// const Mendoza = require('./models/Mendoza.js');

module.exports = (app, db) => {
  
  mongo.connect(process.env.DATABASE, (err, client) => {
    if(err) console.log('Database error: ' + err);

    let db = client.db('freecodecamp2018');

    app.get('/', (req, res) => {

      db.collection('mendoza').find( { "precinct": 11 }, {sort: { name_last: 1 } }, (err, cursor) => {

        if (err) { console.log(err); }
        else {

          let arr = [];

          cursor.toArray()
            .then((docs) => {
            for (let doc of docs) {

              let obj = {};

              obj.lastname = doc.name_last;
              obj.firstname = doc.name_first;
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
      
      console.log(req.query.clickedId);
      
      db.collection('mendoza').deleteOne({ _id: ObjectId(req.query.clickedId) }, true, (err, doc) => {
        if (err) { console.log(err) }
        else {
          console.log("success : ", err);
        }
      })
      
    })

  })
}