const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const fs = require('fs');
const irrigationHelper = require('./irrigation-table');
const RSA_PRIVATE_KEY = fs.readFileSync('./private-rsa.key');
const RSA_PUBLIC_KEY = fs.readFileSync('./public-rsa.key');

const alphaWater = 17.504;
const betaWater = 241.2;

const RoVl = 0.86;
const RoJ = 993;
const g = 9.8;
const MuVl = 20.6 * Math.pow(10, -6);
const c = 4.187;

const v = 1.16;
const w = 1.5;

const prandalCryteria = 0.68;
const volumeSteamConsistensionForAverage = 0.112;
const volumeAirConsistensionForAverage = 0.878;

// Taverage = 102, Tj = 20
const averageSteamConcentration = 0.035

const skrubberDeltaT = 54;

const cinematicViscosity = MuVl / RoVl;

var exports = module.exports = {};

exports.getJWTByUserId = (userId) => {
    return jwt.sign({}, RSA_PRIVATE_KEY, {
        algorithm: 'RS256',
        expiresIn: "7d",
        subject: userId,
    });
}

exports.verifyJWT = (token) => {
    return jwt.verify(token, RSA_PUBLIC_KEY, function(err, decoded) {
        if (err) throw err;
        console.log(decoded);
        return decoded.sub;
    });
}

exports.calculateIDDiagram = (t, phi, pBarometral) => {
    const pSaturated = 0.6112 * Math.exp((alphaWater * t) / (betaWater + t));
    const pPartial = (phi * pSaturated) / 100;
    const d = (621.98 * (pPartial / (pBarometral - pPartial))) / 1000;
    const i = 1.006 * t + d * (2501 + 1.805 * t);
    return {
        d, i,
    }
};

exports.getN = (G1, G2) => {
    return G2/G1;
};

exports.getSmData = (item1, item2, n) => {
    return (item1 + n * item2) / (1 + n);
};

exports.getWarmthQuantity = (L, I1, I2) => {
    return L * (I1 - I2);
};

exports.getCoolingWaterConsumption = (Q, T2_1, T2_2) => {
    return Q / (c * (T2_2 - T2_1));
};

exports.getOptimalAirSpeed = (d) => {
    return (Math.pow(d, 3) * RoVl * (RoJ - RoVl) * g) / Math.pow(MuVl, 2);
};

exports.getReynoldsCryteria = (Ar, G, L) => {
    return 0.045 * Math.pow(Ar, 0.57) * (G / L);
};

exports.getOptimalSpeed = (Re, d) => {
    return (Re * MuVl) / (d * RoVl);
};

exports.getWAirSpeed = (wOptimalSpeed, V) => {
    return Number(wOptimalSpeed * V).toFixed(1);
};

// wAirSpeed - скорость воздуха в свободном сечении скруббера (0.5 * оптимальную скорость)
exports.getSkooberDiametr = (G, wAirSpeed) => {

    return Math.sqrt((4 * G * v) / (wAirSpeed * Math.PI * 3600));
};

exports.getFreeAirSpeed = (G, D) => {
    return G / (3600 * (Math.PI * (Math.pow(D, 2) / 4) * RoVl * 0.5));
};

exports.getReynoldsCryteriaForGas = (wFree, d) => {
    return (wFree * d) / cinematicViscosity;
};

exports.getIrrigationDensity = (G, D) => {
    return Math.round((4 * G) / (Math.PI * Math.pow(D, 2) * RoJ));
};

exports.getReynoldsCryteriaForLiquid = (Hw, d) => {
    return (Hw * d) / (3600 * Math.pow(10, -6));
};

exports.getHeatTransferCoefficient = (d, Re, ReJ) => {
  return 0.0024 * (0.032 / d) * Math.pow(Re, 0.7)
      * Math.pow(prandalCryteria, 0.33) * Math.pow(ReJ, 0.7) * (1 + 130 * averageSteamConcentration);
};

exports.getWettabilityCoefficient = (S, Hw) => {
    return Math.cbrt(S) / irrigationHelper.getIrrigationValue(Hw);
};

exports.getScrooberNozzleVolume = (Q, wettabilityCoef, Alpha, S) => {
    return Q / (Alpha * skrubberDeltaT *  S * wettabilityCoef);
};

exports.getNozzleHeight = (D, NozzleVolume) => {
    return (4 * NozzleVolume) / (Math.PI * Math.pow(D, 2));
};

exports.kDjToWt = (kDj) => {
    const coef = 0.277777778;
    return kDj * coef;
};


exports.getFinalNozzleHeight = (L, I1, I2, T2_1, T2_2, d, S, V) => {
    const airWarmthFromScroober = exports.getWarmthQuantity(L, I1, I2);
    const coolingWaterConsumption = exports.getCoolingWaterConsumption(airWarmthFromScroober, T2_1, T2_2);
    const Ar = exports.getOptimalAirSpeed(d);
    const Re = exports.getReynoldsCryteria(Ar, coolingWaterConsumption, L);
    const wOptimal = exports.getOptimalSpeed(Re, d);
    const wAirSpeed = exports.getWAirSpeed(wOptimal, V);
    const skooberDiametr = exports.getSkooberDiametr(coolingWaterConsumption, wAirSpeed);
    const freeAirSpeed = exports.getFreeAirSpeed(coolingWaterConsumption, skooberDiametr);
    const reynoldsCryteriaForGas = exports.getReynoldsCryteriaForGas(freeAirSpeed, d);
    const irrigationDensity = exports.getIrrigationDensity(coolingWaterConsumption, skooberDiametr);
    const reynoldsCryteriaForLiquid = exports.getReynoldsCryteriaForLiquid(irrigationDensity, d);
    const heatTransferCoefficient = exports.getHeatTransferCoefficient(d, reynoldsCryteriaForGas, reynoldsCryteriaForLiquid);
    const wettabilityCoefficient = exports.getWettabilityCoefficient(S, irrigationDensity);
    const nozzleVolume = exports.getScrooberNozzleVolume(
        exports.kDjToWt(airWarmthFromScroober),
        wettabilityCoefficient,
        heatTransferCoefficient,
        S,
    );
    const nozzleHeight = exports.getNozzleHeight(skooberDiametr, nozzleVolume);

    return {
        skooberDiametr,
        nozzleVolume,
        nozzleHeight,
    }
};
