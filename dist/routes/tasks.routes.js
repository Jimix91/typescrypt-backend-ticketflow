"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tasksRouter = (0, express_1.Router)();
const ticketWithUsersSelect = {
    id: true,
    ticketCode: true,
    title: true,
    description: true,
    imageUrl: true,
    status: true,
    priority: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    assignedToId: true,
    inProgressSubStatus: true,
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
    inProgressSubStatus: zod_1.z.enum(["PENDING_AGENT", "PENDING_EMPLOYEE"]).nullable().optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    assignedToId: zod_1.z.coerce.number().int().positive().nullable().optional(),
});
const updateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().nullable().optional(),
    imageUrl: imageDataUrlSchema.nullable().optional(),
    status: zod_1.z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
    inProgressSubStatus: zod_1.z.enum(["PENDING_AGENT", "PENDING_EMPLOYEE"]).nullable().optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    assignedToId: zod_1.z.coerce.number().int().positive().nullable().optional(),
});
const resolveInProgressSubStatus = (nextStatus, payloadSubStatus, currentSubStatus) => {
    if (nextStatus !== "IN_PROGRESS") {
        if (payloadSubStatus !== undefined && payloadSubStatus !== null) {
            throw new Error("inProgressSubStatus can only be set when status is IN_PROGRESS");
        }
        return null;
    }
    if (payloadSubStatus !== undefined) {
        return payloadSubStatus ?? "PENDING_AGENT";
    }
    return currentSubStatus ?? "PENDING_AGENT";
};
const statusLabelByValue = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    CLOSED: "Closed",
};
const inProgressSubStatusLabelByValue = {
    PENDING_AGENT: "Pending Agent",
    PENDING_EMPLOYEE: "Pending Employee",
};
const createCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
    imageUrl: imageDataUrlSchema.nullable().optional(),
});
const updateCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1),
});
const listTicketsQuerySchema = zod_1.z.object({
    scope: zod_1.z.enum(["active", "archived", "all"]).default("active"),
});
const CLOSED_TICKET_ARCHIVE_DAYS = 5;
const getClosedArchiveThreshold = () => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - CLOSED_TICKET_ARCHIVE_DAYS);
    return threshold;
};
const isArchivedClosedTicket = (ticket) => {
    if (ticket.status !== "CLOSED") {
        return false;
    }
    return ticket.updatedAt <= getClosedArchiveThreshold();
};
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
const generateTicketCodeCandidate = () => String((0, node_crypto_1.randomInt)(100000, 1000000));
const generateUniqueTicketCode = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const candidate = generateTicketCodeCandidate();
        const existing = await prisma_1.prisma.ticket.findUnique({
            where: { ticketCode: candidate },
            select: { id: true },
        });
        if (!existing) {
            return candidate;
        }
    }
    throw new Error("Could not generate unique ticket code");
};
tasksRouter.use(auth_middleware_1.requireAuth);
tasksRouter.get("/", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { scope } = listTicketsQuerySchema.parse(req.query);
        const archiveThreshold = getClosedArchiveThreshold();
        const visibilityWhere = authUser.role === "ADMIN"
            ? {}
            : authUser.role === "EMPLOYEE"
                ? { createdById: authUser.id }
                : { assignedToId: authUser.id };
        let scopeWhere;
        if (scope === "active") {
            scopeWhere = {
                OR: [
                    { status: { not: "CLOSED" } },
                    {
                        AND: [
                            { status: "CLOSED" },
                            { updatedAt: { gt: archiveThreshold } },
                        ],
                    },
                ],
            };
        }
        else if (scope === "archived") {
            scopeWhere = {
                status: "CLOSED",
                updatedAt: { lte: archiveThreshold },
            };
        }
        const where = scopeWhere
            ? { AND: [visibilityWhere, scopeWhere] }
            : visibilityWhere;
        const tasks = await prisma_1.prisma.ticket.findMany({
            where,
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
        const canView = canManageTicket(authUser, task);
        if (!canView) {
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
        let inProgressSubStatus;
        try {
            inProgressSubStatus = resolveInProgressSubStatus(payload.status ?? "OPEN", payload.inProgressSubStatus, null);
        }
        catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(400).json({ message: "Invalid in-progress substatus" });
        }
        const ticketCode = await generateUniqueTicketCode();
        const task = await prisma_1.prisma.ticket.create({
            data: {
                ticketCode,
                title: payload.title,
                description: payload.description,
                imageUrl: payload.imageUrl,
                status: payload.status,
                inProgressSubStatus,
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
            if (payload.inProgressSubStatus !== undefined && payload.inProgressSubStatus !== existingTask.inProgressSubStatus) {
                return res.status(403).json({ message: "Employees cannot change in-progress substatus" });
            }
        }
        const archivedClosedTicket = isArchivedClosedTicket(existingTask);
        const requestedStatus = payload.status;
        if (archivedClosedTicket &&
            requestedStatus !== undefined &&
            requestedStatus !== existingTask.status &&
            authUser.role !== "ADMIN") {
            return res.status(403).json({ message: "Only admins can change status on archived tickets" });
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
        let nextInProgressSubStatus;
        try {
            nextInProgressSubStatus = resolveInProgressSubStatus(payload.status ?? existingTask.status, payload.inProgressSubStatus, existingTask.inProgressSubStatus);
        }
        catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }
            return res.status(400).json({ message: "Invalid in-progress substatus" });
        }
        const updatedTask = await prisma_1.prisma.ticket.update({
            where: { id: ticketId },
            data: {
                title: payload.title,
                description: payload.description ?? undefined,
                imageUrl: payload.imageUrl,
                status: payload.status,
                inProgressSubStatus: nextInProgressSubStatus,
                priority: payload.priority,
                assignedToId: payload.assignedToId,
            },
            select: ticketWithUsersSelect,
        });
        const nextStatus = payload.status ?? existingTask.status;
        const statusChanged = nextStatus !== existingTask.status;
        const subStatusChanged = nextStatus === "IN_PROGRESS" &&
            nextInProgressSubStatus !== existingTask.inProgressSubStatus;
        if (statusChanged || subStatusChanged) {
            const statusLabel = statusLabelByValue[nextStatus];
            const subStatusLabel = nextStatus === "IN_PROGRESS" && nextInProgressSubStatus
                ? ` - ${inProgressSubStatusLabelByValue[nextInProgressSubStatus]}`
                : "";
            await prisma_1.prisma.comment.create({
                data: {
                    content: `Changed status to ${statusLabel}${subStatusLabel}`,
                    ticketId,
                    authorId: authUser.id,
                },
            });
        }
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
        if (authUser.role === "EMPLOYEE") {
            return res.status(403).json({ message: "Employees cannot delete tickets" });
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
        if (ticket.status === "IN_PROGRESS") {
            const nextInProgressSubStatus = authUser.role === "AGENT"
                ? "PENDING_EMPLOYEE"
                : authUser.role === "EMPLOYEE"
                    ? "PENDING_AGENT"
                    : ticket.inProgressSubStatus;
            if (nextInProgressSubStatus !== ticket.inProgressSubStatus) {
                await prisma_1.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { inProgressSubStatus: nextInProgressSubStatus },
                });
            }
        }
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
tasksRouter.put("/:id/comments/:commentId", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const ticketId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return res.status(400).json({ message: "Invalid ticket id" });
        }
        if (!Number.isInteger(commentId) || commentId <= 0) {
            return res.status(400).json({ message: "Invalid comment id" });
        }
        const payload = updateCommentSchema.parse(req.body);
        const comment = await prisma_1.prisma.comment.findFirst({
            where: { id: commentId, ticketId },
        });
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        const canEditComment = authUser.role === "ADMIN" || comment.authorId === authUser.id;
        if (!canEditComment) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const updatedComment = await prisma_1.prisma.comment.update({
            where: { id: commentId },
            data: {
                content: payload.content,
            },
            include: {
                author: true,
            },
        });
        return res.json(updatedComment);
    }
    catch (error) {
        return next(error);
    }
});
tasksRouter.delete("/:id/comments/:commentId", async (req, res, next) => {
    try {
        const authUser = req.authUser;
        if (!authUser) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const ticketId = Number(req.params.id);
        const commentId = Number(req.params.commentId);
        if (!Number.isInteger(ticketId) || ticketId <= 0) {
            return res.status(400).json({ message: "Invalid ticket id" });
        }
        if (!Number.isInteger(commentId) || commentId <= 0) {
            return res.status(400).json({ message: "Invalid comment id" });
        }
        const comment = await prisma_1.prisma.comment.findFirst({
            where: { id: commentId, ticketId },
        });
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }
        const canDeleteComment = authUser.role === "ADMIN" || comment.authorId === authUser.id;
        if (!canDeleteComment) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_1.prisma.comment.delete({ where: { id: commentId } });
        return res.status(204).send();
    }
    catch (error) {
        return next(error);
    }
});
exports.default = tasksRouter;
