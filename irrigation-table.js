var exports = module.exports = {};

exports.getIrrigationValue = (Hw) => {
    switch (Hw) {
        case 1:
            return 24;
            break;
        case 2:
            return 15;
            break;
        case 4:
            return 9.8;
            break;
        case 6:
            return 7.5;
            break;
        case 8:
            return 6.6;
            break;
        case 10:
            return 6;
            break;
        case 15:
            return 5.3;
            break;
        case 20:
            return 4.8;
            break;
        case 30:
            return 4.4;
            break;
        case 40:
            return 4.2;
            break;
        case 60:
            return 3.8;
            break;
        default:
            return null;
            break;
    }
};
