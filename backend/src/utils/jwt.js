import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { blockToken, isBlocked } from './tokenBlocklist.js';

const generateToken = (payload) => {
    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    });
};

const verifyToken = (token) => {
    if (isBlocked(token)) {
        throw new Error('Token has been revoked');
    }
    try {
        return jwt.verify(token, config.jwt.secret);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

const decodeToken = (token) => {
    return jwt.decode(token);
};







const revokeToken = (token, decoded) => {
    const payload = decoded ?? decodeToken(token);
    blockToken(token, payload?.exp);
};

export { generateToken, verifyToken, decodeToken, revokeToken };
