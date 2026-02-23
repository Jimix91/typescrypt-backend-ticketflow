import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const tasksRouter = Router();

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().datetime().optional(),
  userId: z.string().uuid(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

tasksRouter.get("/", async (_req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

tasksRouter.get("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    return res.json(task);
  } catch (error) {
    return next(error);
  }
});

tasksRouter.post("/", async (req, res, next) => {
  try {
    const payload = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        title: payload.title,
        description: payload.description,
        completed: payload.completed ?? false,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
        userId: payload.userId,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

tasksRouter.put("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const payload = updateTaskSchema.parse(req.body);

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: payload.title,
        description: payload.description,
        completed: payload.completed,
        dueDate:
          payload.dueDate === undefined
            ? undefined
            : payload.dueDate === null
              ? null
              : new Date(payload.dueDate),
      },
    });

    return res.json(updatedTask);
  } catch (error) {
    return next(error);
  }
});

tasksRouter.delete("/:taskId", async (req, res, next) => {
  try {
    const { taskId } = req.params;

    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    await prisma.task.delete({ where: { id: taskId } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default tasksRouter;
