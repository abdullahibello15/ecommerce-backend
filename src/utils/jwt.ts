import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';

export const generateAccessToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

export const verifyRefreshToken = (token: string): AuthPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as AuthPayload;
};
