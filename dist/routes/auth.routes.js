"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authRouter = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(["ADMIN", "AGENT", "EMPLOYEE"]).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const buildToken = (user) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
    }, secret, { expiresIn: "7d" });
};
authRouter.post("/register", async (req, res, next) => {
    try {
        const payload = registerSchema.parse(req.body);
        const existing = await prisma_1.prisma.user.findUnique({ where: { email: payload.email } });
        if (existing) {
            return res.status(409).json({ message: "Email already in use" });
        }
        const passwordHash = await bcryptjs_1.default.hash(payload.password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: payload.name,
                email: payload.email,
                passwordHash,
                role: payload.role,
            },
        });
        const token = buildToken({ id: user.id, email: user.email, role: user.role });
        return res.status(201).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        return next(error);
    }
});
authRouter.post("/login", async (req, res, next) => {
    try {
        const payload = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { email: payload.email } });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const passwordMatch = await bcryptjs_1.default.compare(payload.password, user.passwordHash);
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = buildToken({ id: user.id, email: user.email, role: user.role });
        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (error) {
        return next(error);
    }
});
authRouter.get("/me", auth_middleware_1.requireAuth, async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id: authUser.id } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.default = authRouter;
