"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const usersRouter = (0, express_1.Router)();
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(["ADMIN", "AGENT", "EMPLOYEE"]).optional(),
});
const imageDataUrlSchema = zod_1.z
    .string()
    .max(8000000)
    .refine((value) => value.startsWith("data:image/"), {
    message: "profileImageUrl must be a valid image data URL",
});
const updateMeSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    profileImageUrl: imageDataUrlSchema.nullable().optional(),
});
usersRouter.use(auth_middleware_1.requireAuth);
usersRouter.get("/", async (_req, res, next) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                profileImageUrl: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(users);
    }
    catch (error) {
        next(error);
    }
});
usersRouter.post("/", async (req, res, next) => {
    try {
        const payload = createUserSchema.parse(req.body);
        const passwordHash = await bcryptjs_1.default.hash(payload.password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: payload.name,
                email: payload.email,
                passwordHash,
                role: payload.role,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                profileImageUrl: true,
                createdAt: true,
            },
        });
        res.status(201).json(user);
    }
    catch (error) {
        next(error);
    }
});
usersRouter.patch("/me", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const payload = updateMeSchema.parse(req.body);
        const updatedUser = await prisma_1.prisma.user.update({
            where: { id: authUser.id },
            data: {
                name: payload.name,
                profileImageUrl: payload.profileImageUrl,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                profileImageUrl: true,
            },
        });
        return res.json(updatedUser);
    }
    catch (error) {
        return next(error);
    }
});
exports.default = usersRouter;
