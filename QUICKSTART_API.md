# Quick Start: Mock API Backend

Get up and running with the Mockoon mock API backend in 5 minutes.

## Step 1: Start the Services

```bash
# Copy environment variables
cp .env.example .env

# Start all services (app + mock-api)
docker-compose -f docker-compose.dev.yml up

# Or start mock-api only
docker-compose -f docker-compose.dev.yml up mock-api
```

The mock API will be available at: **http://localhost:3000/api**

## Step 2: Verify API is Running

```bash
# Quick health check
curl http://localhost:3000/api/user/profile

# Should return user profile JSON
```

## Step 3: Test All Endpoints

```bash
# Run the automated test suite
./scripts/test-api.sh
```

Expected output:
```
╔════════════════════════════════════════════════════════════════╗
║             E-Learning Platform API Test Suite                ║
╚════════════════════════════════════════════════════════════════╝

API URL: http://localhost:3000/api

✓ All tests passed!
Total Tests: 25
Passed: 25
Failed: 0
```

## Step 4: Try It in Your React App

Create a new component or update an existing one:

```typescript
// src/app/pages/MyCoursesTest.tsx
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Course } from '@/types/api';

export function MyCoursesTest() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.courses.getAll()
      .then(data => {
        setCourses(data.courses);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to load courses:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Courses</h1>
      <div className="grid gap-4">
        {courses.map(course => (
          <div key={course.id} className="p-4 border rounded-lg">
            <h2 className="font-semibold">{course.title}</h2>
            <p className="text-sm text-gray-600">{course.description}</p>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
                <span className="text-sm">{course.progress}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Quick API Reference

### Get All Courses
```bash
curl http://localhost:3000/api/courses | jq
```

### Get Course by ID
```bash
curl http://localhost:3000/api/courses/1 | jq
```

### Get Lesson Details
```bash
curl http://localhost:3000/api/lessons/lesson-1 | jq
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
curl http://localhost:3000/api/user/profile | jq
```

### Get Reports
```bash
curl http://localhost:3000/api/reports | jq
```

## What's Available?

- **4 Courses**: Web Development, React & TypeScript, UI/UX Design, Node.js
- **42+ Lessons**: Mix of video and PDF content
- **Real Video URLs**: Sample MP4 files for testing
- **User Profile**: With stats, badges, and preferences
- **Progress Tracking**: Update and track learning progress
- **Reports**: Weekly activity, course progress, skills

## TypeScript Types

All API responses are fully typed:

```typescript
import type {
  Course,
  CourseDetail,
  LessonDetail,
  UserProfile,
  ReportsResponse
} from '@/types/api';
```

## API Client Usage

```typescript
import { api } from '@/lib/api';

// All endpoints are organized by namespace
await api.courses.getAll();
await api.courses.getById('1');
await api.lessons.getById('lesson-1');
await api.progress.update({ ... });
await api.user.getProfile();
await api.reports.get();
```

## Troubleshooting

### "Connection Refused"
```bash
# Check if mock-api container is running
docker ps | grep mock-api

# Restart the service
docker-compose -f docker-compose.dev.yml restart mock-api
```

### "CORS Error"
The API is configured with CORS enabled (`Access-Control-Allow-Origin: *`). If you see CORS errors:
1. Verify VITE_API_URL in `.env`
2. Restart Vite dev server
3. Check browser console for details

### "404 Not Found"
Valid IDs:
- **Courses**: 1, 2, 3, 4
- **Lessons**: lesson-1, lesson-2, lesson-3, ... lesson-9

Other IDs will return 404 errors (this is expected behavior).

## Next Steps

1. **View Documentation**:
   - [Complete API Guide](docs/MOCK_API_GUIDE.md)
   - [cURL Commands](docs/CURL_COMMANDS.md)
   - [Phase 5 Summary](docs/PHASE_5_SUMMARY.md)

2. **See Examples**:
   - [React Examples](src/app/components/examples/ApiExample.tsx)

3. **Install React Query** (recommended):
   ```bash
   npm install @tanstack/react-query
   ```

4. **Start Building**:
   - Integrate API calls into existing pages
   - Add progress tracking to video player
   - Display user stats on dashboard

## Support

- **Mockoon Docs**: https://mockoon.com/docs/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **React Query**: https://tanstack.com/query/latest

---

**You're ready to go!** The mock API is running and ready to use in your React components.
