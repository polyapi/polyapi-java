#!/bin/sh
# yarn prisma migrate deploy
# nohup yarn run start:prod &
# cd science
# nohup uwsgi --ini ./uwsgi.ini

yarn prisma migrate deploy

# Function to handle the SIGTERM signal
handle_sigterm() 
{
    echo "Received SIGTERM, shutting down gracefully"
    kill "$child_pid";
}

echo "Entrypoint process id: $$"

# Run the application server and store its process ID
nohup node dist/src/main &
child_pid=$!

echo "node process id: $child_pid"

cd science
nohup uwsgi --ini ./uwsgi.ini

# Set up signal trapping
trap handle_sigterm TERM QUIT INT

# Wait for the child process to exit
wait $child_pid
