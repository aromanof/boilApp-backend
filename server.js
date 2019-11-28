const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const helpers = require('./helpers');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const app = express();
var db;

// const uri = "mongodb+srv://admin:admin@boiler-calculations-db-jxkq1.mongodb.net/test?retryWrites=true&w=majority";
const uri = "mongodb://admin:admin@boiler-calculations-db-shard-00-00-jxkq1.mongodb.net:27017,boiler-calculations-db-shard-00-01-jxkq1.mongodb.net:27017,boiler-calculations-db-shard-00-02-jxkq1.mongodb.net:27017/test?ssl=true&replicaSet=boiler-calculations-db-shard-0&authSource=admin&retryWrites=true&w=majority";


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
});

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
                res.status(200).send();
            }
        });
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
                        userId: user._id,
                        name: user.name,
                        email: user.email,
                        login: user.login,
                        roles: user.roles || [1],
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

app.post('/user/verifyToken', bodyParser.json(), (req, res) => {
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
                    user: {
                        userId: user._id,
                        name: user.name,
                        email: user.email,
                        login: user.login,
                        roles: user.roles || [1],
                    },
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
    let calculationResults;
    db.collection('constants').findOne({taskNum: 1})
        .then(coefs => {
            if (!coefs) {
                res.status(404).send({
                    message: 'Something went wrong, try again later',
                });
            } else {
                const startDiagramValues = helpers.calculateIDDiagram(+req.body.coefs.T1, +req.body.coefs.Phi1, +coefs.Pb);
                const endDiagramValues = helpers.calculateIDDiagram(+req.body.coefs.T2, +req.body.coefs.Phi2, +coefs.Pb);
                console.log(req.body.coefs.G1, req.body.coefs.G2);
                const n = helpers.getN(req.body.coefs.G1, req.body.coefs.G2);

                const dSm = helpers.getSmData(startDiagramValues.d, endDiagramValues.d, n);
                const iSm = helpers.getSmData(startDiagramValues.i, endDiagramValues.i, n);
                const tSm = helpers.getSmData(+req.body.coefs.T1, +req.body.coefs.T2, n);
                const phiSm = helpers.getSmData(+req.body.coefs.Phi1, +req.body.coefs.Phi2, n);

                calculationResults = {dSm, iSm, tSm, phiSm};
                db.collection('users').findOne({"_id" : mongo.ObjectID(req.body.userId)}).then(
                    (user) => {
                        let historyObject = {
                            date: req.body.date,
                            user: user,
                            calculationCoefficients: {taskNum: '1', ...req.body.coefs},
                            calculationResults,
                        };
                        db.collection("history").insertOne(historyObject);
                    },
                );

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
    console.log(req.body.G1, req.body.G2);
    const n = helpers.getN(req.body.G1, req.body.G2);
    const startTemperatureList = [
        +req.body.T1 + 10,
        +req.body.T1 + 5,
        +req.body.T1,
        +req.body.T1,
        +req.body.T1,
    ];
    const endTemperatureList = [
        +req.body.T2,
        +req.body.T2,
        +req.body.T2,
        +req.body.T2 + 5,
        +req.body.T2 + 10,
    ];

    const startPhiList = [
        +req.body.Phi1 + 10,
        +req.body.Phi1 + 5,
        +req.body.Phi1,
        +req.body.Phi1,
        +req.body.Phi1,
    ];
    const endPhiList = [
        +req.body.Phi2,
        +req.body.Phi2,
        +req.body.Phi2,
        +req.body.Phi2 + 5,
        +req.body.Phi2 + 10,
    ];

    const resultTemperatureListT = [];
    const resultTemperatureListPhi = [];
    const resultLabelsT = ['T1 + 10°C, T2', 'T1 + 5°C, T2', 'T1, T2', 'T1, T2 + 5°C', 'T1, T2 + 10°C'];
    const resultLabelsPhi = ['Phi1 + 10%, Phi2', 'Phi1 + 5%, Phi2', 'Phi1, Phi2', 'Phi1, Phi2 + 5%', 'Phi1, Phi2 + 10%'];
    for (let i = 0; i < startTemperatureList.length; i++) {
        resultTemperatureListT.push(helpers.getSmData(
            startTemperatureList[i],
            endTemperatureList[i],
            n,
        ).toFixed(2));
        resultTemperatureListPhi.push(helpers.getSmData(
            startPhiList[i],
            endPhiList[i],
            n,
        ).toFixed(2));
    }

    res.status(200).send({
        T: {
            startList: startTemperatureList,
            endList: endTemperatureList,
            resultTemperatureList: resultTemperatureListT,
            labels: resultLabelsT,
        },
        Phi: {
            startList: startPhiList,
            endList: endPhiList,
            resultTemperatureList: resultTemperatureListPhi,
            labels: resultLabelsPhi,
        }
    });
});

app.post('/calculations/calculate-task3', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    const nozzleInfo = helpers.getFinalNozzleHeight(
        +req.body.coefs.L,
        +req.body.coefs.I1,
        +req.body.coefs.I2,
        +req.body.coefs.T2_1,
        +req.body.coefs.T2_2,
        +req.body.coefs.d,
        +req.body.coefs.S,
        +req.body.coefs.V,
    );

    db.collection('users').findOne({"_id" : mongo.ObjectID(req.body.userId)}).then(
        (user) => {
            let historyObject = {
                date: req.body.date,
                user: user,
                calculationCoefficients: {taskNum: '3', ...req.body.coefs},
                calculationResults: nozzleInfo,
            };
            db.collection("history").insertOne(historyObject);
        },
    );

    res.status(200).send(nozzleInfo);
});


app.post('/chart/task3-nozzle-surface', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    const sChangingList = [
        +req.body.S + 10,
        +req.body.S + 5,
        +req.body.S,
        +req.body.S,
        +req.body.S,
    ];
    const vChangingList = [
        +req.body.V,
        +req.body.V,
        +req.body.V,
        +req.body.V + 0.2,
        +req.body.V + 0.5
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
            vChangingList[i].toFixed(2),
        ).nozzleHeight.toFixed(2));
    }
    res.status(200).send({
        sChangingList,
        vChangingList,
        resultNozzleHeightList,
    });
});

app.post('/admin/disable-task1', bodyParser.json(), (req, res) => {
    db.collection('constants').findOne({taskNum: 1})
        .then(coefs => {
            if (!coefs) {
                res.status(404).send({
                    message: 'Something went wrong, try again later',
                });
            } else {
                db.collection('constants')
                    .updateOne({taskNum: 1}, {$set: {disableInput: req.body.isDisabled}});
                res.status(200).send();
            }
        });
});

app.post('/admin/disable-task3', bodyParser.json(), (req, res) => {
    db.collection('constants').findOne({taskNum: 3})
        .then(coefs => {
            if (!coefs) {
                res.status(404).send({
                    message: 'Something went wrong, try again later',
                });
            } else {
                db.collection('constants')
                    .updateOne({taskNum: 3}, {$set: {disableInput: req.body.isDisabled}});
                res.status(200).send();
            }
        });
});

app.post('/admin/update-task1', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    db.collection('constants').updateOne({taskNum: 1},
        {
            $set: {
                G1: req.body.G1,
                G2: req.body.G2,
                T1: req.body.T1,
                T2: req.body.T2,
                Phi1: req.body.Phi1,
                Phi2: req.body.Phi2,
            }
        }
    );
    res.status(200).send();
});

app.post('/admin/update-task3', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    db.collection('constants').updateOne({taskNum: 3},
        {
            $set: {
                  T2_1: req.body.T2_1,
                  T2_2: req.body.T2_2,
                  I1: req.body.I1,
                  I2: req.body.I2,
                  L: req.body.L,
                  S: req.body.S,
                  V: req.body.V,
                  d: req.body.d,
            }
        }
    );
    res.status(200).send();
});

app.post('/history/user-history', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    const currentPage = req.body.page - 1;
    const pagesToSkip = currentPage * req.body.perPage;

    let documentsCount;
    db.collection("history").find({"user._id" : mongo.ObjectID(req.body.userId)}).count().then((count) => documentsCount = count);
    db.collection("history").find({"user._id" : mongo.ObjectID(req.body.userId)}).skip(pagesToSkip).limit(+req.body.perPage).toArray().then((userHistory) => {
        res.status(200).send({history: userHistory, documentsCount});
    });
});

app.post('/history/admin-history', bodyParser.json(), (req, res) => {
    if(!req.body) return res.sendStatus(400);
    const currentPage = req.body.page - 1;
    const pagesToSkip = currentPage * req.body.perPage;

    let documentsCount;
    db.collection("history").find().count().then((count) => documentsCount = count);
    db.collection("history").find().skip(pagesToSkip).limit(+req.body.perPage).toArray().then((adminHistory) => {
        res.status(200).send({history: adminHistory, documentsCount});
    });
});
