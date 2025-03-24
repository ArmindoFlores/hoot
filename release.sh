#!/bin/bash
echo "Running database migrations..."
cd backend
flask db upgrade