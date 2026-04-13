// Express API server for PCT

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { initDatabase, importFromJson, getCourseDetail, searchCourses, getProgress, setProgress, createUser, getUserByEmail, getUserById, setUserMajor, getDeepPrereqChain } from "./database";
import { ProgressUpdate } from "./types";
import { hashPassword, comparePassword, createToken, requireAuth } from "./auth";

const app = express();
const PORT = 3000;

// Cached programs.json data for major filtering
let programsCache: Record<string, any> | null = null;

function getMajorCodes(majorKey: string): Set<string> | null {
    if (!programsCache) {
        try {
            const p = path.join(__dirname, "..", "public", "programs.json");
            programsCache = JSON.parse(fs.readFileSync(p, "utf-8"));
        } catch {
            return null;
        }
    }
    const prog = programsCache![majorKey];
    if (!prog || !prog.categories) return null;
    const codes = new Set<string>();
    for (const catKey in prog.categories) {
        for (const c of (prog.categories[catKey].courses as string[])) codes.add(c);
    }
    return codes;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ==============================
// Auth Routes (FR3)
// ==============================

// Register a new account
app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
        res.status(400).json({ success: false, error: "Email, username, and password are required." });
        return;
    }

    if (password.length < 6) {
        res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
        return;
    }

    const existing = getUserByEmail(email);
    if (existing) {
        res.status(400).json({ success: false, error: "An account with this email already exists." });
        return;
    }

    const passwordHash = await hashPassword(password);
    const userId = createUser(email, username, passwordHash);

    if (!userId) {
        res.status(500).json({ success: false, error: "Failed to create account." });
        return;
    }

    const token = createToken(userId);
    res.json({ success: true, token, user: { id: userId, email, username, major: '' } });
});

// Login
app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ success: false, error: "Email and password are required." });
        return;
    }

    const user = getUserByEmail(email);
    if (!user) {
        res.status(401).json({ success: false, error: "Invalid email or password." });
        return;
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
        res.status(401).json({ success: false, error: "Invalid email or password." });
        return;
    }

    const token = createToken(user.id);
    res.json({ success: true, token, user: { id: user.id, email: user.email, username: user.username, major: user.major } });
});

// Get current user info (verify token)
app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    const user = getUserById(req.userId!);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    res.json({ id: user.id, email: user.email, username: user.username, major: user.major });
});

// Set user's major
app.post("/api/auth/major", requireAuth, (req: Request, res: Response) => {
    const { major } = req.body;
    if (major === undefined) {
        res.status(400).json({ error: "major is required" });
        return;
    }
    setUserMajor(req.userId!, major);
    res.json({ success: true, major });
});

// ==============================
// Course Routes (public)
// ==============================

// Batch fetch course titles — POST /api/courses/batch  body: { codes: ["COMP 2631", "COMP 1633"] }
app.post("/api/courses/batch", (req: Request, res: Response) => {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes)) { res.json({}); return; }
    const result: Record<string, string> = {};
    codes.forEach((code: string) => {
        const course = getCourseDetail(code);
        result[code] = course ? course.course_title : "Not in catalog";
    });
    res.json(result);
});

app.get("/api/courses/search", (req: Request, res: Response) => {
    const query = (req.query.q as string) || "";
    if (!query || query.length < 2) { res.json([]); return; }
    res.json(searchCourses(query));
});

// Deep prerequisite/unlock tree  GET /api/courses/:code/tree?depth=4&major=cs
app.get("/api/courses/:code/tree", (req: Request, res: Response) => {
    const code = req.params.code as string;
    const depth = Math.min(Math.max(parseInt((req.query.depth as string) || "4") || 4, 1), 6);
    const majorKey = (req.query.major as string) || "";

    const detail = getCourseDetail(code);
    if (!detail) { res.status(404).json({ error: "Course not found" }); return; }

    const majorCodes = majorKey ? getMajorCodes(majorKey) : null;

    res.json({
        course_code: code,
        course_title: detail.course_title,
        prereqs: getDeepPrereqChain(code, 'prereqs', depth),
        unlocks: getDeepPrereqChain(code, 'unlocks', depth, majorCodes),
    });
});

app.get("/api/courses/:code", (req: Request, res: Response) => {
    const code = req.params.code as string;
    const course = getCourseDetail(code);
    if (!course) { res.status(404).json({ error: "Course not found" }); return; }
    res.json(course);
});

// ==============================
// Progress Routes (protected — requires login)
// ==============================

app.get("/api/progress", requireAuth, (req: Request, res: Response) => {
    res.json(getProgress(req.userId!));
});

app.post("/api/progress", requireAuth, (req: Request, res: Response) => {
    const { course_code, status } = req.body as ProgressUpdate;
    if (!course_code) { res.status(400).json({ error: "course_code is required" }); return; }
    const validStatuses = ["completed", "in-progress", "planned", ""];
    if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status." }); return; }
    setProgress(req.userId!, course_code, status);
    res.json({ success: true, course_code, status });
});

// Import route
app.post("/api/import", (req: Request, res: Response) => {
    const jsonPath = path.join(__dirname, "..", "pct.json");
    try {
        const count = importFromJson(jsonPath);
        res.json({ success: true, courses_imported: count });
    } catch (err) {
        res.status(500).json({ error: "Failed to import: " + err });
    }
});

// ==============================
// Start Server
// ==============================

async function start() {
    await initDatabase();

    const testCourse = getCourseDetail("COMP 1633");
    if (!testCourse) {
        const jsonPath = path.join(__dirname, "..", "pct.json");
        if (fs.existsSync(jsonPath)) {
            console.log("Database empty - importing pct.json...");
            importFromJson(jsonPath);
        }
    }

    app.listen(PORT, () => {
        console.log(`PCT server running at http://localhost:${PORT}`);
    });
}

start();