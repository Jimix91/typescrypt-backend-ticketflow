"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const tasks_routes_1 = __importDefault(require("./routes/tasks.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const error_handler_1 = require("./middleware/error-handler");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
}));
app.use(express_1.default.json());
app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});
app.use("/api/users", users_routes_1.default);
app.use("/api/tasks", tasks_routes_1.default);
app.use("/api/tickets", tasks_routes_1.default);
app.use("/users", users_routes_1.default);
app.use("/tickets", tasks_routes_1.default);
app.use(error_handler_1.errorHandler);
exports.default = app;
