# cURL Commands Reference

Quick reference for testing all API endpoints with cURL commands.

## Prerequisites

```bash
# Set API URL (default: http://localhost:3000/api)
export API_URL="http://localhost:3000/api"

# Optional: Install jq for JSON formatting
brew install jq  # macOS
sudo apt-get install jq  # Ubuntu
```

## Quick Test All Endpoints

```bash
# Run the automated test script
./scripts/test-api.sh

# Run with verbose output
VERBOSE=true ./scripts/test-api.sh

# Test against custom API URL
API_URL=http://localhost:3001/api ./scripts/test-api.sh
```

## Individual Endpoint Tests

### 1. Get All Courses

```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" | jq
```

**Expected Response**: 200 OK
```json
{
  "courses": [...],
  "total": 4,
  "page": 1,
  "pageSize": 10
}
```

### 2. Get Course by ID

**Valid Course (200 OK)**
```bash
curl -X GET http://localhost:3000/api/courses/1 \
  -H "Content-Type: application/json" | jq
```

**Valid Course IDs**: 1, 2, 3, 4

**Invalid Course (404 Error)**
```bash
curl -X GET http://localhost:3000/api/courses/999 \
  -H "Content-Type: application/json" | jq
```

**Expected Response**:
```json
{
  "error": "Course not found",
  "message": "No course exists with ID: 999",
  "statusCode": 404
}
```

### 3. Get Lesson Details

```bash
curl -X GET http://localhost:3000/api/lessons/lesson-1 \
  -H "Content-Type: application/json" | jq
```

**Valid Lesson IDs**: lesson-1, lesson-2, lesson-3, lesson-4, lesson-5, lesson-6, lesson-7, lesson-8, lesson-9

**Different lesson types**:
```bash
# Video lesson
curl -X GET http://localhost:3000/api/lessons/lesson-1 \
  -H "Content-Type: application/json" | jq '.videoUrl'

# PDF lesson
curl -X GET http://localhost:3000/api/lessons/lesson-3 \
  -H "Content-Type: application/json" | jq '.pdfUrl'
```

### 4. Update Progress

**Mark Lesson Complete**
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

**Mark Lesson In Progress**
```bash
curl -X POST http://localhost:3000/api/progress \
  -H "Content-Type: application/json" \
  -d '{
    "lessonId": "lesson-2",
    "courseId": "1",
    "completed": false,
    "watchedDuration": 450,
    "totalDuration": 1335,
    "progressPercentage": 33
  }' | jq
```

**Expected Response**: 200 OK
```json
{
  "success": true,
  "message": "Progress updated successfully",
  "data": {
    "userId": "user-123",
    "lessonId": "lesson-1",
    "courseId": "1",
    "completed": true,
    "updatedAt": "2026-02-14T..."
  }
}
```

### 5. Get User Profile

```bash
curl -X GET http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" | jq
```

**Extract specific fields**:
```bash
# Get user stats
curl -X GET http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" | jq '.stats'

# Get current streak
curl -X GET http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" | jq '.stats.currentStreak'

# Get badges
curl -X GET http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" | jq '.badges'
```

### 6. Get Progress Reports

```bash
curl -X GET http://localhost:3000/api/reports \
  -H "Content-Type: application/json" | jq
```

**Extract specific sections**:
```bash
# Overview
curl -X GET http://localhost:3000/api/reports \
  -H "Content-Type: application/json" | jq '.overview'

# Weekly activity
curl -X GET http://localhost:3000/api/reports \
  -H "Content-Type: application/json" | jq '.weeklyActivity'

# Course progress
curl -X GET http://localhost:3000/api/reports \
  -H "Content-Type: application/json" | jq '.courseProgress'

# Skills progress
curl -X GET http://localhost:3000/api/reports \
  -H "Content-Type: application/json" | jq '.skillsProgress'
```

## Testing CORS

### CORS Preflight Request

```bash
curl -X OPTIONS http://localhost:3000/api/courses \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i
```

**Expected Headers**:
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Test CORS with Actual Request

```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Origin: http://localhost:5173" \
  -i | grep "Access-Control"
```

## Advanced Usage

### Save Response to File

```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -o courses.json

# Pretty format with jq
cat courses.json | jq '.'
```

### Include Response Headers

```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -i | head -20
```

### Measure Response Time

```bash
curl -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -w "\n\nTime Total: %{time_total}s\n" \
  -o /dev/null
```

### Silent Mode (No Progress Bar)

```bash
curl -s -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" | jq
```

### Follow Redirects

```bash
curl -L -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" | jq
```

## Testing Scenarios

### Complete User Journey

```bash
# 1. Browse courses
courses=$(curl -s -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json")
echo "$courses" | jq '.courses[] | {id, title, progress}'

# 2. Get course details
course_id="1"
course=$(curl -s -X GET http://localhost:3000/api/courses/$course_id \
  -H "Content-Type: application/json")
echo "$course" | jq '{title, modules: .modules | length}'

# 3. Get first lesson
lesson_id=$(echo "$course" | jq -r '.modules[0].lessons[0].id')
lesson=$(curl -s -X GET http://localhost:3000/api/lessons/$lesson_id \
  -H "Content-Type: application/json")
echo "$lesson" | jq '{title, type, duration, videoUrl}'

# 4. Update progress
curl -s -X POST http://localhost:3000/api/progress \
  -H "Content-Type: application/json" \
  -d "{
    \"lessonId\": \"$lesson_id\",
    \"courseId\": \"$course_id\",
    \"completed\": true,
    \"watchedDuration\": 930,
    \"totalDuration\": 930,
    \"progressPercentage\": 100
  }" | jq

# 5. Check updated profile
curl -s -X GET http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" | jq '.stats'
```

### Error Handling Test

```bash
# Test 404 errors
curl -s -X GET http://localhost:3000/api/courses/invalid \
  -H "Content-Type: application/json" | jq

curl -s -X GET http://localhost:3000/api/lessons/invalid \
  -H "Content-Type: application/json" | jq
```

### Performance Testing

```bash
# Test multiple requests
for i in {1..10}; do
  curl -s -X GET http://localhost:3000/api/courses \
    -H "Content-Type: application/json" \
    -w "Request $i: %{time_total}s\n" \
    -o /dev/null
done
```

## Troubleshooting

### API Not Responding

```bash
# Check if API is running
curl -I http://localhost:3000/api/user/profile

# Check Docker container
docker ps | grep mock-api

# View logs
docker logs levelup-mock-api
```

### Connection Refused

```bash
# Verify port is open
lsof -i :3000

# Check if something else is using port 3000
netstat -an | grep 3000
```

### Invalid JSON Response

```bash
# View raw response
curl -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json"

# Validate JSON with jq
curl -s -X GET http://localhost:3000/api/courses \
  -H "Content-Type: application/json" | jq empty
```

## Environment Variables

```bash
# Use custom API URL
export API_URL="http://localhost:3001/api"
curl -X GET $API_URL/courses | jq

# Use in Docker network
export API_URL="http://mock-api:3000/api"
docker exec levelup-dev curl -s $API_URL/courses | jq
```

## Automation Scripts

### Bash Loop Through All Courses

```bash
#!/bin/bash
for id in 1 2 3 4; do
  echo "=== Course $id ==="
  curl -s -X GET http://localhost:3000/api/courses/$id \
    -H "Content-Type: application/json" | jq '{id, title, level, progress}'
  echo ""
done
```

### Monitor API Health

```bash
#!/bin/bash
while true; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/user/profile)
  if [ "$status" -eq 200 ]; then
    echo "[$(date)] ✓ API is healthy (HTTP $status)"
  else
    echo "[$(date)] ✗ API error (HTTP $status)"
  fi
  sleep 10
done
```

## See Also

- [Mock API Guide](./MOCK_API_GUIDE.md) - Complete API documentation
- [API Types](../src/types/api.ts) - TypeScript type definitions
- [API Client](../src/lib/api.ts) - TypeScript API client library
- [Test Script](../scripts/test-api.sh) - Automated test suite
