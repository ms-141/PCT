// SQLite database setup and queries


import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import { Course, Prerequisite, RawCourse, CourseDetail, UserProgress, CourseStatus, User } from "./types";

let db: Database;

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "pct.db");

// Initialize Database

export async function initDatabase(): Promise<void> {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log("Loaded existing database");
    } else {
        db = new SQL.Database();
        console.log("Created new database");
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS courses (
            course_code TEXT PRIMARY KEY,
            course_title TEXT NOT NULL,
            description TEXT,
            prerequisites_raw TEXT,
            url TEXT
        )
    `);

    ensureCourseDescriptionColumn();

    db.run(`
        CREATE TABLE IF NOT EXISTS prerequisites (
            course_code TEXT NOT NULL,
            required_course_code TEXT NOT NULL,
            PRIMARY KEY (course_code, required_course_code)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS user_progress (
            user_id INTEGER NOT NULL,
            course_code TEXT NOT NULL,
            status TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, course_code)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    `);

    saveDatabase();
}

function saveDatabase(): void {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function ensureCourseDescriptionColumn(): void {
    const results = db.exec("PRAGMA table_info(courses)");
    if (results.length === 0) {
        return;
    }

    const columns = results[0].values.map((row: any[]) => row[1] as string);
    if (!columns.includes("description")) {
        db.run("ALTER TABLE courses ADD COLUMN description TEXT");
    }
}

// Import from pct.json

export function importFromJson(jsonPath: string): number {
    // Read the scraper output
    const raw: RawCourse[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    // Clear existing data
    db.run("DELETE FROM courses");
    db.run("DELETE FROM prerequisites");

    // Insert courses
    const insertCourse = db.prepare(
        "INSERT OR REPLACE INTO courses (course_code, course_title, description, prerequisites_raw, url) VALUES (?, ?, ?, ?, ?)"
    );

    const insertPrereq = db.prepare(
        "INSERT OR REPLACE INTO prerequisites (course_code, required_course_code) VALUES (?, ?)"
    );

    let count = 0;

    for (const course of raw) {
        // Insert the course
        insertCourse.run([
            course.course_code,
            course.course_title,
            course.description ?? "",
            course.prerequisites,
            course.url,
        ]);

        // Parse prerequisite codes from raw text
        const prereqCodes = parsePrereqCodes(course.prerequisites);
        for (const reqCode of prereqCodes) {
            insertPrereq.run([course.course_code, reqCode]);
        }

        count++;
    }

    insertCourse.free();
    insertPrereq.free();
    saveDatabase();

    console.log(`Imported ${count} courses`);
    return count;
}

// Extract course codes like "COMP 2631" from raw prerequisite text
function parsePrereqCodes(rawString: string): string[] {
    if (!rawString) return [];
    const matches = rawString.match(/[A-Z]{2,4}\s+\d{4}/g);
    if (!matches) return [];
    return [...new Set(matches)]; // remove duplicates
}

// Query Functions

// Get a single course with its prereqs and unlocks
export function getCourseDetail(courseCode: string): CourseDetail | null {

    const results = db.exec(
        "SELECT course_code, course_title, description, prerequisites_raw, url FROM courses WHERE course_code = ?",
        [courseCode]
    );

    if (results.length === 0 || results[0].values.length === 0) {
        return null;
    }

    const row = results[0].values[0];
    const course: Course = {
        course_code: row[0] as string,
        course_title: row[1] as string,
        description: (row[2] as string) || "",
        prerequisites_raw: (row[3] as string) || "",
        url: (row[4] as string) || "",
    };


    const prereqResults = db.exec(
        "SELECT required_course_code FROM prerequisites WHERE course_code = ?",
        [courseCode]
    );
    const prereqCodes: string[] = prereqResults.length > 0
        ? prereqResults[0].values.map((r: any[]) => r[0] as string)
        : [];


    const unlockResults = db.exec(
        "SELECT course_code FROM prerequisites WHERE required_course_code = ?",
        [courseCode]
    );
    const unlocks: string[] = unlockResults.length > 0
        ? unlockResults[0].values.map((r: any[]) => r[0] as string)
        : [];

    return {
        ...course,
        prereq_codes: prereqCodes,
        unlocks: unlocks,
    };
}

// Search courses by code or title
export function searchCourses(query: string, limit: number = 10): Course[] {
    const results = db.exec(
        `SELECT course_code, course_title, description, prerequisites_raw, url 
         FROM courses 
         WHERE course_code LIKE ? OR course_title LIKE ? 
         LIMIT ?`,
        [`%${query}%`, `%${query}%`, limit]
    );

    if (results.length === 0) return [];

    return results[0].values.map((row: any[]) => ({
        course_code: row[0] as string,
        course_title: row[1] as string,
        description: (row[2] as string) || "",
        prerequisites_raw: (row[3] as string) || "",
        url: (row[4] as string) || "",
    }));
}

// Progress Functions

export function getProgress(userId: number): UserProgress[] {
    const results = db.exec(
        "SELECT user_id, course_code, status, updated_at FROM user_progress WHERE user_id = ?",
        [userId]
    );

    if (results.length === 0) return [];

    return results[0].values.map((row: any[]) => ({
        user_id: row[0] as number,
        course_code: row[1] as string,
        status: row[2] as CourseStatus,
        updated_at: row[3] as string,
    }));
}

export function setProgress(userId: number, courseCode: string, status: CourseStatus | ""): void {
    if (status === "") {

        db.run(
            "DELETE FROM user_progress WHERE user_id = ? AND course_code = ?",
            [userId, courseCode]
        );
    } else {

        db.run(
            `INSERT OR REPLACE INTO user_progress (user_id, course_code, status, updated_at) 
             VALUES (?, ?, ?, ?)`,
            [userId, courseCode, status, new Date().toISOString()]
        );
    }
    saveDatabase();
}

// User Authentication Functions

// Create a new user, returns the user ID or null if email already exists
export function createUser(email: string, username: string, passwordHash: string): number | null {
    try {
        db.run(
            "INSERT INTO users (email, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            [email, username, passwordHash, new Date().toISOString()]
        );
        saveDatabase();

        // Get the ID of the newly created user
        const result = db.exec("SELECT MAX(id) FROM users WHERE email = ?", [email]);
        if (result.length > 0 && result[0].values.length > 0) {
            return result[0].values[0][0] as number;
        }
        return null;
    } catch (err) {
        return null;
    }
}

// Find a user by email (for login)
export function getUserByEmail(email: string): User | null {
    const results = db.exec(
        "SELECT id, email, username, password_hash, created_at FROM users WHERE email = ?",
        [email]
    );

    if (results.length === 0 || results[0].values.length === 0) {
        return null;
    }

    const row = results[0].values[0];
    return {
        id: row[0] as number,
        email: row[1] as string,
        username: row[2] as string,
        password_hash: row[3] as string,
        created_at: row[4] as string,
    };
}

// Find a user by ID (for JWT verification)
export function getUserById(userId: number): User | null {
    const results = db.exec(
        "SELECT id, email, username, password_hash, created_at FROM users WHERE id = ?",
        [userId]
    );

    if (results.length === 0 || results[0].values.length === 0) {
        return null;
    }

    const row = results[0].values[0];
    return {
        id: row[0] as number,
        email: row[1] as string,
        username: row[2] as string,
        password_hash: row[3] as string,
        created_at: row[4] as string,
    };
}