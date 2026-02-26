import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth.middleware";

const tasksRouter = Router();

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
} as const;

const imageDataUrlSchema = z
  .string()
  .max(8_000_000)
  .refine((value: string) => value.startsWith("data:image/"), {
    message: "imageUrl must be a valid image data URL",
  });

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  imageUrl: imageDataUrlSchema.nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  imageUrl: imageDataUrlSchema.nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedToId: z.coerce.number().int().positive().nullable().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1),
  imageUrl: imageDataUrlSchema.nullable().optional(),
});

const canManageTicket = (authUser: { id: number; role: "ADMIN" | "AGENT" | "EMPLOYEE" }, ticket: { createdById: number; assignedToId: number | null }) => {
  if (authUser.role === "ADMIN") {
    return true;
  }

  if (authUser.role === "EMPLOYEE") {
    return ticket.createdById === authUser.id;
  }

  return ticket.assignedToId === authUser.id;
};

const validateAgentAssignee = async (assignedToId: number | null | undefined) => {
  if (!assignedToId) {
    return;
  }

  const assignedUser = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { id: true, role: true },
  });

  if (!assignedUser || assignedUser.role !== "AGENT") {
    throw new Error("Assigned user must be an AGENT");
  }
};

tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req, res, next) => {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const tasks = await prisma.ticket.findMany({
      select: ticketWithUsersSelect,
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (error) {
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
    const task = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: ticketWithUsersSelect,
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
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(400).json({ message: "Invalid assignee" });
    }

    const task = await prisma.ticket.create({
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
  } catch (error) {
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

    const existingTask = await prisma.ticket.findUnique({ where: { id: ticketId } });
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
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(400).json({ message: "Invalid assignee" });
    }

    const updatedTask = await prisma.ticket.update({
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
  } catch (error) {
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

    const existingTask = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existingTask) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const canDelete = canManageTicket(authUser, existingTask);
    if (!canDelete) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.ticket.delete({ where: { id: ticketId } });
    return res.status(204).send();
  } catch (error) {
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

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const canComment = canManageTicket(authUser, ticket);

    if (!canComment) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const comment = await prisma.comment.create({
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
  } catch (error) {
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

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId },
      include: { author: true },
      orderBy: { createdAt: "asc" },
    });

    return res.json(comments);
  } catch (error) {
    return next(error);
  }
});

export default tasksRouter;
