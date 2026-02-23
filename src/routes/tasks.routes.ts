import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const tasksRouter = Router();

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  createdById: z.coerce.number().int().positive(),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
});

tasksRouter.get("/", async (_req, res, next) => {
  try {
    const tasks = await prisma.ticket.findMany({
      include: {
        createdBy: true,
        assignedTo: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

tasksRouter.get("/:taskId", async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }
    const task = await prisma.ticket.findUnique({
      where: { id: taskId },
      include: {
        createdBy: true,
        assignedTo: true,
      },
    });

    if (!task) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    return res.json(task);
  } catch (error) {
    return next(error);
  }
});

tasksRouter.post("/", async (req, res, next) => {
  try {
    const payload = createTaskSchema.parse(req.body);

    const task = await prisma.ticket.create({
      data: {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        createdById: payload.createdById,
        assignedToId: payload.assignedToId,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

tasksRouter.put("/:taskId", async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }
    const payload = updateTaskSchema.parse(req.body);

    const existingTask = await prisma.ticket.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const updatedTask = await prisma.ticket.update({
      where: { id: taskId },
      data: {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        assignedToId: payload.assignedToId,
      },
    });

    return res.json(updatedTask);
  } catch (error) {
    return next(error);
  }
});

tasksRouter.delete("/:taskId", async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const existingTask = await prisma.ticket.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    await prisma.ticket.delete({ where: { id: taskId } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default tasksRouter;
