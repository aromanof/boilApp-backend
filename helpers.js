const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const fs = require('fs');
const RSA_PRIVATE_KEY = fs.readFileSync('./private-rsa.key');
const RSA_PUBLIC_KEY = fs.readFileSync('./public-rsa.key');

var exports = module.exports = {};

exports.getJWTByUserId = (userId) => {
    return jwt.sign({}, RSA_PRIVATE_KEY, {
        algorithm: 'RS256',
        expiresIn: 120,
        subject: userId
    });
}

exports.verifyJWT = (token) => {
    return jwt.verify(token, RSA_PUBLIC_KEY, function(err, decoded) {
        if (err) throw err;
        console.log(decoded);
        return decoded.sub;
    });
}
