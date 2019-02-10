const express = require('express');
const app = express();
const mongoose = require('mongoose');

// mongoose.connect(process.env.DATABASE, { useNewUrlParser: true, useCreateIndex: true });
// mongoose.Promise = global.Promise;

const routes = require('./routes.js');
routes(app);

app.set('view engine', 'pug');

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
