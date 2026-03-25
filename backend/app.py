from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import json
import os
import re
import time
from datetime import datetime
from extensions import db, jwt, migrate
from models import User, InterviewSession, Question, Answer, Evaluation
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hr_pg.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET_KEY", "super-secret-dev-key")

# Initialize Extensions
db.init_app(app)
jwt.init_app(app)
migrate.init_app(app, db)

# Amplify API Configuration
AMPLIFY_API_KEY = os.getenv("AMPLIFY_API_KEY")

# Role display names and default difficulty descriptions
ROLE_INFO = {
    "software_engineer": {
        "name": "Software Engineer",
        "difficulty": "Medium",
        "description": "a software engineering position requiring technical problem-solving and coding skills"
    },
    "product_manager": {
        "name": "Product Manager",
        "difficulty": "Hard",
        "description": "a product management role requiring strategic thinking and cross-functional leadership"
    },
    "data_scientist": {
        "name": "Data Scientist",
        "difficulty": "Medium",
        "description": "a data science position requiring analytical skills and machine learning expertise"
    }
}

# Supported difficulty levels (user-selectable)
DIFFICULTY_LEVELS = {"Easy", "Medium", "Hard"}


def normalize_difficulty(difficulty, fallback: str = "Medium") -> str:
    """Normalize a difficulty string to one of Easy/Medium/Hard."""
    if not difficulty:
        return fallback
    d = str(difficulty).strip().lower()
    if d == "easy":
        return "Easy"
    if d == "medium":
        return "Medium"
    if d == "hard":
        return "Hard"
    return fallback

def make_llm_request(messages, max_retries=3, backoff_factor=1.5):

    # Validate input
    if not messages:
        app.logger.error("Messages list cannot be empty")
        return None

    if not isinstance(messages, list):
        app.logger.error("Messages must be a list")
        return None

    if not AMPLIFY_API_KEY:
        app.logger.error("AMPLIFY_API_KEY not found in environment variables")
        return None

    url = "https://prod-api.vanderbilt.ai/chat"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {AMPLIFY_API_KEY}"
    }

    payload = {
        "data": {
            "temperature": 0.7,
            "max_tokens": 4096,
            "dataSources": [],
            "messages": messages,
            "options": {
                "model": {"id": "gpt-4.1-mini"},
                "prompt": messages[0]["content"] if messages else "",
            },
        }
    }

    delay = 1.0
    for attempt in range(max_retries):
        try:
            response = requests.post(
                url, headers=headers, data=json.dumps(payload), timeout=30
            )

            if response.status_code == 200:
                try:
                    response_data = response.json()
                    txt = response_data.get("data", "")
                    if txt:
                        return txt
                    else:
                        app.logger.warning("Empty response received from API")
                        return None
                except json.JSONDecodeError as e:
                    app.logger.error(f"Failed to parse JSON response: {e}")
                    return None

            else:
                app.logger.error(f"Request failed with status code {response.status_code}. Response: {response.text}")

        except requests.exceptions.Timeout:
            app.logger.error(f"Attempt {attempt + 1}: Request timed out")
        except requests.exceptions.ConnectionError:
            app.logger.error(f"Attempt {attempt + 1}: Connection failed")
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Attempt {attempt + 1}: Request failed - {e}")
        except Exception as e:
            app.logger.error(f"Attempt {attempt + 1}: Unexpected error occurred - {e}")
            
        if attempt < max_retries - 1:
            app.logger.info(f"Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= backoff_factor

    app.logger.error("All retries exhausted for LLM request.")
    return None


def generate_question_with_ai(role, question_number, difficulty, interview_type="role", job_description=""):
    """Generate an interview question using the Amplify AI."""
    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])

    interview_mode = "job_description" if str(interview_type).strip().lower() == "job_description" else "role"
    jd_text = (job_description or "").strip()

    if interview_mode == "job_description" and jd_text:
        prompt = f"""You are an expert interviewer for {role_info['description']}.

Generate a behavioral interview question for a candidate. This is question {question_number} of the interview.

Role: {role_info['name']}
Difficulty: {difficulty}
Interview Type: Job Description-Based

Job Description:
{jd_text}

Requirements:
- The question must be directly grounded in the provided job description
- Focus on responsibilities, required skills, domain context, and success criteria from the posting
- Ask one clear behavioral question that tests fit for the actual role
- The question should be appropriate for the {difficulty} difficulty level
- For "Easy" difficulty: Ask straightforward questions about basic experiences
- For "Medium" difficulty: Ask about specific challenges and how they were handled
- For "Hard" difficulty: Ask complex scenario-based questions requiring deep thinking

Respond with ONLY the interview question, nothing else. Do not include any preamble or explanation."""
    else:
        prompt = f"""You are an expert interviewer for {role_info['description']}.

Generate a behavioral interview question for a candidate. This is question {question_number} of the interview.

Role: {role_info['name']}
Difficulty: {difficulty}

Requirements:
- The question should be appropriate for the {difficulty} difficulty level
- For "Easy" difficulty: Ask straightforward questions about basic experiences
- For "Medium" difficulty: Ask about specific challenges and how they were handled
- For "Hard" difficulty: Ask complex scenario-based questions requiring deep thinking

Respond with ONLY the interview question, nothing else. Do not include any preamble or explanation."""

    messages = [{"role": "user", "content": prompt}]

    response = make_llm_request(messages)

    if response:
        # Clean up the response
        question = response.strip()
        # Remove any quotes that might wrap the question
        if question.startswith('"') and question.endswith('"'):
            question = question[1:-1]
        return question

    return None


def grade_answer_with_ai(question, answer, role, difficulty):
    """Grade a candidate's answer using the Amplify AI."""
    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])

    prompt = f"""You are an expert interviewer evaluating a candidate's response for {role_info['description']}.

Interview Question: {question}

Candidate's Answer: {answer}

Role: {role_info['name']}
Difficulty Level: {difficulty}

Please evaluate this answer and provide a score from 0 to 10 based on:
- Relevance to the question (25 points)
- Depth and specificity of the response (25 points)
- Use of concrete examples (25 points)
- Communication clarity and structure (25 points)

For {difficulty} difficulty:
- Easy: Be more lenient in scoring
- Medium: Use standard evaluation criteria
- Hard: Be more rigorous in evaluation

IMPORTANT: You must respond in this EXACT format:
SCORE: [number]
FEEDBACK: [your feedback in 1-2 sentences]

Example response:
SCORE: 7
FEEDBACK: Good use of the STAR method with a relevant example, but could have elaborated more on the specific impact of your actions."""

    messages = [{"role": "user", "content": prompt}]

    response = make_llm_request(messages)

    if response:
        try:
            # Parse the score from the response
            score_match = re.search(r'SCORE:\s*(\d+)', response, re.IGNORECASE)
            feedback_match = re.search(r'FEEDBACK:\s*(.+)', response, re.IGNORECASE | re.DOTALL)

            if score_match:
                score = int(score_match.group(1))
                score = max(0, min(100, score))  # Clamp between 0-100

                feedback = feedback_match.group(1).strip() if feedback_match else "Answer evaluated."
                # Clean up feedback - take only first 1-2 sentences
                feedback = feedback.split('\n')[0].strip()

                return score, feedback
        except (ValueError, AttributeError) as e:
            print(f"Error parsing AI response: {e}")

    return None, None


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    if not data or not isinstance(data, dict):
        return jsonify({"message": "Invalid JSON payload"}), 400

    email = data.get('email')
    password = data.get('password')
    
    if not email or not isinstance(email, str) or not password or not isinstance(password, str):
        return jsonify({"message": "Valid email and password are required"}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 400
        
    try:
        new_user = User(email=email)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Database error during registration: {e}")
        return jsonify({"message": "An error occurred during registration"}), 500
    
    # Auto-login after registration
    access_token = create_access_token(identity=str(new_user.id))
    return jsonify({
        "message": "User registered successfully",
        "token": access_token, 
        "user": {"id": new_user.id, "email": new_user.email}
    })


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    if not data or not isinstance(data, dict):
        return jsonify({"message": "Invalid JSON payload"}), 400

    email = data.get('email')
    password = data.get('password')
    
    if not email or not isinstance(email, str) or not password or not isinstance(password, str):
        return jsonify({"message": "Valid email and password are required"}), 400
        
    user = User.query.filter_by(email=email).first()
    
    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid email or password"}), 401
        
    access_token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Login successful",
        "token": access_token,
        "user": {"id": user.id, "email": user.email}
    })


@app.route('/api/roles', methods=['GET'])
def get_roles():
    roles = [{"id": k, "name": v["name"]} for k, v in ROLE_INFO.items()]
    return jsonify(roles)


@app.route('/api/difficulties', methods=['GET'])
def get_difficulties():
    """Return supported difficulty levels (UI helper endpoint)."""
    return jsonify(["Easy", "Medium", "Hard"])


@app.route('/api/game/start', methods=['POST'])
@jwt_required(optional=True)
def start_game():
    data = request.json
    if not data or not isinstance(data, dict):
        return jsonify({"message": "Invalid JSON payload"}), 400

    role = data.get('role', 'software_engineer')
    if role not in ROLE_INFO:
        return jsonify({"message": "Invalid role specified"}), 400

    requested_difficulty = data.get('difficulty')
    interview_type = data.get('interviewType', 'role')
    job_description = data.get('jobDescription', '')
    
    user_id = get_jwt_identity()
    
    # Create new session
    role_info = ROLE_INFO[role]
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info['difficulty'])
    new_session = InterviewSession(
        user_id=int(user_id) if user_id else None,
        role=role,
        difficulty=difficulty,
        status='in_progress'
    )
    
    try:
        db.session.add(new_session)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Database error during game start: {e}")
        return jsonify({"message": "Failed to start game"}), 500

    # Default to 5 questions per game
    total_questions = 5

    return jsonify({
        "sessionId": new_session.id,
        "gameId": "game_" + role,
        "role": role,
        "difficulty": difficulty,
        "interviewType": "job_description" if str(interview_type).strip().lower() == "job_description" else "role",
        "jobDescriptionProvided": bool(str(job_description).strip()),
        "totalQuestions": total_questions,
        "bossHealth": 100,
        "playerHealth": 100
    })


@app.route('/api/game/question', methods=['POST'])
def get_question():
    data = request.json
    if not data or not isinstance(data, dict):
        return jsonify({"message": "Invalid JSON payload"}), 400

    role = data.get('role', 'software_engineer')
    if role not in ROLE_INFO:
        return jsonify({"message": "Invalid role specified"}), 400

    try:
        question_number = int(data.get('questionNumber', 0))
    except (TypeError, ValueError):
        return jsonify({"message": "questionNumber must be an integer"}), 400

    session_id = data.get('sessionId')
    if session_id is not None:
        try:
            session_id = int(session_id)
        except (TypeError, ValueError):
            return jsonify({"message": "sessionId must be an integer"}), 400

    requested_difficulty = data.get('difficulty')
    interview_type = data.get('interviewType', 'role')
    job_description = data.get('jobDescription', '')

    role_info = ROLE_INFO[role]
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info["difficulty"])

    # If a session exists, trust the session's difficulty (so refresh/reload stays consistent)
    if session_id:
        session = InterviewSession.query.get(session_id)
        if session and session.difficulty:
            difficulty = normalize_difficulty(session.difficulty, fallback=difficulty)

    # Try to generate a question with AI
    ai_question = generate_question_with_ai(
        role,
        question_number + 1,
        difficulty,
        interview_type=interview_type,
        job_description=job_description
    )

    if not ai_question:
        return jsonify({
            "error": True,
            "message": "Unable to generate question. Please check your API configuration and try again."
        }), 503
        
    # Save question to DB if session exists
    if session_id:
        try:
            question = Question(
                session_id=session_id,
                turn_index=question_number + 1,
                question_type="behavioral", # Default for now
                prompt_text=ai_question
            )
            db.session.add(question)
            db.session.commit()
            
            # Return question ID so answer can be linked
            return jsonify({
                "questionId": question.id,
                "questionNumber": question_number + 1,
                "question": ai_question,
                "totalQuestions": 5
            })
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Database error saving question: {e}")
            # Still return the question even if saving fails
            pass

    return jsonify({
        "questionNumber": question_number + 1,
        "question": ai_question,
        "totalQuestions": 5
    })


@app.route('/api/game/answer', methods=['POST'])
@jwt_required(optional=True)
def submit_answer():
    data = request.json
    if not data or not isinstance(data, dict):
        return jsonify({"message": "Invalid JSON payload"}), 400

    answer_text = data.get('answer', '')
    question_text = data.get('question', '')
    
    if not isinstance(answer_text, str) or not isinstance(question_text, str):
        return jsonify({"message": "Answer and question must be strings"}), 400

    try:
        boss_health = int(data.get('bossHealth', 100))
        player_health = int(data.get('playerHealth', 100))
        question_number = int(data.get('questionNumber', 0))
        total_questions = int(data.get('totalQuestions', 5))
    except (TypeError, ValueError):
        return jsonify({"message": "Health values and question numbers must be integers"}), 400

    role = data.get('role', 'software_engineer')
    if role not in ROLE_INFO:
        return jsonify({"message": "Invalid role specified"}), 400

    session_id = data.get('sessionId')
    question_id = data.get('questionId')
    
    if session_id is not None:
        try:
            session_id = int(session_id)
        except ValueError:
            return jsonify({"message": "sessionId must be an integer"}), 400
            
    if question_id is not None:
        try:
            question_id = int(question_id)
        except ValueError:
            return jsonify({"message": "questionId must be an integer"}), 400
    
    requested_difficulty = data.get('difficulty')
    user_id = get_jwt_identity()

    role_info = ROLE_INFO[role]
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info["difficulty"])

    if session_id:
        session = InterviewSession.query.get(session_id)
        if session and session.difficulty:
            difficulty = normalize_difficulty(session.difficulty, fallback=difficulty)

    # Try to grade with AI
    score, ai_feedback = grade_answer_with_ai(question_text, answer_text, role, difficulty)

    if score is None:
        # AI grading failed - return error
        return jsonify({
            "error": True,
            "message": "Unable to grade your answer. Please check your API configuration and try again."
        }), 503

    # AI grading successful - use score as damage to boss
    # Difficulty modifiers: make Easy feel forgiving, Hard feel punishing.
    if difficulty == "Easy":
        damage = int(round(score * 1.05))
        counter_threshold = 20
    elif difficulty == "Hard":
        damage = int(round(score * 0.95))
        counter_threshold = 40
    else:
        damage = score
        counter_threshold = 30

    damage = max(0, min(100, damage))
    feedback = ai_feedback

    # If score is very low, the boss counterattacks
    if score < counter_threshold:
        player_damage = counter_threshold - score  # Lower score = more player damage
        player_health -= player_damage
        feedback = f"{feedback} The boss counters for {player_damage} damage!"

    boss_health = max(0, boss_health - damage)
    player_health = max(0, player_health)
    
    # Save answer and evaluation to DB
    if question_id:
        try:
            answer_entry = Answer(
                question_id=question_id,
                user_id=int(user_id) if user_id else None,
                answer_text=answer_text
            )
            db.session.add(answer_entry)
            db.session.flush() # flush to get answer_entry.id
            
            evaluation = Evaluation(
                answer_id=answer_entry.id,
                impact_score=score,
                feedback_text=feedback
            )
            db.session.add(evaluation)
            
            # Update session status if game over
            if session_id:
                session = InterviewSession.query.get(session_id)
                if session:
                    # Check if this was the last question
                    is_last_question = question_number >= total_questions
                    
                    if boss_health <= 0:
                        session.status = 'completed_won'
                        session.ended_at = datetime.utcnow()
                    elif player_health <= 0:
                        session.status = 'completed_lost'
                        session.ended_at = datetime.utcnow()
                    elif is_last_question:
                        # Game finished all questions, determine winner by health
                        if boss_health < player_health:
                            session.status = 'completed_won'
                        else:
                            session.status = 'completed_lost'
                        session.ended_at = datetime.utcnow()
            
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Database error saving answer: {e}")
            # we can continue and still return the score

    return jsonify({
        "damage": damage,
        "bossHealth": boss_health,
        "playerHealth": player_health,
        "feedback": feedback
    })


@app.route('/api/history', methods=['GET'])
@jwt_required()
def get_history():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"message": "Unauthorized"}), 401

    sessions = (
        InterviewSession.query
        .filter(
            InterviewSession.user_id == int(user_id),
            InterviewSession.status != 'in_progress'
        )
        .order_by(InterviewSession.started_at.desc())
        .all()
    )

    history = []
    for session in sessions:
        questions = []
        ordered_questions = sorted(session.questions, key=lambda q: q.turn_index)
        for question in ordered_questions:
            answer = question.answers[0] if question.answers else None
            evaluation = answer.evaluation if answer else None

            questions.append({
                "questionId": question.id,
                "turnIndex": question.turn_index,
                "questionType": question.question_type,
                "prompt": question.prompt_text,
                "answer": answer.answer_text if answer else None,
                "answeredAt": answer.timestamp.isoformat() if answer and answer.timestamp else None,
                "score": evaluation.impact_score if evaluation else None,
                "feedback": evaluation.feedback_text if evaluation else None
            })

        history.append({
            "sessionId": session.id,
            "role": session.role,
            "difficulty": session.difficulty,
            "status": session.status,
            "startedAt": session.started_at.isoformat() if session.started_at else None,
            "endedAt": session.ended_at.isoformat() if session.ended_at else None,
            "questions": questions
        })

    return jsonify({"history": history})


if __name__ == '__main__':
    app.run(debug=True, port=5001)
