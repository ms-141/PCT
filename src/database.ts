// SQLite database setup and queries

import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import { Course, Prerequisite, RawCourse, CourseDetail, UserProgress, CourseStatus, User, TreeNode } from "./types";

let db: Database;

const DB_PATH = path.join(__dirname, "..", "pct.db");

// Database Init

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
            major TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
    `);

    saveDatabase();
}

function saveDatabase(): void {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function ensureCourseDescriptionColumn(): void {
    const results = db.exec("PRAGMA table_info(courses)");
    if (results.length === 0) return;
    const columns = results[0].values.map((row: any[]) => row[1] as string);
    if (!columns.includes("description")) {
        db.run("ALTER TABLE courses ADD COLUMN description TEXT");
    }
}

// Import

export function importFromJson(jsonPath: string): number {
    const raw: RawCourse[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    db.run("DELETE FROM courses");
    db.run("DELETE FROM prerequisites");

    const insertCourse = db.prepare(
        "INSERT OR REPLACE INTO courses (course_code, course_title, description, prerequisites_raw, url) VALUES (?, ?, ?, ?, ?)"
    );

    const insertPrereq = db.prepare(
        "INSERT OR REPLACE INTO prerequisites (course_code, required_course_code) VALUES (?, ?)"
    );

    let count = 0;

    for (const course of raw) {
        insertCourse.run([
            course.course_code,
            course.course_title,
            course.description ?? "",
            course.prerequisites,
            course.url,
        ]);

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

// Extracts course codes like "COMP 2631" from raw prerequisite text
function parsePrereqCodes(rawString: string): string[] {
    if (!rawString) return [];
    const matches = rawString.match(/[A-Z]{2,4}\s+\d{4}/g);
    if (!matches) return [];
    return [...new Set(matches)];
}

// Course Queries

export function getCourseDetail(courseCode: string): CourseDetail | null {
    const stmt = db.prepare(
        "SELECT course_code, course_title, description, prerequisites_raw, url FROM courses WHERE course_code = ?"
    );
    stmt.bind([courseCode]);
    let course: Course | null = null;
    if (stmt.step()) {
        const row = stmt.getAsObject();
        course = {
            course_code: row["course_code"] as string,
            course_title: row["course_title"] as string,
            description: (row["description"] as string) || "",
            prerequisites_raw: (row["prerequisites_raw"] as string) || "",
            url: (row["url"] as string) || "",
        };
    }
    stmt.free();

    if (!course) return null;

    const prereqStmt = db.prepare(
        "SELECT required_course_code FROM prerequisites WHERE course_code = ?"
    );
    prereqStmt.bind([courseCode]);
    const prereqCodes: string[] = [];
    while (prereqStmt.step()) {
        prereqCodes.push(prereqStmt.getAsObject()["required_course_code"] as string);
    }
    prereqStmt.free();

    const unlockStmt = db.prepare(
        "SELECT course_code FROM prerequisites WHERE required_course_code = ?"
    );
    unlockStmt.bind([courseCode]);
    const unlocks: string[] = [];
    while (unlockStmt.step()) {
        unlocks.push(unlockStmt.getAsObject()["course_code"] as string);
    }
    unlockStmt.free();

    return { ...course, prereq_codes: prereqCodes, unlocks };
}

export function searchCourses(query: string, limit: number = 10): Course[] {
    const stmt = db.prepare(
        `SELECT course_code, course_title, description, prerequisites_raw, url
         FROM courses
         WHERE course_code LIKE ? OR course_title LIKE ?
         LIMIT ?`
    );
    stmt.bind([`%${query}%`, `%${query}%`, limit]);
    const courses: Course[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        courses.push({
            course_code: row["course_code"] as string,
            course_title: row["course_title"] as string,
            description: (row["description"] as string) || "",
            prerequisites_raw: (row["prerequisites_raw"] as string) || "",
            url: (row["url"] as string) || "",
        });
    }
    stmt.free();
    return courses;
}

// Progress

export function getProgress(userId: number): UserProgress[] {
    const stmt = db.prepare(
        "SELECT user_id, course_code, status, updated_at FROM user_progress WHERE user_id = ?"
    );
    stmt.bind([userId]);
    const progress: UserProgress[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        progress.push({
            user_id: row["user_id"] as number,
            course_code: row["course_code"] as string,
            status: row["status"] as CourseStatus,
            updated_at: row["updated_at"] as string,
        });
    }
    stmt.free();
    return progress;
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

// User Authentication

export function createUser(email: string, username: string, passwordHash: string): number | null {
    try {
        db.run(
            "INSERT INTO users (email, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            [email, username, passwordHash, new Date().toISOString()]
        );
        saveDatabase();

        const stmt = db.prepare("SELECT id FROM users WHERE email = ?");
        stmt.bind([email]);
        let userId: number | null = null;
        if (stmt.step()) {
            userId = stmt.getAsObject()["id"] as number;
        }
        stmt.free();
        return userId;
    } catch (err) {
        return null;
    }
}

export function getUserByEmail(email: string): User | null {
    const stmt = db.prepare(
        "SELECT id, email, username, password_hash, major, created_at FROM users WHERE email = ?"
    );
    stmt.bind([email]);
    let user: User | null = null;
    if (stmt.step()) {
        const row = stmt.getAsObject();
        user = {
            id: row["id"] as number,
            email: row["email"] as string,
            username: row["username"] as string,
            password_hash: row["password_hash"] as string,
            major: (row["major"] as string) || "",
            created_at: row["created_at"] as string,
        };
    }
    stmt.free();
    return user;
}

export function getUserById(userId: number): User | null {
    const stmt = db.prepare(
        "SELECT id, email, username, password_hash, major, created_at FROM users WHERE id = ?"
    );
    stmt.bind([userId]);
    let user: User | null = null;
    if (stmt.step()) {
        const row = stmt.getAsObject();
        user = {
            id: row["id"] as number,
            email: row["email"] as string,
            username: row["username"] as string,
            password_hash: row["password_hash"] as string,
            major: (row["major"] as string) || "",
            created_at: row["created_at"] as string,
        };
    }
    stmt.free();
    return user;
}

export function setUserMajor(userId: number, major: string): void {
    db.run("UPDATE users SET major = ? WHERE id = ?", [major, userId]);
    saveDatabase();
}

// Deep Prerequisite / Unlock Tree

function buildPrereqTree(
    courseCode: string,
    direction: 'prereqs' | 'unlocks',
    maxDepth: number,
    visited: Set<string>,
    majorCodes: Set<string> | null
): TreeNode {
    const detail = getCourseDetail(courseCode);
    const title = detail ? detail.course_title : courseCode;

    if (visited.has(courseCode) || maxDepth === 0 || !detail) {
        return { code: courseCode, title, children: [] };
    }

    visited.add(courseCode);

    let childCodes: string[] = direction === 'prereqs' ? detail.prereq_codes : detail.unlocks;

    if (direction === 'unlocks' && majorCodes !== null) {
        childCodes = childCodes.filter(c => majorCodes!.has(c));
    }

    const children: TreeNode[] = [];
    for (const childCode of childCodes) {
        const childDetail = getCourseDetail(childCode);
        if (!childDetail) continue;
        children.push(buildPrereqTree(childCode, direction, maxDepth - 1, visited, majorCodes));
    }

    return { code: courseCode, title, children };
}

export function getDeepPrereqChain(
    courseCode: string,
    direction: 'prereqs' | 'unlocks',
    maxDepth: number = 4,
    majorCodes: Set<string> | null = null
): TreeNode {
    return buildPrereqTree(courseCode, direction, maxDepth, new Set<string>(), majorCodes);
}
