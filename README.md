# 🚀 Schevo — Visual Schema Designer & API Generator

<p align="center">

  **Design. Configure. Generate.**

  An intuitive platform designed to simplify backend development through structured database schema management and automated backend generation.

</p>

---

## ✨ About Schevo

**Schevo** is a web-based platform that aims to make backend development simpler, faster, and more organized.

It provides a centralized workspace where developers can create projects, design database schemas, manage tables and columns, define relationships, and work towards generating backend code and API endpoints.

Schevo aims to reduce repetitive manual development tasks and provide a structured approach to backend development through an easy-to-use interface.

## 🌟 Key Features

- 🔐 **User Authentication** — User registration and login functionality.
- 📁 **Project Management** — Create and manage multiple development projects.
- 🗄️ **Schema Management** — Organize database schemas within projects.
- 📋 **Table Management** — Create tables and configure their columns and data types.
- 🔗 **Relationship Management** — Define relationships between database tables.
- ⚡ **Backend Generation** — Planned functionality for generating backend code and API endpoints.
- 📦 **Generated File Management** — Organize and manage generated project resources.

## 🛠️ Tech Stack

| Technology | Purpose |
|:---|:---|
| ⚛️ React.js | Frontend Development |
| 🟢 JavaScript | Programming Language |
| 🎨 CSS | Styling and UI |
| 🐘 PostgreSQL | Database Management |
| 🟩 Node.js | Planned Backend Runtime |
| 🚂 Express.js | Planned Backend Framework |
| ▲ Vercel | Frontend Deployment |
| 🐙 Git & GitHub | Version Control |

## 🏗️ Project Architecture

Schevo is designed around a modular architecture consisting of:

- **Frontend:** React.js handles the user interface and interactions.
- **Backend:** Node.js and Express.js are planned for server-side logic and API development.
- **Database:** PostgreSQL manages application data and project configurations.
- **Generation Module:** Planned to process database configurations and generate backend resources.

## 🗃️ Database Structure

The application uses the following primary database tables:

| Table | Description |
|:---|:---|
| `users` | Stores user information |
| `projects` | Stores user-created projects |
| `schemas` | Stores project database schemas |
| `tables` | Stores table definitions |
| `columns` | Stores column configurations |
| `relationships` | Stores table relationships |
| `generations` | Maintains generation records |
| `generatedFiles` | Stores generated file information |

## ⚙️ Getting Started

Follow these steps to run the project locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- npm
- [PostgreSQL](https://www.postgresql.org/)
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
```

### 2. Navigate to the Project

```bash
cd Schevo
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:5000
```

Configure the URL according to your backend setup.

### 5. Run the Development Server

```bash
npm run dev
```

Open the application in your browser:

```text
http://localhost:5173
```

## 🔮 Future Enhancements

- Automated REST API generation.
- Dynamic backend code generation.
- Automatic model and controller creation.
- API documentation generation.
- Downloadable backend project files.
- Support for multiple database systems.
- Enhanced authentication and authorization.

## 🚀 Deployment

The frontend application is deployed using **Vercel**.

The deployment process includes connecting the GitHub repository, configuring environment variables, and building the application for production.

## 🤝 Contributing

Contributions and suggestions are welcome!

1. Fork this repository.
2. Create a new branch.
3. Make your changes.
4. Commit and push your changes.
5. Open a Pull Request.


<p align="center">

  **Built with ❤️ for developers who want to simplify backend development.**

  ### 🚀 Schevo — From Database Design to Backend Generation.

</p>
