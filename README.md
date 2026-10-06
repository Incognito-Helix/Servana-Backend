# Servana Backend

Backend API for Servana, a web application that helps users discover and connect with local service vendors in Lagos.

## Tech Stack

* Node.js
* Express.js
* JavaScript
* REST API
* PostgreSQL
* Prisma ORM
* JWT Authentication
* bcrypt

## Project Structure

```text
├── src
│   ├── app.js
│   ├── server.js
│   ├── routes
│   ├── controllers
│   ├── models
│   ├── middlewares
│   └── utils
├── prisma
│   └── schema.prisma
├── .env.example
├── package.json
├── README.md
└── .gitignore
```

## Getting Started

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

The API runs on:

```text
http://localhost:5000
```

### Health Check

```text
GET /health
```

Expected response:

```json
{
  "status": "success",
  "message": "Servana API is running"
}
```

## Development

This project follows the Servana technical PRD and will be developed incrementally, beginning with the backend foundation and Express application bootstrap.
