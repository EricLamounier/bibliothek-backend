const jwt = require('jsonwebtoken');
const dotenv = require('dotenv')

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET

export const createJWT = async (userID : number | string) => {
    const token = jwt.sign({ userID }, JWT_SECRET, {expiresIn: '30d'});
    return token;
};

export const verifyJWT = async (userJWT : string) => {
    return await jwt.verify(userJWT, JWT_SECRET, (err : string, decoded : string) => {
        if(err) {
            return null;
        }
        return decoded;
    });
};