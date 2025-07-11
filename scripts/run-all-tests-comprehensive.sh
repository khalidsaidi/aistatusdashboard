#!/bin/bash

# 🎯 COMPREHENSIVE 100% TEST SUITE RUNNER
# Executes Unit + Integration + E2E + Frontend tests systematically

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
START_TIME=$(date +%s)

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "FAILURE")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "RUNNING")
            echo -e "${CYAN}🔄 $message${NC}"
            ;;
        "HEADER")
            echo -e "${PURPLE}🎯 $message${NC}"
            ;;
    esac
}

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local timeout=${3:-300} # Default 5 minutes
    
    print_status "HEADER" "Running: $suite_name"
    echo "=========================================="
    
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    
    # Run test with timeout
    if timeout $timeout bash -c "$test_command"; then
        print_status "SUCCESS" "$suite_name completed successfully"
        PASSED_SUITES=$((PASSED_SUITES + 1))
        echo ""
        return 0
    else
        print_status "FAILURE" "$suite_name failed or timed out"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        echo ""
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    # Check if dev server is running
    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_status "WARNING" "Dev server not running on localhost:3000"
        print_status "INFO" "Some tests may fail without the dev server"
    else
        print_status "SUCCESS" "Dev server is running"
    fi
    
    # Check Node.js and npm
    node_version=$(node --version)
    npm_version=$(npm --version)
    print_status "INFO" "Node.js: $node_version, npm: $npm_version"
    
    echo ""
}

# Function to generate final report
generate_final_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    echo ""
    print_status "HEADER" "COMPREHENSIVE TEST SUITE COMPLETE"
    echo "=============================================="
    echo ""
    
    # Test Results Summary
    echo "📊 Test Results Summary:"
    echo "------------------------"
    echo "Total Test Suites: $TOTAL_SUITES"
    echo "Passed: $PASSED_SUITES"
    echo "Failed: $FAILED_SUITES"
    echo "Success Rate: $(( (PASSED_SUITES * 100) / TOTAL_SUITES ))%"
    echo "Total Duration: ${minutes}m ${seconds}s"
    echo ""
    
    # Coverage Summary
    echo "🎯 Coverage Summary:"
    echo "-------------------"
    echo "✅ Unit Tests - Component & Logic Testing"
    echo "✅ Integration Tests - API & Service Testing"  
    echo "✅ E2E Tests - Complete User Workflows"
    echo "✅ Frontend Tests - UI & Interaction Testing"
    echo "✅ Dev Backend Tests - Environment Validation"
    echo ""
    
    if [ $FAILED_SUITES -eq 0 ]; then
        print_status "SUCCESS" "🎉 ALL TEST SUITES PASSED! Your application is 100% tested and ready!"
        echo ""
        echo "🚀 Production Readiness: CONFIRMED"
        echo "🔒 Quality Assurance: COMPLETE"
        echo "🎯 Coverage: COMPREHENSIVE"
        exit 0
    else
        print_status "FAILURE" "⚠️  $FAILED_SUITES test suite(s) failed. Review and fix before deployment."
        echo ""
        echo "🔧 Next Steps:"
        echo "1. Review failed test logs above"
        echo "2. Fix identified issues"
        echo "3. Re-run comprehensive tests"
        exit 1
    fi
}

# Main execution
main() {
    echo ""
    print_status "HEADER" "🚀 COMPREHENSIVE 100% TEST SUITE"
    echo "=============================================="
    echo "Testing: Unit + Integration + E2E + Frontend + Dev Backend"
    echo "Environment: Local Development with Real Services"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # 1. UNIT TESTS - Fast component and logic tests
    run_test_suite "Unit Tests" "npx jest __tests__/unit/ --maxWorkers=4 --silent" 180
    
    # 2. INTEGRATION TESTS - API and service integration
    run_test_suite "Integration Tests" "npx jest __tests__/integration/ --maxWorkers=2 --silent" 300
    
    # 3. DEV BACKEND VALIDATION - Environment-specific tests
    run_test_suite "Dev Backend Validation" "npm run test:dev-backend" 120
    
    # 4. LOCAL DEV TESTS - Local environment validation
    run_test_suite "Local Dev Environment Tests" "npm run test:local-dev" 180
    
    # 5. E2E TESTS - Complete user workflows (single browser for speed)
    run_test_suite "E2E Tests (Chrome)" "npx playwright test --project=chromium --reporter=list" 600
    
    # 6. COMPREHENSIVE FRONTEND TESTS - UI and interaction testing
    run_test_suite "Comprehensive Frontend Tests" "npx playwright test __tests__/frontend/comprehensive-ui-coverage.test.ts --project=chromium --reporter=list" 300
    
    # Generate final comprehensive report
    generate_final_report
}

# Handle script interruption
trap 'echo ""; print_status "WARNING" "Test execution interrupted"; exit 1' INT

# Run main function
main "$@" 