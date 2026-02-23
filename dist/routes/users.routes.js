"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const usersRouter = (0, express_1.Router)();
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
});
usersRouter.get("/", async (_req, res, next) => {
    try {
        const users = await prisma_1.prisma.user.findMany({
            include: { tasks: true },
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
        const user = await prisma_1.prisma.user.create({ data: payload });
        res.status(201).json(user);
    }
    catch (error) {
        next(error);
    }
});
exports.default = usersRouter;
