import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth.middleware";

const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "AGENT", "EMPLOYEE"]).optional(),
});

const imageDataUrlSchema = z
  .string()
  .max(8_000_000)
  .refine((value: string) => value.startsWith("data:image/"), {
    message: "profileImageUrl must be a valid image data URL",
  });

const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  profileImageUrl: imageDataUrlSchema.nullable().optional(),
});

usersRouter.use(requireAuth);

usersRouter.get("/", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
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
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await prisma.user.create({
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
  } catch (error) {
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

    const updatedUser = await prisma.user.update({
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
  } catch (error) {
    return next(error);
  }
});

export default usersRouter;
