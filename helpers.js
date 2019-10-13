const bcrypt = require('bcrypt');
const saltRounds = 10;

function comparePasswordsWithBcrypt(password, hash) {
    return bcrypt.compare(password, hash, (err, compareRes) => res.send(compareRes));
}