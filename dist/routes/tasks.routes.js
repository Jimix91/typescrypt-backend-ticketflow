"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tasksRouter = (0, express_1.Router)();
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    status: zod_1.z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    assignedToId: zod_1.z.coerce.number().int().positive().nullable().optional(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().nullable().optional(),
    status: zod_1.z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    assignedToId: zod_1.z.coerce.number().int().positive().nullable().optional(),
});
const createCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
});
tasksRouter.use(auth_middleware_1.requireAuth);
tasksRouter.get("/", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const tasks = await prisma_1.prisma.ticket.findMany({
            where: authUser.role === "ADMIN"
                ? undefined
                : {
                    OR: [
                        { createdById: authUser.id },
                        { assignedToId: authUser.id },
                    ],
                },
            include: {
                createdBy: true,
                assignedTo: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(tasks);
    }
    catch (error) {
        next(error);
    }
});
tasksRouter.get("/:id", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const ticketId = Number(req.params.id);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return res.status(400).json({ message: "Invalid ticket id" });
        }
        const task = await prisma_1.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                createdBy: true,
                assignedTo: true,
            },
        });
        if (!task) {
            return res.status(404).json({ message: "Ticket not found" });
        }
        const canAccess = authUser.role === "ADMIN" ||
            task.createdById === authUser.id ||
            task.assignedToId === authUser.id;
        if (!canAccess) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(task);
    }
    catch (error) {
        return next(error);
    }
});
tasksRouter.post("/", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const payload = createTaskSchema.parse(req.body);
        const task = await prisma_1.prisma.ticket.create({
            data: {
                title: payload.title,
                description: payload.description,
                status: payload.status,
                priority: payload.priority,
                createdById: authUser.id,
                assignedToId: payload.assignedToId,
            },
        });
        res.status(201).json(task);
    }
    catch (error) {
        next(error);
    }
});
tasksRouter.put("/:id", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const ticketId = Number(req.params.id);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return res.status(400).json({ message: "Invalid ticket id" });
        }
        const payload = updateTaskSchema.parse(req.body);
        const existingTask = await prisma_1.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!existingTask) {
            return res.status(404).json({ message: "Ticket not found" });
        }
        const canEdit = authUser.role === "ADMIN" ||
            existingTask.createdById === authUser.id ||
            existingTask.assignedToId === authUser.id;
        if (!canEdit) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const updatedTask = await prisma_1.prisma.ticket.update({
            where: { id: ticketId },
            data: {
                title: payload.title,
                description: payload.description,
                status: payload.status,
                priority: payload.priority,
                assignedToId: payload.assignedToId,
            },
        });
        return res.json(updatedTask);
    }
    catch (error) {
        return next(error);
    }
});
tasksRouter.delete("/:id", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const ticketId = Number(req.params.id);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return res.status(400).json({ message: "Invalid ticket id" });
        }
        const existingTask = await prisma_1.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!existingTask) {
            return res.status(404).json({ message: "Ticket not found" });
        }
        const canDelete = authUser.role === "ADMIN" || existingTask.createdById === authUser.id;
        if (!canDelete) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_1.prisma.ticket.delete({ where: { id: ticketId } });
        return res.status(204).send();
    }
    catch (error) {
        return next(error);
    }
});
tasksRouter.post("/:id/comments", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const ticketId = Number(req.params.id);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return res.status(400).json({ message: "Invalid ticket id" });
        }
        const payload = createCommentSchema.parse(req.body);
        const ticket = await prisma_1.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
        }
        const canComment = authUser.role === "ADMIN" ||
            ticket.createdById === authUser.id ||
            ticket.assignedToId === authUser.id;
        if (!canComment) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const comment = await prisma_1.prisma.comment.create({
            data: {
                content: payload.content,
                ticketId,
                authorId: authUser.id,
            },
            include: {
                author: true,
            },
        });
        return res.status(201).json(comment);
    }
    catch (error) {
        return next(error);
    }
});
tasksRouter.get("/:id/comments", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const ticketId = Number(req.params.id);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return res.status(400).json({ message: "Invalid ticket id" });
        }
        const ticket = await prisma_1.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) {
            return res.status(404).json({ message: "Ticket not found" });
        }
        const canReadComments = authUser.role === "ADMIN" ||
            ticket.createdById === authUser.id ||
            ticket.assignedToId === authUser.id;
        if (!canReadComments) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const comments = await prisma_1.prisma.comment.findMany({
            where: { ticketId },
            include: { author: true },
            orderBy: { createdAt: "asc" },
        });
        return res.json(comments);
    }
    catch (error) {
        return next(error);
    }
});
exports.default = tasksRouter;
