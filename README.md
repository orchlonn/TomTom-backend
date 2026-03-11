# TomTom Backend

Minimal Express backend for:

- user registration
- user login
- current user lookup
- saving favorite routes
- fetching favorite routes
- deleting favorite routes

## Setup

1. Copy `.env.example` to `.env`
2. Set your MySQL credentials in `.env`
3. Run `npm start`

The server creates the `users` and `favorite_routes` tables automatically if they do not already exist.
