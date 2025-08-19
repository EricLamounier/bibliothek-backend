const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

dotenv.config()
const PRIVATE_KEY = fs.readFileSync(path.join(__dirname, '../../private.key'), 'utf8');
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../../public.key'), 'utf8');

export const createJWT = async (funcionarioID: number | string) => {
  return jwt.sign({ funcionarioID }, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: '30d',
  });
};

export const verifyJWT = async (token: string) => {
  try {
    console.log(jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }))
    return jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
  } catch {
    return null;
  }
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 9);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}


/*


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
};*/