import "dotenv/config";
import jwt, { type Secret } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export type AuthRequest = Request & { userId?: bigint };

const JWT_SECRET: Secret = process.env.JWT_SECRET ?? "";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "7d") as jwt.SignOptions["expiresIn"];

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in env");
}

export const signToken = (payload: { userId: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};


export const authRequired = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization; // "Bearer xxx"
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    // userId у нас BigInt → приводим
    req.userId = BigInt(decoded.userId);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};
