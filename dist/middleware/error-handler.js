"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const hasZodIssues = (value) => {
    return (typeof value === "object" &&
        value !== null &&
        "issues" in value &&
        Array.isArray(value.issues));
};
const errorHandler = (error, _req, res, _next) => {
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
exports.errorHandler = errorHandler;
