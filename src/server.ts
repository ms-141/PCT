// Express API server for PCT


import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { initDatabase, importFromJson, getCourseDetail, searchCourses, getProgress, setProgress } from "./database";
import { ProgressUpdate } from "./types";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());                    // Allow frontend to call API
app.use(express.json());            // Parse JSON request bodies
app.use(express.static(path.join(__dirname, "..", "public"))); // Serve frontend files

// API Routes

// Search courses by code or title
app.get("/api/courses/search", (req: Request, res: Response) => {
    const query = (req.query.q as string) || "";

    if (!query || query.length < 2) {
        res.json([]);
        return;
    }

    const results = searchCourses(query);
    res.json(results);
});

// Get full course detail including prereqs and unlocks
app.get("/api/courses/:code", (req: Request, res: Response) => {
    const code = req.params.code as string;
    const course = getCourseDetail(code);

    if (!course) {
        res.status(404).json({ error: "Course not found" });
        return;
    }

    res.json(course);
});

// Get all progress for a user
app.get("/api/progress/:userId", (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId as string);

    if (isNaN(userId)) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }

    const progress = getProgress(userId);
    res.json(progress);
});

// Update progress for a specific course
app.post("/api/progress/:userId", (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId as string);
    const { course_code, status } = req.body as ProgressUpdate;

    if (isNaN(userId)) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }

    if (!course_code) {
        res.status(400).json({ error: "course_code is required" });
        return;
    }

    // Validate status
    const validStatuses = ["completed", "in-progress", "planned", ""];
    if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "Invalid status. Use: completed, in-progress, planned, or empty string to clear" });
        return;
    }

    setProgress(userId, course_code, status);
    res.json({ success: true, course_code, status });
});

// Import pct.json into database
app.post("/api/import", (req: Request, res: Response) => {
    const jsonPath = path.join(__dirname, "..", "pct.json");
    
    try {
        const count = importFromJson(jsonPath);
        res.json({ success: true, courses_imported: count });
    } catch (err) {
        res.status(500).json({ error: "Failed to import: " + err });
    }
});

// Start Server

async function start() {
    await initDatabase();

    const testCourse = getCourseDetail("COMP 1633");
    if (!testCourse) {
        const jsonPath = path.join(__dirname, "..", "pct.json");
        const fs = await import("fs");
        if (fs.existsSync(jsonPath)) {
            console.log("Database empty - importing pct.json...");
            importFromJson(jsonPath);
        } else {
            console.log("No pct.json found. Use POST /api/import to load data.");
        }
    }

    app.listen(PORT, () => {
        console.log(`PCT server running at http://localhost:${PORT}`);
        console.log(`API available at http://localhost:${PORT}/api/courses/search?q=COMP`);
    });
}

start();
