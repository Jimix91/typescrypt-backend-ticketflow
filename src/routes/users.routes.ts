import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

usersRouter.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: { tasks: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const user = await prisma.user.create({ data: payload });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

export default usersRouter;
