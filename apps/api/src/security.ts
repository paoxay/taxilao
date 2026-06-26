import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@taxilao/shared";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

const accessSecret = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret";

export function signAccessToken(user: AuthUser) {
  return jwt.sign(user, accessSecret, { expiresIn: "15m" });
}

export function signRefreshToken(user: AuthUser) {
  return jwt.sign({ id: user.id, role: user.role }, refreshSecret, { expiresIn: "30d" });
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ message: "ບໍ່ພົບ bearer token" });
  }

  try {
    req.user = jwt.verify(token, accessSecret) as AuthUser;
    return next();
  } catch {
    return res.status(401).json({ message: "token ບໍ່ຖືກຕ້ອງ ຫຼືໝົດອາຍຸແລ້ວ" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "ສິດການໃຊ້ງານບໍ່ພຽງພໍ" });
    }

    return next();
  };
}
