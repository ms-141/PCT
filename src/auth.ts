// Authentication middleware and helpers

// Handles password hashing (bcrypt) and JWT token creation/verification.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { Request, Response, NextFunction } from "express";

// Secret key for signing JWT tokens
const envJwtSecret = process.env.JWT_SECRET;
if (!envJwtSecret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production.");
}
const JWT_SECRET = envJwtSecret || randomBytes(32).toString("hex");
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

// Checks for a valid JWT token
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