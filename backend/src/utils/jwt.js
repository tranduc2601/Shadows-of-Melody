import jwt from 'jsonwebtoken';
import config from '../config/env.js';

const generateToken = (payload) => {
    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
    });
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, config.jwt.secret);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

const decodeToken = (token) => {
    return jwt.decode(token);
};

export { generateToken, verifyToken, decodeToken };
