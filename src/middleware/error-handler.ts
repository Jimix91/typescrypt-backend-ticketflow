import { NextFunction, Request, Response } from "express";

const hasZodIssues = (value: unknown): value is { issues: unknown[] } => {
  return (
    typeof value === "object" &&
    value !== null &&
    "issues" in value &&
    Array.isArray((value as { issues: unknown[] }).issues)
  );
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (hasZodIssues(error)) {
    res.status(400).json({ message: "Validation error", errors: error.issues });
    return;
  }

  if (error instanceof Error) {
    res.status(500).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: "Unexpected error" });
};
