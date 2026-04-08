#!/bin/bash

###############################################################################
# External Code Review Script
# Calls OpenAI (Chat Completions API) or GLM (z.ai API) for adversarial code review.
# Used by .claude/agents/openai-code-review.md and glm-code-review.md
#
# Usage:
#   scripts/external-code-review.sh --provider {openai|glm} --story-id E##-S## --output report.md
#
# Exit codes: 0=success, 1=skipped (no key/CLI), 2=API error
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
PROVIDER=""
STORY_ID=""
OUTPUT_PATH=""
MAX_DIFF_LINES="${MAX_DIFF_LINES:-2000}"
MAX_RETRIES=2
RETRY_DELAY=5
TIMEOUT=120

# OpenAI model configuration
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4.1}"
OPENAI_API_URL="${OPENAI_API_URL:-https://api.openai.com/v1/chat/completions}"

# GLM model configuration
GLM_MODEL="${GLM_MODEL:-glm-5.1}"
GLM_API_URL="${GLM_API_URL:-https://api.z.ai/api/anthropic/v1/messages}"

###############################################################################
# Helper Functions
###############################################################################

print_info() {
    echo -e "${BLUE}[external-review]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[external-review]${NC} $1" >&2
}

print_warn() {
    echo -e "${YELLOW}[external-review]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[external-review]${NC} $1" >&2
}

usage() {
    echo "Usage: $0 --provider {openai|glm} --story-id E##-S## --output report.md"
    echo ""
    echo "Options:"
    echo "  --provider    API provider: openai (Chat Completions API) or glm (z.ai API)"
    echo "  --story-id    Story identifier (e.g., E60-S01)"
    echo "  --output      Path to write the markdown report"
    echo ""
    echo "Environment variables:"
    echo "  OPENAI_API_KEY   Required for --provider openai"
    echo "  ZAI_API_KEY      Required for --provider glm"
    echo "  MAX_DIFF_LINES   Max diff lines to send (default: 2000)"
    echo "  OPENAI_MODEL     OpenAI model name (default: gpt-4.1)"
    echo "  OPENAI_API_URL   OpenAI API endpoint (default: https://api.openai.com/v1/chat/completions)"
    echo "  GLM_MODEL        GLM model name (default: glm-5.1)"
    echo "  GLM_API_URL      GLM API endpoint (default: https://api.z.ai/api/anthropic/v1/messages)"
    exit 1
}

skip_exit() {
    local reason="$1"
    print_warn "Skipped: $reason"
    echo "{\"skipped\": true, \"reason\": \"$reason\"}"
    exit 1
}

error_exit() {
    local reason="$1"
    print_error "Error: $reason"
    echo "{\"error\": true, \"reason\": \"$reason\"}"
    exit 2
}

###############################################################################
# Parse Arguments
###############################################################################

while [[ $# -gt 0 ]]; do
    case "$1" in
        --provider) PROVIDER="$2"; shift 2 ;;
        --story-id) STORY_ID="$2"; shift 2 ;;
        --output) OUTPUT_PATH="$2"; shift 2 ;;
        --help|-h) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

[[ -z "$PROVIDER" ]] && { echo "Error: --provider is required"; usage; }
[[ -z "$STORY_ID" ]] && { echo "Error: --story-id is required"; usage; }
[[ -z "$OUTPUT_PATH" ]] && { echo "Error: --output is required"; usage; }

###############################################################################
# Adversarial Review Prompt (shared across providers)
###############################################################################

REVIEW_PROMPT="You are an adversarial code reviewer. Your job is to find real bugs, security issues, and correctness problems. You are reviewing code for Knowlune, a React 19 + TypeScript personal learning platform using Vite 6, React Router v7, Tailwind CSS v4, Dexie.js (IndexedDB), and Zustand.

Rules:
1. Report only genuine issues worth fixing. Zero findings is acceptable for clean code.
2. Every finding must cite file:line, explain the problem, and suggest a fix.
3. Focus on: security, correctness, silent failures, edge cases, race conditions, data loss.
4. Do NOT flag: style preferences, naming opinions, or things a linter would catch.
5. Score each finding with confidence (0-100) and severity (BLOCKER/HIGH/MEDIUM/NIT).
6. Maximum 10 findings. If more exist, keep highest-impact only.

Respond in this exact markdown format:

### Findings

#### Blockers
- **[file:line] (confidence: ##)**: [Description]. Fix: [Suggestion].

#### High Priority
- **[file:line] (confidence: ##)**: [Description]. Fix: [Suggestion].

#### Medium
- **[file:line] (confidence: ##)**: [Description]. Fix: [Suggestion].

#### Nits
- **[file:line] (confidence: ##)**: [Detail].

---
Issues found: [N] | Blockers: [N] | High: [N] | Medium: [N] | Nits: [N]"

###############################################################################
# Provider: OpenAI (Codex CLI)
###############################################################################

run_openai() {
    # Check API key
    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
        skip_exit "OPENAI_API_KEY not set"
    fi

    # Check jq availability
    if ! command -v jq &>/dev/null; then
        error_exit "jq is required for OpenAI provider (brew install jq)"
    fi

    print_info "Running OpenAI (${OPENAI_MODEL}) adversarial review for ${STORY_ID}..."

    # Get diff, truncate if needed
    local diff_content
    diff_content=$(git diff main...HEAD 2>/dev/null || echo "")

    if [[ -z "$diff_content" ]]; then
        skip_exit "No diff found between main and HEAD"
    fi

    local diff_lines
    diff_lines=$(echo "$diff_content" | wc -l | tr -d ' ')

    if [[ $diff_lines -gt $MAX_DIFF_LINES ]]; then
        print_warn "Diff truncated from ${diff_lines} to ${MAX_DIFF_LINES} lines"
        diff_content=$(echo "$diff_content" | head -n "$MAX_DIFF_LINES")
        diff_content="${diff_content}

... [TRUNCATED: ${diff_lines} total lines, showing first ${MAX_DIFF_LINES}]"
    fi

    # Get story context (first 100 lines of story file if it exists)
    local story_context=""
    local story_file
    story_file=$(find docs/implementation-artifacts -name "*${STORY_ID,,}*" -o -name "*$(echo "$STORY_ID" | tr '[:upper:]' '[:lower:]' | tr '-' '-')*" 2>/dev/null | head -1)
    if [[ -n "$story_file" && -f "$story_file" ]]; then
        story_context=$(head -100 "$story_file")
    fi

    # Build user message
    local user_message="Story: ${STORY_ID}
${story_context:+
Story context:
${story_context}
}
Code diff (git diff main...HEAD):
${diff_content}"

    # Construct JSON payload with jq (OpenAI Chat Completions format)
    local payload
    payload=$(jq -n \
        --arg model "$OPENAI_MODEL" \
        --arg system "$REVIEW_PROMPT" \
        --arg user_msg "$user_message" \
        '{
            model: $model,
            max_tokens: 4096,
            messages: [
                { role: "system", content: $system },
                { role: "user", content: $user_msg }
            ]
        }')

    local attempt=0
    local response=""

    while [[ $attempt -le $MAX_RETRIES ]]; do
        if [[ $attempt -gt 0 ]]; then
            print_warn "Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi

        set +e
        response=$(curl -s --max-time "$TIMEOUT" \
            -H "Authorization: Bearer ${OPENAI_API_KEY}" \
            -H "Content-Type: application/json" \
            "$OPENAI_API_URL" \
            -d "$payload" 2>&1)
        local exit_code=$?
        set -e

        if [[ $exit_code -ne 0 ]]; then
            print_warn "curl failed with exit code ${exit_code}"
            ((attempt++))
            continue
        fi

        # Check for API errors
        local error_message
        error_message=$(echo "$response" | jq -r '.error.message // empty' 2>/dev/null)

        if [[ -n "$error_message" ]]; then
            local error_type
            error_type=$(echo "$response" | jq -r '.error.type // "unknown"' 2>/dev/null)
            print_warn "API error: ${error_type} — ${error_message}"

            # Retry on rate limits and server errors
            if [[ "$error_type" == "rate_limit_error" || "$error_type" == "server_error" || "$error_type" == "overloaded_error" ]]; then
                ((attempt++))
                continue
            else
                error_exit "OpenAI API error: ${error_type} — ${error_message}"
            fi
        fi

        # Extract content from OpenAI Chat Completions response
        local review_text
        review_text=$(echo "$response" | jq -r '.choices[0].message.content // empty' 2>/dev/null)

        if [[ -n "$review_text" ]]; then
            print_success "OpenAI review completed"
            echo "$review_text"
            return 0
        else
            print_warn "Empty response from OpenAI API"
            ((attempt++))
            continue
        fi
    done

    error_exit "OpenAI API failed after ${MAX_RETRIES} retries"
}

###############################################################################
# Provider: GLM (z.ai Anthropic-compatible API)
###############################################################################

run_glm() {
    # Check API key
    if [[ -z "${ZAI_API_KEY:-}" ]]; then
        skip_exit "ZAI_API_KEY not set"
    fi

    # Check jq availability
    if ! command -v jq &>/dev/null; then
        error_exit "jq is required for GLM provider (brew install jq)"
    fi

    print_info "Running GLM (${GLM_MODEL}) adversarial review for ${STORY_ID}..."

    # Get diff, truncate if needed
    local diff_content
    diff_content=$(git diff main...HEAD 2>/dev/null || echo "")

    if [[ -z "$diff_content" ]]; then
        skip_exit "No diff found between main and HEAD"
    fi

    local diff_lines
    diff_lines=$(echo "$diff_content" | wc -l | tr -d ' ')

    if [[ $diff_lines -gt $MAX_DIFF_LINES ]]; then
        print_warn "Diff truncated from ${diff_lines} to ${MAX_DIFF_LINES} lines"
        diff_content=$(echo "$diff_content" | head -n "$MAX_DIFF_LINES")
        diff_content="${diff_content}

... [TRUNCATED: ${diff_lines} total lines, showing first ${MAX_DIFF_LINES}]"
    fi

    # Get story context (first 100 lines of story file if it exists)
    local story_context=""
    local story_file
    story_file=$(find docs/implementation-artifacts -name "*${STORY_ID,,}*" -o -name "*$(echo "$STORY_ID" | tr '[:upper:]' '[:lower:]' | tr '-' '-')*" 2>/dev/null | head -1)
    if [[ -n "$story_file" && -f "$story_file" ]]; then
        story_context=$(head -100 "$story_file")
    fi

    # Build user message
    local user_message="Story: ${STORY_ID}
${story_context:+
Story context:
${story_context}
}
Code diff (git diff main...HEAD):
${diff_content}"

    # Construct JSON payload safely with jq
    local payload
    payload=$(jq -n \
        --arg model "$GLM_MODEL" \
        --arg system "$REVIEW_PROMPT" \
        --arg user_msg "$user_message" \
        '{
            model: $model,
            max_tokens: 4096,
            system: $system,
            messages: [
                { role: "user", content: $user_msg }
            ]
        }')

    local attempt=0
    local response=""

    while [[ $attempt -le $MAX_RETRIES ]]; do
        if [[ $attempt -gt 0 ]]; then
            print_warn "Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi

        set +e
        response=$(curl -s --max-time "$TIMEOUT" \
            -H "x-api-key: ${ZAI_API_KEY}" \
            -H "Content-Type: application/json" \
            -H "anthropic-version: 2023-06-01" \
            "$GLM_API_URL" \
            -d "$payload" 2>&1)
        local exit_code=$?
        set -e

        if [[ $exit_code -ne 0 ]]; then
            print_warn "curl failed with exit code ${exit_code}"
            ((attempt++))
            continue
        fi

        # Check for API errors
        local error_type
        error_type=$(echo "$response" | jq -r '.error.type // empty' 2>/dev/null)

        if [[ -n "$error_type" ]]; then
            local error_msg
            error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"' 2>/dev/null)
            print_warn "API error: ${error_type} — ${error_msg}"

            # Retry on rate limits and server errors
            if [[ "$error_type" == "rate_limit_error" || "$error_type" == "overloaded_error" || "$error_type" == "api_error" ]]; then
                ((attempt++))
                continue
            else
                error_exit "GLM API error: ${error_type} — ${error_msg}"
            fi
        fi

        # Extract content from Anthropic-format response
        local review_text
        review_text=$(echo "$response" | jq -r '.content[0].text // empty' 2>/dev/null)

        if [[ -n "$review_text" ]]; then
            print_success "GLM review completed"
            echo "$review_text"
            return 0
        else
            print_warn "Empty response from GLM API"
            ((attempt++))
            continue
        fi
    done

    error_exit "GLM API failed after ${MAX_RETRIES} retries"
}

###############################################################################
# Main: Run provider and write report
###############################################################################

print_info "Provider: ${PROVIDER} | Story: ${STORY_ID}"

# Run the appropriate provider
review_output=""
case "$PROVIDER" in
    openai)
        review_output=$(run_openai)
        provider_name="OpenAI (Codex CLI)"
        ;;
    glm)
        review_output=$(run_glm)
        provider_name="GLM (${GLM_MODEL})"
        ;;
    *)
        echo "Error: Unknown provider '$PROVIDER'. Use 'openai' or 'glm'."
        exit 1
        ;;
esac

# Write the report
cat > "$OUTPUT_PATH" <<EOF
## External Code Review: ${STORY_ID} — ${provider_name}

**Model**: ${provider_name}
**Date**: $(date +%Y-%m-%d)
**Story**: ${STORY_ID}

${review_output}
EOF

print_success "Report written to ${OUTPUT_PATH}"
exit 0
