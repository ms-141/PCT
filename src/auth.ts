// Authentication middleware and helpers

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = "pct-secret-key";
const SALT_ROUNDS = 10;

// Password Hashing

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// JWT Token

export function createToken(userId: number): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: number };
    } catch {
        return null;
    }
}

// Middleware

declare global {
    namespace Express {
        interface Request {
            userId?: number;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "No token provided. Please log in." });
        return;
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);

    if (!payload) {
        res.status(401).json({ error: "Invalid or expired token. Please log in again." });
        return;
    }

    req.userId = payload.userId;
    next();
}
