// Course Data

export interface RawCourse {
    course_code: string;
    course_title: string;
    description?: string;
    prerequisites: string;
    url: string;
}

export interface Course {
    course_code: string;
    course_title: string;
    description: string;
    prerequisites_raw: string;
    url: string;
}

export interface Prerequisite {
    course_code: string;
    required_course_code: string;
}

// User Progress

export type CourseStatus = "completed" | "in-progress" | "planned";

export interface UserProgress {
    user_id: number;
    course_code: string;
    status: CourseStatus;
    updated_at: string;
}

// User Authentication

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

export interface TreeNode {
    code: string;
    title: string;
    children: TreeNode[];
}

export interface CourseDetail {
    course_code: string;
    course_title: string;
    description: string;
    prerequisites_raw: string;
    url: string;
    prereq_codes: string[];
    unlocks: string[];
}

export interface SearchResult {
    course_code: string;
    course_title: string;
}

export interface ProgressUpdate {
    course_code: string;
    status: CourseStatus | "";
}
