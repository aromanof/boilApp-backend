const express = require('express');
const router = express.Router;
const mongojs = require("mongojs");
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const saltRounds = 10;
const app = express();
let users;
const uri = "mongodb://AlexAdmin:AlexAdmin1@ds155916.mlab.com:55916/boil_app";
let db = mongojs(uri, ['ba_users']);

// const MongoClient = require('mongodb').MongoClient;
// MongoClient.connect(uri, { useNewUrlParser: true }, function(err, client) {
//     console.log('DB Connected...');
//     console.log(client);
//     if(err) {
//         console.log('Error occurred while connecting to MongoDB Atlas...\n',err);
//     }
//     console.log('DB Connected...');
//     users = client.db("boilerAppDB").collection("ba_users");
//     console.log(users);
//     // perform actions on the collection object
//     client.close();
// });

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.route('/api/login').get((req, res) => {
    console.log('Inside GET /login callback function');
    res.send(`You got the login page!\n`);
});

app.route('/api/login').post((req, res) => {
    console.log('inside login post');
    db.ba_users.find( (err, tasks) => res.send(tasks));
    // if(!req.body) return res.sendStatus(400);
    // res.send(`password checked`);
});

app.post('/login', bodyParser.json(), (req, res) => {
    console.log('inside login post');
    // if(!req.body) return res.sendStatus(400);
    // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    //     const loginSuccessful = users.find(user => user.login === req.body.login && user.hashed_password === hash);
    //     res.send(loginSuccessful);
    // });
    db.ba_users.find( (err, tasks) => res.send(tasks));
});

app.route('/api/cats').get((req, res) => {
    res.send({
      cats: [{ name: 'lilly' }, { name: 'lucy' }]
    });
});

app.listen(8000, () => {
    console.log('Server started!');
});
