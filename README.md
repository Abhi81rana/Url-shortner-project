# My URL Shortner

A full-stack URL shortener built with **Node.js, Express.js, MongoDB, Mongoose, Nanoid, JWT and bcryptjs**.

This project is now a real multi-user URL shortener backend with:
- user registration and login
- password hashing
- JWT authentication
- per-user URL ownership
- dashboard access for managing a user’s own links
- custom short aliases
- edit and delete support
- redirect tracking and visit analytics
- mobile-responsive frontend

## Features

- Create short URLs from long destinations
- Validate HTTP/HTTPS URLs
- Redirect short URLs to original destinations
- Track visit history including referrer and user-agent
- Support custom aliases like `mybrand` or `promo2025`
- Allow users to edit and delete their own URLs
- Real MongoDB-backed user authentication system
- JWT-protected dashboard endpoints
- Role-based admin support with seeded default admin user
- Browser-based frontend with mobile-friendly layout

## Tech stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- Nanoid
- JWT
- bcryptjs

## Project structure

```text
My URL Shortner/
├── models/
│   ├── url.js
│   └── user.js
├── public/
│   ├── 404.html
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   └── assets/
│       └── favicon.svg
├── routes/
│   └── url.js
├── .env
├── .gitignore
├── package.json
├── README.md
├── server.js
└── node_modules/
```

## 1. Install dependencies

```bash
npm install
```

## 2. Setup environment variables

Create a `.env` file in the project root:

```env
PORT=8000
MONGODB_URI=mongodb://127.0.0.1:27017/url-shortener
BASE_URL=http://localhost:8000
JWT_SECRET=your_super_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

Notes:
- `MONGODB_URI` can be local MongoDB or MongoDB Atlas
- `JWT_SECRET` should be a strong secret in production
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` create the default seeded admin account

## 3. Start the app

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Open the app:

```text
http://localhost:8000
```

## Default admin user

The server automatically creates a default admin account if it does not already exist.

```text
username: admin
password: admin123
```

You can change this by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`.

## User registration and login

### Register a new user

```http
POST /api/auth/register
Content-Type: application/json
```

Body:

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "secret123"
}
```

Response:

```json
{
  "message": "Registration successful",
  "token": "jwt_token_here",
  "user": {
    "id": "...",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

Body:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Or use email instead of username:

```json
{
  "username": "john@example.com",
  "password": "secret123"
}
```

### Get current authenticated user

```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

## URL API endpoints

### Create short URL

```http
POST /api/urls
Content-Type: application/json
```

Body:

```json
{
  "url": "https://example.com",
  "customAlias": "mycustomalias"
}
```

Notes:
- `customAlias` is optional
- alias must be 4 to 20 characters using letters, numbers, `_` or `-`
- if `customAlias` is absent, a random Nanoid-based short ID is generated

### Get all URLs

```http
GET /api/urls
```

### Get a specific URL

```http
GET /api/urls/:shortId
```

### Update URL

```http
PUT /api/urls/:shortId
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

Body:

```json
{
  "redirectURL": "https://google.com",
  "customAlias": "updatedalias"
}
```

### Delete URL

```http
DELETE /api/urls/:shortId
Authorization: Bearer <jwt_token>
```

### Get statistics

```http
GET /api/urls/:shortId/stats
```

### Redirect

```http
GET /:shortId
```

### Dashboard data (user-specific)

```http
GET /api/urls/dashboard
Authorization: Bearer <jwt_token>
```

This returns only the URLs created by the logged-in user.

### Health check

```http
GET /api/health
```

## Redirect tracking

When a user opens a short URL, the app records:
- timestamp
- referrer
- user-agent

This is stored in MongoDB under the URL document's `visitHistory` array.

## Database models

### User model

The `User` model stores:
- username
- email
- passwordHash
- role
- createdAt / updatedAt

### URL model

The `URL` model stores:
- shortId
- redirectURL
- createdBy (user id reference)
- visitHistory
- createdAt / updatedAt

## Dashboard behavior

After login, a user can:
- view their own URLs
- update redirect destination
- change alias
- delete links

Only the logged-in user can edit/delete their own URLs.

## Mobile responsiveness

The frontend is designed to work on mobile devices with responsive CSS breakpoints for smaller screens, including:
- stacked form layout
- full-width buttons on small screens
- dashboard cards that collapse into one column

## Postman example flow

### 1. Register

```http
POST http://localhost:8000/api/auth/register
```

Body:

```json
{
  "username": "demoUser",
  "email": "demo@example.com",
  "password": "demo1234"
}
```

### 2. Copy token from response

```http
Authorization: Bearer <token>
```

### 3. Create short URL

```http
POST http://localhost:8000/api/urls
```

Body:

```json
{
  "url": "https://www.google.com",
  "customAlias": "demo123"
}
```

### 4. View dashboard

```http
GET http://localhost:8000/api/urls/dashboard
Authorization: Bearer <token>
```

### 5. Update URL

```http
PUT http://localhost:8000/api/urls/demo123
Authorization: Bearer <token>
```

Body:

```json
{
  "redirectURL": "https://www.youtube.com",
  "customAlias": "updateddemo"
}
```

### 6. Delete URL

```http
DELETE http://localhost:8000/api/urls/updateddemo
Authorization: Bearer <token>
```

## Good repository description

> Full-stack URL Shortener using Node.js, Express.js, MongoDB, Mongoose, JWT authentication, bcrypt password hashing, custom aliases, and real user-based link management with analytics and redirect tracking.
