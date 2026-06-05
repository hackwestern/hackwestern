#!/usr/bin/env bash
# A wrapper script to make inputing args for the load tester
# more user friendly
#
# Usage:
#   sh load-test.sh <ROUTE> <Auth [n(no),y(yes),o(organizer)]> <K6 ARGS>

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

auth=$1
shift 1
if [[ "$auth" != "n" && "$auth" != "y" && "$auth" != "o" ]]; then
  echo "No auth is specified, please specify [n(no),y(yes),o(organizer)]"
  exit 1;
fi 

schema=$(curl -s "http://localhost:3000/api/schema")
if [ $? -ne 0 ]; then 
  echo "Unable to fetch the schema from the server, exit code $?"
  exit 1
fi


# first compile the ts files into a single js for k6
npm run build:k6

if [[ "$auth" != "n" ]]; then 
  echo "Adding test users..."
  # seed the db with test users
  users=$(AUTH_TYPE="$auth" tsx --env-file=.env -e 'import("./src/utils/load_testing/authPrep.ts").then((mod) => mod.SeedDBForLoadTesting())')
  if [ $? -ne 0 ]; then 
    echo "Error when adding the test users to the db"
    exit 1
  fi 
  # set the trap after the users were added
  trap cleanup EXIT

  echo "Test users have been added"
fi 

# run the k6 load testing
echo "Load testing on route $trpc_route"
k6 run -e ROUTE="$trpc_route" -e USERS="$users" -e SCHEMA="$schema" $@ ./src/utils/load_testing/load-test-compiled.js



cleanup() {
  if [[ "$auth" != "n" ]]; then 
    echo "Removing test users... (this can take some time, please dont cancel this)"
    USERS="$users" tsx --env-file=.env -e "import('./src/utils/load_testing/authPrep.ts').then((mod) => mod.RemoveSeededUsers())"
    echo "Test users removed"
  fi

  exit 130
}

