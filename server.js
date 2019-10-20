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
    bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
        if (err) throw err;
        const client = {
            login: req.body.login,
            hashedPass: hash,
            name: req.body.name,
            email: req.body.email,
        };
        db.collection("users").findOne({login: req.body.login}).then((user) => {
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
    if(!req.body) return res.sendStatus(400);
    db.collection('users').findOne({ login: req.body.login })
        .then(function (user) {
         if (!user || !user._id) {
             res.status(404).send({message: 'User with such login is not found'});
         } else {
            bcrypt.compare(req.body.password, user.hashedPass, function (err, result) {
            if (result) {
                const jwtBearerToken = helpers.getJWTByUserId(`${user._id}`);
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
    if(!req.body) return res.sendStatus(400);
    const userId = helpers.verifyJWT(req.body.token);
    db.collection('users').findOne({"_id" : mongo.ObjectID(userId)})
        .then(function (user) {
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

app.post('/calculations/coefficients1', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    db.collection('constants').findOne({taskNum: 1})
        .then(coefs => {
            if (!coefs) {
                res.status(404).send({
                    message: 'Something went wrong, try again later',
                });
            } else {
                res.status(200).send(coefs)
            }
        });
});

app.post('/calculations/coefficients3', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    db.collection('constants').findOne({taskNum: 3})
        .then(coefs => {
            if (!coefs) {
                res.status(404).send({
                    message: 'Something went wrong, try again later',
                });
            } else {
                res.status(200).send(coefs)
            }
        });
});

app.post('/calculations/calculate-task1', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    db.collection('constants').findOne()
        .then(coefs => {
            if (!coefs) {
                res.status(404).send({
                    message: 'Something went wrong, try again later',
                });
            } else {
                const startDiagramValues = helpers.calculateIDDiagram(+req.body.T1, +req.body.Phi1, +coefs.Pb);
                const endDiagramValues = helpers.calculateIDDiagram(+req.body.T2, +req.body.Phi2, +coefs.Pb);
                const n = helpers.getN(req.body.G1, req.body.G2);

                const dSm = helpers.getSmData(startDiagramValues.d, endDiagramValues.d, n);
                const iSm = helpers.getSmData(startDiagramValues.i, endDiagramValues.i, n);
                const tSm = helpers.getSmData(+req.body.T1, +req.body.T2, n);
                const phiSm = helpers.getSmData(+req.body.Phi1, +req.body.Phi2, n);

                res.status(200).send({
                    dSm,
                    iSm,
                    tSm,
                    phiSm,
                });
            }
        });
});

app.post('/chart/task1-temperature', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    const n = helpers.getN(req.body.G1, req.body.G2);
    console.log('inside chart');
    console.log(req.body);
    const startTemperatureList = [
        +req.body.T1 - 20,
        +req.body.T1 - 10,
        +req.body.T1,
        +req.body.T1 + 10,
        +req.body.T1 + 20
    ];
    const endTemperatureList = [
        +req.body.T2,
        +req.body.T2,
        +req.body.T2,
        +req.body.T2,
        +req.body.T2,
    ];
    const resultTemperatureList = [];
    for (let i = 0; i < startTemperatureList.length; i++) {
        resultTemperatureList.push(helpers.getSmData(
            startTemperatureList[i],
            endTemperatureList[i],
            n,
        ));
    }
    res.status(200).send({
        startTemperatureList,
        endTemperatureList,
        resultTemperatureList,
    });
});

app.post('/calculations/calculate-task3', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    const nozzleInfo = helpers.getFinalNozzleHeight(
        +req.body.L,
        +req.body.I1,
        +req.body.I2,
        +req.body.T2_1,
        +req.body.T2_2,
        +req.body.d,
        +req.body.S,
        +req.body.V,
    );

    res.status(200).send(nozzleInfo);
});


app.post('/chart/task3-nozzle-surface', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    console.log('inside chart nozzle');
    const sChangingList = [
        +req.body.S - 20,
        +req.body.S - 10,
        +req.body.S,
        +req.body.S + 10,
        +req.body.S + 20
    ];
    const resultNozzleHeightList = [];
    for (let i = 0; i < sChangingList.length; i++) {
        resultNozzleHeightList.push(helpers.getFinalNozzleHeight(
            +req.body.L,
            +req.body.I1,
            +req.body.I2,
            +req.body.T2_1,
            +req.body.T2_2,
            +req.body.d,
            sChangingList[i],
            +req.body.V,
        ).nozzleHeight);
    }
    res.status(200).send({
        sChangingList,
        resultNozzleHeightList,
    });
});
