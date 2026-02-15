#!/bin/bash

###############################################################################
# Mock API Test Script
# Tests all endpoints with curl and validates responses
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API configuration
API_URL="${API_URL:-http://localhost:3000/api}"
VERBOSE="${VERBOSE:-false}"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}TEST ${TESTS_RUN}:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

print_failure() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}ℹ INFO:${NC} $1"
}

test_endpoint() {
    ((TESTS_RUN++))
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5

    print_test "$description"

    if [ "$VERBOSE" = "true" ]; then
        print_info "Request: $method $API_URL$endpoint"
        [ -n "$data" ] && print_info "Data: $data"
    fi

    # Make request
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_URL$endpoint" \
            -H "Content-Type: application/json")
    fi

    # Extract status code and body
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Validate status code
    if [ "$http_code" -eq "$expected_status" ]; then
        print_success "Status code: $http_code"

        # Pretty print JSON response if jq is available
        if command -v jq &> /dev/null; then
            if [ "$VERBOSE" = "true" ]; then
                echo "$body" | jq '.'
            else
                echo "$body" | jq -C '.' | head -20
            fi
        else
            echo "$body" | head -10
        fi

        return 0
    else
        print_failure "Expected status $expected_status but got $http_code"
        echo "$body"
        return 1
    fi
}

check_api_health() {
    print_header "Checking API Health"

    if curl -s --connect-timeout 5 "$API_URL/user/profile" > /dev/null; then
        print_success "API is reachable at $API_URL"
        return 0
    else
        print_failure "API is not reachable at $API_URL"
        echo ""
        echo "Please ensure the mock API is running:"
        echo "  docker-compose -f docker-compose.dev.yml up mock-api"
        echo "or"
        echo "  mockoon-cli start --data mockoon-data.json --port 3000"
        exit 1
    fi
}

###############################################################################
# Test Suites
###############################################################################

test_courses_endpoint() {
    print_header "Testing Courses Endpoints"

    # Test: Get all courses
    test_endpoint "GET" "/courses" 200 "Get all courses"

    # Test: Get course by ID (valid)
    test_endpoint "GET" "/courses/1" 200 "Get course with ID 1"
    test_endpoint "GET" "/courses/2" 200 "Get course with ID 2"
    test_endpoint "GET" "/courses/3" 200 "Get course with ID 3"
    test_endpoint "GET" "/courses/4" 200 "Get course with ID 4"

    # Test: Get course by ID (invalid - 404)
    test_endpoint "GET" "/courses/999" 404 "Get course with invalid ID (should return 404)"
}

test_lessons_endpoint() {
    print_header "Testing Lessons Endpoints"

    # Test: Get lesson details
    test_endpoint "GET" "/lessons/lesson-1" 200 "Get lesson-1 details"
    test_endpoint "GET" "/lessons/lesson-2" 200 "Get lesson-2 details"
    test_endpoint "GET" "/lessons/lesson-7" 200 "Get lesson-7 details"
    test_endpoint "GET" "/lessons/lesson-8" 200 "Get lesson-8 details"

    # Test: Get lesson with invalid ID
    test_endpoint "GET" "/lessons/invalid-lesson" 404 "Get lesson with invalid ID (should return 404)"
}

test_progress_endpoint() {
    print_header "Testing Progress Endpoints"

    # Test: Update progress (success)
    local progress_data='{
        "lessonId": "lesson-1",
        "courseId": "1",
        "completed": true,
        "watchedDuration": 930,
        "totalDuration": 930,
        "progressPercentage": 100
    }'
    test_endpoint "POST" "/progress" 200 "Update progress (completed lesson)" "$progress_data"

    # Test: Update progress (in progress)
    local progress_data_partial='{
        "lessonId": "lesson-2",
        "courseId": "1",
        "completed": false,
        "watchedDuration": 450,
        "totalDuration": 1335,
        "progressPercentage": 33
    }'
    test_endpoint "POST" "/progress" 200 "Update progress (partial completion)" "$progress_data_partial"
}

test_user_endpoint() {
    print_header "Testing User Endpoints"

    # Test: Get user profile
    test_endpoint "GET" "/user/profile" 200 "Get user profile"
}

test_reports_endpoint() {
    print_header "Testing Reports Endpoints"

    # Test: Get progress reports
    test_endpoint "GET" "/reports" 200 "Get progress reports"
}

test_cors() {
    print_header "Testing CORS Configuration"

    ((TESTS_RUN++))
    print_test "CORS preflight request"

    response=$(curl -s -i -X OPTIONS "$API_URL/courses" \
        -H "Origin: http://localhost:5173" \
        -H "Access-Control-Request-Method: GET")

    if echo "$response" | grep -q "Access-Control-Allow-Origin: \*"; then
        print_success "CORS headers present"
        [ "$VERBOSE" = "true" ] && echo "$response" | grep "Access-Control"
    else
        print_failure "CORS headers missing or incorrect"
        echo "$response"
    fi
}

###############################################################################
# Performance Tests
###############################################################################

test_performance() {
    print_header "Testing API Performance"

    ((TESTS_RUN++))
    print_test "Response time for /courses endpoint"

    start_time=$(date +%s%N)
    curl -s "$API_URL/courses" > /dev/null
    end_time=$(date +%s%N)

    duration=$(( (end_time - start_time) / 1000000 ))

    if [ "$duration" -lt 1000 ]; then
        print_success "Response time: ${duration}ms (good)"
    elif [ "$duration" -lt 2000 ]; then
        print_info "Response time: ${duration}ms (acceptable)"
        ((TESTS_PASSED++))
    else
        print_failure "Response time: ${duration}ms (slow)"
    fi
}

###############################################################################
# Integration Tests
###############################################################################

test_integration() {
    print_header "Integration Tests"

    ((TESTS_RUN++))
    print_test "Complete user journey: Browse courses → Get details → Update progress"

    # Step 1: Get courses
    courses=$(curl -s "$API_URL/courses")
    if echo "$courses" | jq -e '.courses[0].id' > /dev/null 2>&1; then
        course_id=$(echo "$courses" | jq -r '.courses[0].id')
        print_success "Step 1: Retrieved courses (course ID: $course_id)"
    else
        print_failure "Step 1: Failed to retrieve courses"
        return 1
    fi

    # Step 2: Get course details
    course_detail=$(curl -s "$API_URL/courses/$course_id")
    if echo "$course_detail" | jq -e '.modules[0].lessons[0].id' > /dev/null 2>&1; then
        lesson_id=$(echo "$course_detail" | jq -r '.modules[0].lessons[0].id')
        print_success "Step 2: Retrieved course details (lesson ID: $lesson_id)"
    else
        print_failure "Step 2: Failed to retrieve course details"
        return 1
    fi

    # Step 3: Get lesson details
    lesson_detail=$(curl -s "$API_URL/lessons/$lesson_id")
    if echo "$lesson_detail" | jq -e '.videoUrl' > /dev/null 2>&1; then
        print_success "Step 3: Retrieved lesson details"
    else
        print_failure "Step 3: Failed to retrieve lesson details"
        return 1
    fi

    # Step 4: Update progress
    progress_update="{
        \"lessonId\": \"$lesson_id\",
        \"courseId\": \"$course_id\",
        \"completed\": true,
        \"watchedDuration\": 930,
        \"totalDuration\": 930,
        \"progressPercentage\": 100
    }"
    progress_response=$(curl -s -X POST "$API_URL/progress" \
        -H "Content-Type: application/json" \
        -d "$progress_update")

    if echo "$progress_response" | jq -e '.success' > /dev/null 2>&1; then
        print_success "Step 4: Updated progress successfully"
        ((TESTS_PASSED++))
    else
        print_failure "Step 4: Failed to update progress"
        return 1
    fi
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║             E-Learning Platform API Test Suite                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "API URL: $API_URL"
    echo "Verbose: $VERBOSE"
    echo ""

    # Check dependencies
    if ! command -v jq &> /dev/null; then
        print_info "jq not found. Install it for better output formatting:"
        print_info "  macOS: brew install jq"
        print_info "  Ubuntu: sudo apt-get install jq"
        echo ""
    fi

    # Check API health
    check_api_health

    # Run test suites
    test_courses_endpoint
    test_lessons_endpoint
    test_progress_endpoint
    test_user_endpoint
    test_reports_endpoint
    test_cors
    test_performance
    test_integration

    # Print summary
    print_header "Test Summary"
    echo "Total Tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""

    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        exit 1
    fi
}

# Run main function
main
