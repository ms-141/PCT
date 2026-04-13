// Course Data 

// The scraper output
export interface RawCourse {
    course_code: string;
    course_title: string;
    description?: string;
    prerequisites: string;  // raw text
    url: string;
}

// Cleaned version stored in the database
export interface Course {
    course_code: string;
    course_title: string;
    description: string;
    prerequisites_raw: string;
    url: string;
}

// A single prerequisite relationship: "COMP 2631 requires COMP 1633"
export interface Prerequisite {
    course_code: string;         // the course
    required_course_code: string; // what it requires
}

// User Progress FR4

// Union type - status can ONLY be one of these three values
export type CourseStatus = "completed" | "in-progress" | "planned";

export interface UserProgress {
    user_id: number;
    course_code: string;
    status: CourseStatus;
    updated_at: string;  // ISO date string
}

// ---------- User Authentication (FR3) ----------

export interface User {
    id: number;
    email: string;
    username: string;
    password_hash: string;
    major: string;
    created_at: string;
}

export interface AuthResponse {
    success: boolean;
    token?: string;
    user?: {
        id: number;
        email: string;
        username: string;
    };
    error?: string;
}

// API Response Types

// Deep prerequisite/unlock tree node
export interface TreeNode {
    code: string;
    title: string;
    children: TreeNode[];
}

// What the /api/courses/:code endpoint returns
export interface CourseDetail {
    course_code: string;
    course_title: string;
    description: string;
    prerequisites_raw: string;
    url: string;
    prereq_codes: string[];    // parsed prerequisite course codes
    unlocks: string[];         // courses this one leads to
}

// What the /api/search endpoint returns
export interface SearchResult {
    course_code: string;
    course_title: string;
}

// What the /api/progress endpoint accepts/returns
export interface ProgressUpdate {
    course_code: string;
    status: CourseStatus | "";  // empty string = clear progress
}