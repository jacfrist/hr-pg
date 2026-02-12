# HR-PG (Human Resources - Professional Gauntlet)

A turn-based interview simulator that reimagines the hiring process as a retro 16-bit boss battle. Practice your interview skills by battling recruiter bosses with high-quality STAR-method responses!

## Overview

HR-PG helps job seekers prepare for interviews through an engaging, gamified experience. Players choose a role, answer behavioral and technical questions, and receive immediate feedback on answer quality translated into "Attack Damage" against the recruiter boss.

### Target Users
- Students and recent graduates
- Early-to-mid career professionals
- Anyone preparing for job interviews

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Python, Flask, SQLAlchemy, SQLite
- **LLM Integration**: Vanderbilt Amplify API
- **Authentication**: JWT (JSON Web Tokens)

## Project Structure

```
hr-pg/
├── backend/
│   ├── app.py              # Flask API server
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx           # Landing page
│   │   │   ├── LevelSelect.tsx    # Role selection page
│   │   │   ├── Game.tsx           # Main game interface
│   │   │   └── Results.tsx        # Game results page
│   │   ├── App.tsx         # Main app with routing
│   │   └── index.css       # Global styles with Tailwind
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

## Current Features

- **Home Page**: Welcome screen with game introduction and login/register
- **User Accounts**: Sign up and log in to save your game history
- **Level Select**: Choose from different job roles (Software Engineer, Product Manager, Data Scientist)
- **Game Page**: Answer interview questions with health bar system. Progress is saved to the database.
- **Results Page**: Victory or defeat screen based on performance
- **AI Scoring**: Real-time feedback and scoring using Vanderbilt Amplify API

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- pip (Python package manager)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the database migrations (first time only):
   ```bash
   flask db init
   flask db migrate -m "Initial migration"
   flask db upgrade
   ```

5. Run the Flask server:
   ```bash
   python app.py
   ```

   The backend will start at `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

   The frontend will start at `http://localhost:5173`

### Running the Application

1. Start the backend server in one terminal:
   ```bash
   cd backend
   python app.py
   ```

2. Start the frontend development server in another terminal:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

## How to Play

1. **Start Game**: Click "Start Game" on the home page
2. **Select Role**: Choose the job position you want to interview for
3. **Answer Questions**: Respond to interview questions using the STAR method
   - **S**ituation: Describe the context
   - **T**ask: Explain what needed to be done
   - **A**ction: Detail what you did
   - **R**esult: Share the outcome
4. **Watch Health Bars**: Good answers damage the boss, poor answers damage you
5. **Win or Lose**: Deplete the boss's health to "secure the offer" or lose all your health and get "ghosted"

## Future Development

- [x] Integrate Vanderbilt Amplify API for LLM-powered question generation
- [x] Implement NLP-based answer evaluation
- [ ] Add 16-bit retro graphics and animations
- [ ] Include sound effects and background music
- [ ] Expand role catalog with more positions
- [ ] Add difficulty settings
- [x] Implement user accounts and progress tracking
- [ ] Create practice mode with feedback

## Contributing

This is a student project. Contributions and suggestions are welcome!

## License

See LICENSE file for details.
