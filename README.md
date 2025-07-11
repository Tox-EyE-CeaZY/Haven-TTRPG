# Haven - TTRPG Adventure Platform

**Forge your legend, one dice roll at a time.**

Haven is a comprehensive tabletop role-playing game (TTRPG) platform designed to bring players and Game Masters together in immersive digital gaming experiences. Built with modern web technologies, Haven provides all the tools needed to create, manage, and play TTRPGs online.

## 🌟 Features

### For Players
- **User Registration & Authentication** - Secure account creation and login
- **Game Discovery** - Browse and join available games
- **Character Management** - Create and manage roleplay characters with detailed profiles
- **Real-time Chat** - In-game chat with roleplay-specific features
- **Direct Messaging** - Private communication between players
- **Notifications** - Stay updated on game activities and messages
- **Profile Customization** - Personalize your profile with avatars and bios

### For Game Masters (GMs/DMs)
- **Game Creation & Management** - Create and configure game sessions
- **Player Management** - Invite and manage players in your games
- **Master Mode** - Special GM controls and views for game management
- **Real-time Game Tools** - Dice rolling, initiative tracking, and more

### For Administrators
- **Admin Panel** - Comprehensive site administration tools
- **User Management** - Monitor and manage user accounts
- **Content Moderation** - Ensure a safe gaming environment

## 🏗️ Architecture

Haven is built as a full-stack application with separate frontend and backend components:

### Backend (Python/FastAPI)
- **FastAPI** framework for high-performance API development
- **SQLAlchemy** ORM for database management
- **JWT Authentication** for secure user sessions
- **RESTful API** design with automatic OpenAPI documentation
- **File Upload Management** for avatars and character images
- **Email Notifications** system
- **WebSocket Support** for real-time features

### Frontend (Next.js/React)
- **Next.js 15** with App Router for modern React development
- **TypeScript** for type safety
- **Tailwind CSS** for responsive, beautiful UI design
- **Lexical Editor** for rich text editing
- **Real-time Notifications** with toast system
- **Responsive Design** optimized for desktop and mobile

## 🚀 Getting Started

### Prerequisites
- **Python 3.8+** (for backend)
- **Node.js 18+** (for frontend)
- **Git** for version control

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd ttrpg_platform
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment:**
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Configure environment variables:**
   Create a `.env` file in the `ttrpg_platform` directory:
   ```env
   FRONTEND_URL=http://localhost:3000
   MAIL_USERNAME=your_email@gmail.com
   MAIL_PASSWORD=your_app_password
   MAIL_FROM=your_email@gmail.com
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_FROM_NAME=Haven
   ```

6. **Set JWT secret key:**
   Edit `app/auth.py` and replace `"YOUR_VERY_SECRET_KEY"` with a secure random string.

7. **Start the backend server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

The API will be available at `http://localhost:8000` with documentation at `http://localhost:8000/docs`.

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd my-ttrpg-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env.local` file in the `my-ttrpg-frontend` directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000`.

## 📁 Project Structure

```
Haven/
├── my-ttrpg-frontend/          # Next.js frontend application
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/         # Reusable React components
│   │   └── contexts/           # React contexts for state management
│   ├── public/                 # Static assets
│   └── package.json
├── ttrpg_platform/             # FastAPI backend application
│   ├── app/                    # Application code
│   │   ├── routers/            # API route handlers
│   │   ├── models.py           # Database models
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── crud.py             # Database operations
│   │   └── main.py             # Application entry point
│   ├── _data/                  # User data storage
│   └── requirements.txt
└── README.md                   # This file
```

## 🔧 Technologies Used

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **SQLAlchemy** - SQL toolkit and ORM
- **Pydantic** - Data validation using Python type annotations
- **Python-Jose** - JWT token handling
- **Bcrypt** - Password hashing
- **FastAPI-Mail** - Email sending capabilities
- **Uvicorn** - ASGI server implementation

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - JavaScript library for building user interfaces
- **TypeScript** - Typed superset of JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Heroicons** - Beautiful hand-crafted SVG icons
- **Lexical** - Extensible rich text editor framework
- **React Markdown** - Render Markdown as React components

## 🎮 Key Features in Detail

### Character Management
- Create detailed character profiles with images
- Support for character galleries and reference images
- Rich text descriptions for character lore and abilities
- Character sharing between users

### Game System
- Create and manage TTRPG game sessions
- Player invitation and management system
- Real-time game chat with roleplay features
- Dice rolling and game mechanics support

### Communication
- Real-time direct messaging between users
- In-game chat with different message types (character, GM, system)
- Notification system for important updates
- Email digest notifications

### User Experience
- Responsive design for all screen sizes
- Dark theme optimized for long gaming sessions
- Intuitive navigation and user interface
- Toast notifications for user feedback

## 🛣️ Development Roadmap

### Completed Features
- ✅ User registration and authentication
- ✅ Basic game creation and management
- ✅ Character profile system
- ✅ Direct messaging
- ✅ Real-time notifications
- ✅ File upload system
- ✅ Admin panel basics

### In Progress
- 🔄 WebSocket integration for real-time chat
- 🔄 Enhanced game management tools
- 🔄 Character sheet templates
- 🔄 Mobile responsiveness improvements

### Planned Features
- 📋 Advanced dice rolling system
- 📋 Initiative tracker
- 📋 Game system templates (D&D, Pathfinder, etc.)
- 📋 Voice/video chat integration
- 📋 Map and token system
- 📋 Campaign management tools
- 📋 Player statistics and achievements

## 🤝 Contributing

We welcome contributions to Haven! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and conventions
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure both frontend and backend tests pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with love for the TTRPG community
- Inspired by the need for better online gaming tools
- Special thanks to all contributors and testers

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/Tox-EyE-CeaZY/Haven-TTRPG/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Tox-EyE-CeaZY/Haven-TTRPG/discussions)
- **Documentation**: Available at `/docs` when running the backend

---

**Ready to start your adventure?** Set up your development environment and begin building the future of online TTRPG gaming!

*"In every great story, the heroes choose their own path. In Haven, you write the legend."*
