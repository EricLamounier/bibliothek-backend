const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

dotenv.config()
const PRIVATE_KEY = fs.readFileSync(path.join(__dirname, '../../private.key'), 'utf8');
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../../public.key'), 'utf8');

export const createJWT = async (funcionario: number | string) => {
  return jwt.sign({ funcionario }, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: '1h',
  });
};

export const createRefreshToken = async (jwt: string) => {
  return {
    refresh: crypto.createHash('md5').update(jwt).digest("hex"),
    expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias
  }
};

export const verifyJWT = async (token: string) => {
  try {
    return jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
  } catch {
    console.log('Invalid JWT Token!')
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