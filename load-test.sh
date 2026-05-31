#!/usr/bin/env bash
# A wrapper script to make inputing args for the load tester
# more user friendly
#
# Usage:
#   sh load-test.sh <ROUTE> <K6 ARGS>

# ensures that k6 is installed on your system
if ! command -v k6 >/dev/null 2>&1; then
    echo "k6 is not installed on your machine, it is required to run the testing, install with brew install k6 for MacOS"
    exit 1
fi


# checks the route is specified 
trpc_route=$1
shift 1
if [ -z "$trpc_route" ]; then 
  echo "No route specified, a TRPC route must be specified as the first argument"
  exit 1
fi

# first compile the ts files into a single js for k6
npm run build:k6

# run the k6 load testing
echo "Load testing on route $trpc_route"
k6 run -e ROUTE=$trpc_route $@ ./src/utils/load_testing/load-test-compiled.js


