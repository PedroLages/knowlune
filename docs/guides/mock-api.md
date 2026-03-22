# Mock API Backend Guide

This guide provides comprehensive documentation for the Mockoon-based mock API backend for the e-learning platform.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Available Endpoints](#available-endpoints)
- [Testing with cURL](#testing-with-curl)
- [Usage Examples](#usage-examples)
- [TypeScript Integration](#typescript-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The mock API backend uses [Mockoon](https://mockoon.com/) to provide realistic REST API endpoints for development and testing. It includes:

- 6 main endpoints with dynamic responses
- Realistic e-learning data (courses, lessons, progress, user profiles)
- Full CORS support
- Error responses (404, 400, 500)
- Mockoon templating for dynamic content

**Base URL**: `http://localhost:3000/api`

## Setup

### Using Docker Compose (Recommended)

1. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```

2. **Start the development environment**:
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

   This will start:
   - React app on `http://localhost:5173`
   - Mock API on `http://localhost:3000`

3. **Verify the API is running**:
   ```bash
   curl http://localhost:3000/api/user/profile
   ```

### Using Mockoon CLI (Local)

1. **Install Mockoon CLI**:
   ```bash
   npm install -g @mockoon/cli
   ```

2. **Start the mock server**:
   ```bash
   mockoon-cli start --data mockoon-data.json --port 3000
   ```

3. **Set environment variable**:
   ```bash
   export VITE_API_URL=http://localhost:3000/api
   ```

## Available Endpoints

### 1. Get All Courses

**Endpoint**: `GET /api/courses`

**Description**: Retrieve a list of all available courses with enrollment status and progress.

**Response Schema**:
```typescript
{
  courses: Course[];
  total: number;
  page: number;
  pageSize: number;
}
```

**Example Response**:
```json
{
  "courses": [
    {
      "id": "1",
      "title": "Introduction to Web Development",
      "description": "Learn the fundamentals...",
      "instructor": {...},
      "thumbnail": "https://...",
      "duration": "8 weeks",
      "level": "Beginner",
      "rating": 4.8,
      "progress": 75,
      "enrolled": true
    }
  ],
  "total": 4
}
```

---

### 2. Get Course Details

**Endpoint**: `GET /api/courses/:id`

**Description**: Get detailed course information including modules, lessons, and reviews.

**Parameters**:
- `id` (path): Course ID (1, 2, 3, or 4)

**Response Schema**: `CourseDetail`

**Example Response**:
```json
{
  "id": "1",
  "title": "Introduction to Web Development",
  "modules": [
    {
      "id": "mod-1",
      "title": "Getting Started",
      "lessons": [
        {
          "id": "lesson-1",
          "title": "What is Web Development?",
          "type": "video",
          "duration": "15:30"
        }
      ]
    }
  ],
  "requirements": ["Basic computer skills"],
  "whatYouWillLearn": ["Build complete websites"],
  "reviews": [...]
}
```

**Error Response** (404):
```json
{
  "error": "Course not found",
  "message": "No course exists with ID: 999",
  "statusCode": 404
}
```

---

### 3. Get Lesson Details

**Endpoint**: `GET /api/lessons/:id`

**Description**: Get detailed lesson information including video/PDF URLs, resources, and navigation.

**Parameters**:
- `id` (path): Lesson ID (e.g., "lesson-1", "lesson-2")

**Response Schema**: `LessonDetail`

**Example Response**:
```json
{
  "id": "lesson-1",
  "title": "What is Web Development?",
  "type": "video",
  "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "duration": "15:30",
  "courseId": "1",
  "completed": true,
  "lastWatchedPosition": 0,
  "resources": [
    {
      "id": "res-1",
      "title": "Lesson Slides",
      "type": "pdf",
      "url": "https://..."
    }
  ],
  "nextLesson": {
    "id": "lesson-2",
    "title": "Next Lesson Title"
  }
}
```

---

### 4. Update Progress

**Endpoint**: `POST /api/progress`

**Description**: Update learning progress for a lesson.

**Request Body**:
```json
{
  "lessonId": "lesson-1",
  "courseId": "1",
  "completed": true,
  "watchedDuration": 930,
  "totalDuration": 930,
  "progressPercentage": 100
}
```

**Response Schema**: `ProgressUpdateResponse`

**Example Response**:
```json
{
  "success": true,
  "message": "Progress updated successfully",
  "data": {
    "userId": "user-123",
    "lessonId": "lesson-1",
    "completed": true,
    "updatedAt": "2026-02-14T12:00:00Z"
  }
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Validation error",
  "message": "Missing required fields",
  "statusCode": 400
}
```

---

### 5. Get User Profile

**Endpoint**: `GET /api/user/profile`

**Description**: Get current user profile with stats, preferences, and badges.

**Response Schema**: `UserProfile`

**Example Response**:
```json
{
  "id": "user-123",
  "name": "Alex Martinez",
  "email": "alex.martinez@example.com",
  "avatar": "https://...",
  "stats": {
    "coursesEnrolled": 3,
    "totalLearningTime": 4320,
    "currentStreak": 7,
    "certificatesEarned": 0
  },
  "preferences": {
    "autoPlayVideos": true,
    "theme": "light"
  },
  "badges": [...]
}
```

---

### 6. Get Progress Reports

**Endpoint**: `GET /api/reports`

**Description**: Get comprehensive learning progress reports and analytics.

**Response Schema**: `ReportsResponse`

**Example Response**:
```json
{
  "userId": "user-123",
  "period": "last_30_days",
  "overview": {
    "totalLearningTime": 4320,
    "lessonsCompleted": 65,
    "currentStreak": 7
  },
  "weeklyActivity": [...],
  "courseProgress": [...],
  "skillsProgress": [...],
  "achievements": [...]
}
```

---

## Testing with cURL

### Get All Courses
```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" | jq
```

### Get Course by ID
```bash
# Valid course (ID: 1, 2, 3, or 4)
curl -X GET http://localhost:3000/api/courses/1 \
  -H "Content-Type: application/json" | jq

# Invalid course (404 error)
curl -X GET http://localhost:3000/api/courses/999 \
  -H "Content-Type: application/json" | jq
```

### Get Lesson Details
```bash
curl -X GET http://localhost:3000/api/lessons/lesson-1 \
  -H "Content-Type: application/json" | jq
```

### Update Progress
```bash
curl -X POST http://localhost:3000/api/progress \
  -H "Content-Type: application/json" \
  -d '{
    "lessonId": "lesson-1",
    "courseId": "1",
    "completed": true,
    "watchedDuration": 930,
    "totalDuration": 930,
    "progressPercentage": 100
  }' | jq
```

### Get User Profile
```bash
curl -X GET http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" | jq
```

### Get Reports
```bash
curl -X GET http://localhost:3000/api/reports \
  -H "Content-Type: application/json" | jq
```

### Test CORS (Preflight)
```bash
curl -X OPTIONS http://localhost:3000/api/courses \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -i
```

## Usage Examples

### Basic Usage in React Components

```typescript
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import type { Course } from '@/types/api';

function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const data = await api.courses.getAll();
        setCourses(data.courses);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {courses.map(course => (
        <div key={course.id}>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
      ))}
    </div>
  );
}
```

### With React Query (Recommended)

```typescript
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/lib/api';

function CourseDetail({ courseId }: { courseId: string }) {
  const { data: course, isLoading, error } = useQuery({
    queryKey: queryKeys.courses.detail(courseId),
    queryFn: () => api.courses.getById(courseId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading course</div>;
  if (!course) return null;

  return (
    <div>
      <h1>{course.title}</h1>
      <p>{course.description}</p>

      <div>
        {course.modules.map(module => (
          <div key={module.id}>
            <h3>{module.title}</h3>
            <ul>
              {module.lessons.map(lesson => (
                <li key={lesson.id}>{lesson.title}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Progress Tracking

```typescript
import { api } from '@/lib/api';

async function updateLessonProgress(
  lessonId: string,
  courseId: string,
  watchedDuration: number,
  totalDuration: number
) {
  const progressPercentage = (watchedDuration / totalDuration) * 100;
  const completed = progressPercentage >= 95;

  try {
    const result = await api.progress.update({
      lessonId,
      courseId,
      completed,
      watchedDuration,
      totalDuration,
      progressPercentage,
    });

    console.log('Progress updated:', result.data);
    return result;
  } catch (error) {
    console.error('Failed to update progress:', error);
    throw error;
  }
}
```

### Error Handling

```typescript
import { api, isApiError, ApiClientError } from '@/lib/api';

async function loadCourse(courseId: string) {
  try {
    const course = await api.courses.getById(courseId);
    return course;
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.statusCode === 404) {
        console.error('Course not found:', courseId);
      } else {
        console.error('API error:', error.message);
      }
    } else {
      console.error('Network error:', error);
    }
    return null;
  }
}
```

## TypeScript Integration

### Type-Safe API Calls

All API functions are fully typed. TypeScript will provide autocomplete and type checking:

```typescript
import { api } from '@/lib/api';

// TypeScript knows the return type is CoursesListResponse
const coursesResponse = await api.courses.getAll();

// TypeScript provides autocomplete for response properties
console.log(coursesResponse.courses[0].title);
console.log(coursesResponse.total);

// TypeScript validates request payloads
await api.progress.update({
  lessonId: 'lesson-1',
  courseId: '1',
  completed: true,
  watchedDuration: 930,
  totalDuration: 930,
  progressPercentage: 100,
  // TypeScript error if you add invalid properties
});
```

### Type Imports

```typescript
import type {
  Course,
  CourseDetail,
  LessonDetail,
  UserProfile,
  ProgressUpdateRequest,
} from '@/types/api';

// Use types for component props
interface CourseCardProps {
  course: Course;
  onEnroll?: (courseId: string) => void;
}

// Use types for state
const [profile, setProfile] = useState<UserProfile | null>(null);
```

## Troubleshooting

### API Not Responding

**Check if the mock API is running**:
```bash
docker ps | grep mock-api
# or
curl http://localhost:3000/api/user/profile
```

**Restart the service**:
```bash
docker-compose -f docker-compose.dev.yml restart mock-api
```

### CORS Errors

The mock API is configured to allow all origins (`Access-Control-Allow-Origin: *`). If you see CORS errors:

1. Check browser console for the exact error
2. Verify the API URL in `.env` matches the running service
3. Ensure OPTIONS requests are working:
   ```bash
   curl -X OPTIONS http://localhost:3000/api/courses -i
   ```

### 404 Errors

Valid course IDs are: `1`, `2`, `3`, `4`
Valid lesson IDs include: `lesson-1`, `lesson-2`, `lesson-7`, `lesson-8`

For other IDs, you'll receive a 404 error response.

### Environment Variables Not Loading

**Ensure `.env` exists**:
```bash
cp .env.example .env
```

**Restart Vite dev server** after changing environment variables:
```bash
npm run dev
```

**In Docker**, restart the container:
```bash
docker-compose -f docker-compose.dev.yml restart app
```

### Type Errors

**Ensure types are imported correctly**:
```typescript
import type { Course } from '@/types/api';  // ✅ Correct
import { Course } from '@/types/api';       // ❌ Will fail (it's a type, not a value)
```

**Update TypeScript** if you see unexpected errors:
```bash
npm install -D typescript@latest
```

## Additional Resources

- [Mockoon Documentation](https://mockoon.com/docs/latest/about/)
- [Mockoon CLI Reference](https://mockoon.com/docs/latest/cli/overview/)
- [API Type Definitions](../src/types/api.ts)
- [API Client Library](../src/lib/api.ts)

## Next Steps

1. **Install React Query** for better data fetching:
   ```bash
   npm install @tanstack/react-query
   ```

2. **Add authentication** by extending the API with login/logout endpoints

3. **Implement caching** using React Query or SWR

4. **Add optimistic updates** for progress tracking

5. **Create custom hooks** for common API operations
