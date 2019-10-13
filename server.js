const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const helpers = require('./helpers');

const app = express();
var db;

const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://admin:admin@boiler-calculations-db-jxkq1.mongodb.net/test?retryWrites=true&w=majority";


const client = new MongoClient(uri, { useNewUrlParser: true });
client.connect(err => {
    if (err) {
        return console.log(err);
    }
    app.listen(8000, () => {
        console.log('Server started!');
        db = client.db("boil_app_db");
    });
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', (err, res) => {
    res.send('My API started');
})

app.post('/user/create', bodyParser.json(), (req, res) => {
    console.log('inside registration post');
    bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
        if (err) throw err;
        const client = {
            login: req.body.login,
            hashedPass: hash,
        }
        db.collection("users").insertOne(client);
        res.send('Client created');
    });
});

app.post('/user/login', bodyParser.json(), (req, res) => {
    console.log('inside login post');
    console.log(req.body.login);
    if(!req.body) return res.sendStatus(400);
    db.collection('users').findOne({ login: req.body.login })
        .then(function (user) {
         console.log(user);
         if (!user) {
            res.send(null);
         } else {
            bcrypt.compare(req.body.password, user.hashedPass, function (err, result) {
            console.log(result);
            console.log(req.body.password);
            console.log(user.password);
            if (result == true) {
                res.send({
                    isValid: true,
                });
            } else {
                res.send({
                    isValid: false,
                });
            }
          });
        }
  });
});


