import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import authRouter from "./routes/auth.routes";
import tasksRouter from "./routes/tasks.routes";
import usersRouter from "./routes/users.routes";
import { errorHandler } from "./middleware/error-handler";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  }),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/tickets", tasksRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/tickets", tasksRouter);

app.use(errorHandler);

export default app;
