const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const helpers = require('./helpers');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const app = express();
var db;

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
            name: req.body.name,
            email: req.body.email,
        };
        db.collection("users").findOne({login: req.body.login}).then((user) => {
            console.log(user);
            if (user) {
                res.status(400).send({message: 'User already exists'});
            } else {
                db.collection("users").insertOne(client);
                res.sendStatus(200);
            }
        });
        // if (alreadyExists) {
        // } else {
        //     db.collection("users").insertOne(client);
        //     res.send(200);
        // }
    });
});

app.post('/user/login', bodyParser.json(), (req, res) => {
    console.log('inside login post');
    console.log(req.body.login);
    if(!req.body) return res.sendStatus(400);
    db.collection('users').findOne({ login: req.body.login })
        .then(function (user) {
         console.log(user);
         console.log(typeof user._id);
         if (!user) {
             res.status(404).send({message: 'User with such login is not found'});
         } else {
            bcrypt.compare(req.body.password, user.hashedPass, function (err, result) {
            if (result) {
                const jwtBearerToken = helpers.getJWTByUserId(`${user._id}`);
                console.log(jwtBearerToken);
                res.status(200).send({
                    isValid: true,
                    token: jwtBearerToken,
                    user: {
                        name: user.name,
                        email: user.email,
                        login: user.login,
                    },
                });
            } else {
                res.status(200).send({
                    isValid: false,
                });
            }
          });
        }
  });
});

// todo: fix verification (id comparison)
app.post('/user/verifyToken', bodyParser.json(), (req, res) => {
    console.log('inside verifyToken');
    console.log(req.body.token);
    if(!req.body) return res.sendStatus(400);
    const userId = helpers.verifyJWT(req.body.token);
    db.collection('users').findOne({"_id" : mongo.ObjectID(userId)})
        .then(function (user) {
            console.log(user);
            if (!user) {
                res.status(200).send({
                    tokenValid: false,
                })
            } else {
                res.status(200).send({
                    tokenValid: true,
                    userName: user.login,
                })
            }
        });
});


