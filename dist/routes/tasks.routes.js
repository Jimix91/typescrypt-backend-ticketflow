"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tasksRouter = (0, express_1.Router)();
const ticketWithUsersSelect = {
    id: true,
    title: true,
    description: true,
    imageUrl: true,
    status: true,
    priority: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    assignedToId: true,
    createdBy: {
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            profileImageUrl: true,
        },
    },
    assignedTo: {
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            profileImageUrl: true,
        },
    },
};
const imageDataUrlSchema = zod_1.z
    .string()
    .max(8000000)
    .refine((value) => value.startsWith("data:image/"), {
    message: "imageUrl must be a valid image data URL",
});
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    imageUrl: imageDataUrlSchema.nullable().optional(),
    status: zod_1.z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    assignedToId: zod_1.z.coerce.number().int().positive().nullable().optional(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().nullable().optional(),
    imageUrl: imageDataUrlSchema.nullable().optional(),
    status: zod_1.z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    assignedToId: zod_1.z.coerce.number().int().positive().nullable().optional(),
});
const createCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
    imageUrl: imageDataUrlSchema.nullable().optional(),
});
const canManageTicket = (authUser, ticket) => {
    if (authUser.role === "ADMIN") {
        return true;
    }
    if (authUser.role === "EMPLOYEE") {
        return ticket.createdById === authUser.id;
    }
    return ticket.assignedToId === authUser.id;
};
const validateAgentAssignee = async (assignedToId) => {
    if (!assignedToId) {
        return;
    }
    const assignedUser = await prisma_1.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, role: true },
    });
    if (!assignedUser || assignedUser.role !== "AGENT") {
        throw new Error("Assigned user must be an AGENT");
    }
};
tasksRouter.use(auth_middleware_1.requireAuth);
tasksRouter.get("/", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const tasks = await prisma_1.prisma.ticket.findMany({
            select: ticketWithUsersSelect,
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
            select: ticketWithUsersSelect,
        });
        if (!task) {
            return res.status(404).json({ message: "Ticket not found" });
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
        if (authUser.role === "EMPLOYEE" && payload.status && payload.status !== "OPEN") {
            return res.status(403).json({ message: "Employees cannot set ticket status" });
        }
        try {
            await validateAgentAssignee(payload.assignedToId);
        }
        catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(400).json({ message: "Invalid assignee" });
        }
        const task = await prisma_1.prisma.ticket.create({
            data: {
                title: payload.title,
                description: payload.description,
                imageUrl: payload.imageUrl,
                status: payload.status,
                priority: payload.priority,
                createdById: authUser.id,
                assignedToId: payload.assignedToId,
            },
            select: ticketWithUsersSelect,
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
        const canEdit = canManageTicket(authUser, existingTask);
        if (!canEdit) {
            return res.status(403).json({ message: "Forbidden" });
        }
        if (authUser.role === "EMPLOYEE") {
            if (payload.assignedToId !== undefined && payload.assignedToId !== existingTask.assignedToId) {
                return res.status(403).json({ message: "Employees cannot reassign tickets" });
            }
            if (payload.status !== undefined && payload.status !== existingTask.status) {
                return res.status(403).json({ message: "Employees cannot change ticket status" });
            }
        }
        try {
            await validateAgentAssignee(payload.assignedToId);
        }
        catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(400).json({ message: "Invalid assignee" });
        }
        const updatedTask = await prisma_1.prisma.ticket.update({
            where: { id: ticketId },
            data: {
                title: payload.title,
                description: payload.description,
                imageUrl: payload.imageUrl,
                status: payload.status,
                priority: payload.priority,
                assignedToId: payload.assignedToId,
            },
            select: ticketWithUsersSelect,
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
        const canDelete = canManageTicket(authUser, existingTask);
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
        const canComment = canManageTicket(authUser, ticket);
        if (!canComment) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const comment = await prisma_1.prisma.comment.create({
            data: {
                content: payload.content,
                imageUrl: payload.imageUrl,
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
