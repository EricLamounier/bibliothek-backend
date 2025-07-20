const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET

export const createJWT = async (funcionarioID : number | string) => {
    const token = jwt.sign({ funcionarioID }, JWT_SECRET, {expiresIn: '30d'});
    return token;
};

export const verifyJWT = async (funcionarioJWT : string) => {
    return await jwt.verify(funcionarioJWT, JWT_SECRET, (err : string, decoded : string) => {
        if(err) {
            return null;
        }
        return decoded;
    });
};

export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 9);
};

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
};