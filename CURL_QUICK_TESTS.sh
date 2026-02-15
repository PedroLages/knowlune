#!/bin/bash
# Quick cURL test commands for E-Learning Platform API
# Usage: ./CURL_QUICK_TESTS.sh

API_URL="http://localhost:3000/api"

echo "E-Learning Platform API - Quick Tests"
echo "======================================"
echo ""

# Test 1: Get All Courses
echo "1. GET All Courses:"
curl -s -X GET "$API_URL/courses" -H "Content-Type: application/json" | jq -C '.' | head -30
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 2: Get Course by ID
echo "2. GET Course by ID (1):"
curl -s -X GET "$API_URL/courses/1" -H "Content-Type: application/json" | jq -C '.' | head -30
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 3: Get Course 404 Error
echo "3. GET Course by ID (999 - should return 404):"
curl -s -X GET "$API_URL/courses/999" -H "Content-Type: application/json" | jq -C '.'
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 4: Get Lesson Details
echo "4. GET Lesson Details (lesson-1):"
curl -s -X GET "$API_URL/lessons/lesson-1" -H "Content-Type: application/json" | jq -C '.' | head -30
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 5: Update Progress
echo "5. POST Update Progress:"
curl -s -X POST "$API_URL/progress" \
  -H "Content-Type: application/json" \
  -d '{
    "lessonId": "lesson-1",
    "courseId": "1",
    "completed": true,
    "watchedDuration": 930,
    "totalDuration": 930,
    "progressPercentage": 100
  }' | jq -C '.'
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 6: Get User Profile
echo "6. GET User Profile:"
curl -s -X GET "$API_URL/user/profile" -H "Content-Type: application/json" | jq -C '.' | head -30
echo ""
read -p "Press Enter to continue..."
echo ""

# Test 7: Get Reports
echo "7. GET Progress Reports:"
curl -s -X GET "$API_URL/reports" -H "Content-Type: application/json" | jq -C '.' | head -30
echo ""

echo ""
echo "======================================"
echo "All tests completed!"
echo "======================================"
