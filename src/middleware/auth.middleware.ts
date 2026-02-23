import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

type AuthTokenPayload = {
  sub: number;
  email: string;
  role: Role;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing authorization token" });
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ message: "JWT_SECRET is not configured" });
  }

  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("sub" in payload) ||
      !("email" in payload) ||
      !("role" in payload)
    ) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const typedPayload = payload as unknown as AuthTokenPayload;

    req.authUser = {
      id: Number(typedPayload.sub),
      email: typedPayload.email,
      role: typedPayload.role,
    };

    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
