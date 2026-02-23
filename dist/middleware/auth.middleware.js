"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const requireAuth = (req, res, next) => {
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
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (typeof payload !== "object" ||
            payload === null ||
            !("sub" in payload) ||
            !("email" in payload) ||
            !("role" in payload)) {
            return res.status(401).json({ message: "Invalid token payload" });
        }
        const typedPayload = payload;
        req.authUser = {
            id: Number(typedPayload.sub),
            email: typedPayload.email,
            role: typedPayload.role,
        };
        return next();
    }
    catch (_error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.requireAuth = requireAuth;
