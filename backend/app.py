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
QUESTION_TYPES = {"behavioral", "technical"}


PASSWORD_MIN_LENGTH = 8

def normalize_email(email: str) -> str:
    return str(email).strip().lower()

def is_valid_email(email: str) -> bool:
    email_regex = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    return bool(re.match(email_regex, email))

def validate_password(password: str):
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters long."
    if not re.search(r"[a-z]", password):
        return "Password must include at least one lowercase letter."
    if not re.search(r"[A-Z]", password):
        return "Password must include at least one uppercase letter."
    if not re.search(r"\d", password):
        return "Password must include at least one number."
    return None


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


def calculate_combat_results(score, difficulty, boss_health, player_health):
    # Format: { Difficulty: (damage_multiplier, counter_threshold) }
    balance_config = {
        "Easy": (2.0, 5),
        "Medium": (1.8, 6),
        "Hard": (1.5, 8),
    }

    multiplier, counter_threshold = balance_config.get(difficulty, (1.2, 6))

    damage = int(round(score * multiplier))
    damage = max(0, min(100, damage))

    player_damage = 0
    combat_feedback = "Critical hit!" if score >= 9 else "Solid strike."
    if score < counter_threshold:
        player_damage = (counter_threshold - score) * 3
        combat_feedback = f"The answer was weak. The boss counters for {player_damage} damage!"

    updated_boss_health = max(0, boss_health - damage)
    updated_player_health = max(0, player_health - player_damage)

    return {
        "boss_damage": damage,
        "player_damage": player_damage,
        "new_boss_hp": updated_boss_health,
        "new_player_hp": updated_player_health,
        "feedback": combat_feedback,
    }

def make_llm_request(messages, max_retries=3, backoff_factor=1.5, max_tokens=4096, temperature=0.7):

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
            "temperature": float(temperature),
            "max_tokens": int(max_tokens),
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


def normalize_question_type(question_type, fallback: str = "behavioral") -> str:
    if not question_type:
        return fallback
    q = str(question_type).strip().lower()
    if q in QUESTION_TYPES:
        return q
    return fallback


def normalize_question_text(text: str) -> str:
    if not text:
        return ""
    normalized = re.sub(r"[^a-z0-9\s]", " ", str(text).lower())
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def generate_question_with_ai(role, question_number, difficulty, question_type="behavioral", excluded_questions=None):
    """Generate an interview question using the Amplify AI."""
    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    normalized_question_type = normalize_question_type(question_type, fallback="behavioral")
    excluded_questions = excluded_questions or []

    question_type_instruction = (
        "Generate a technical interview question for a candidate. Focus on core concepts, first principles, and technical reasoning relevant to the role."
        if normalized_question_type == "technical"
        else "Generate a behavioral interview question for a candidate."
    )

    style_instruction = (
        "For technical questions, ask concept-first questions about architecture, debugging, tradeoffs, implementation details, or data analysis decisions. Prefer explanations of why and how over past personal experiences."
        if normalized_question_type == "technical"
        else "For behavioral questions, ask about past experiences and decision-making using specific examples."
    )

    difficulty_instruction = (
        """
- For "Easy" difficulty: Ask foundational concept checks and basic technical reasoning
- For "Medium" difficulty: Ask applied concept questions with tradeoffs or debugging choices
- For "Hard" difficulty: Ask deeper system-level or scenario-driven concept questions requiring rigorous reasoning
""".strip()
        if normalized_question_type == "technical"
        else """
- For "Easy" difficulty: Ask straightforward questions about basic experiences
- For "Medium" difficulty: Ask about specific challenges and how they were handled
- For "Hard" difficulty: Ask complex scenario-based questions requiring deep thinking
""".strip()
    )

    excluded_block = ""
    if excluded_questions:
        excluded_list = "\n".join([f"- {q}" for q in excluded_questions[:8]])
        excluded_block = f"""
Do NOT repeat or closely paraphrase any of these previously asked questions:
{excluded_list}
"""

    prompt = f"""You are an expert interviewer for {role_info['description']}.

{question_type_instruction} This is question {question_number} of the interview.

Role: {role_info['name']}
Difficulty: {difficulty}
Question Type: {normalized_question_type}

Requirements:
- {style_instruction}
- The question should be appropriate for the {difficulty} difficulty level
{difficulty_instruction}
{excluded_block}

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


def grade_answer_with_ai(question, answer, role, difficulty, mode="classic"):
    """Grade a candidate's answer using the Amplify AI."""
    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    normalized_mode = "practice" if str(mode).strip().lower() == "practice" else "classic"

    if normalized_mode == "practice":
        prompt = f"""You are an expert interview coach evaluating a candidate's response for {role_info['description']}.

Interview Question: {question}

Candidate's Answer: {answer}

Role: {role_info['name']}
Difficulty Level: {difficulty}
Mode: Practice

Please evaluate this answer and provide a score from 0 to 10 based on:
- Relevance to the question
- Depth and specificity of the response
- Use of concrete examples
- Communication clarity and structure

For {difficulty} difficulty:
- Easy: Be more lenient in scoring
- Medium: Use standard evaluation criteria
- Hard: Be more rigorous in evaluation

IMPORTANT:
- Give constructive coaching feedback in 1-2 sentences
- Do NOT mention damage, health, boss battles, counters, wins, losses, or any game mechanics
- Focus only on interview quality and how to improve the answer

You must respond in this EXACT format:
SCORE: [number]
FEEDBACK: [your feedback in 1-2 sentences]

Example response:
SCORE: 7
FEEDBACK: Good use of a relevant example and clear structure. To strengthen this response, add a more measurable result and clarify your personal impact."""
    else:
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
            score_match = re.search(r'SCORE:\s*(\d+)', response, re.IGNORECASE)
            feedback_match = re.search(r'FEEDBACK:\s*(.+)', response, re.IGNORECASE | re.DOTALL)

            if score_match:
                score = int(score_match.group(1))
                score = max(0, min(10, score))

                feedback = feedback_match.group(1).strip() if feedback_match else "Answer evaluated."
                feedback = feedback.split('\n')[0].strip()

                return score, feedback
        except (ValueError, AttributeError) as e:
            print(f"Error parsing AI response: {e}")

    return None, None


def generate_interview_nudge_with_ai(
    role,
    difficulty,
    question_text,
    interview_type,
    nudge_temperature_0_100,
    seconds_elapsed,
):
    """
    Short recruiter-style line to simulate time pressure during practice.
    nudge_temperature_0_100: 0 = warm/supportive, 100 = cold/hostile (professional).
    """
    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    try:
        temp_slider = int(nudge_temperature_0_100)
    except (TypeError, ValueError):
        temp_slider = 50
    temp_slider = max(0, min(100, temp_slider))

    try:
        elapsed = int(seconds_elapsed)
    except (TypeError, ValueError):
        elapsed = 0
    elapsed = max(0, elapsed)

    itype = str(interview_type or "role").strip().lower()
    type_label = (
        "Job description-based interview (questions tailored to a pasted posting)"
        if itype == "job_description"
        else "Role-based interview (questions for the selected position)"
    )

    # Calmer when supportive, more variable when harsh (clearer contrast at the extremes)
    llm_temp = 0.38 + (temp_slider / 100.0) * 0.58

    if temp_slider <= 30:
        intensity_block = f"""INTENSITY (slider {temp_slider}, LOW): MAXIMUM_WARMTH.
The line must be unmistakably gentle and uplifting. Sound like a mentor who truly believes in the candidate: patient, reassuring, generous with time, celebrate that thinking takes effort, invite them to breathe and organize thoughts. Weave in a light, kind nod to the question theme without quoting it back at length. Zero pressure, zero impatience, zero disappointment. This should feel like a hug in words."""
    elif temp_slider >= 70:
        intensity_block = f"""INTENSITY (slider {temp_slider}, HIGH): MAXIMUM_PRESSURE.
The line must be unmistakably tense and impatient while staying in bounds of a real professional interview. Short, clipped, time aware. Make clear you need them to answer now, that silence has gone on too long, that the schedule is tight, that you expect preparedness. You may be cold, skeptical, or brusque. No insults, slurs, threats, discrimination, or personal attacks. Do not soften the urgency."""
    else:
        intensity_block = f"""INTENSITY (slider {temp_slider}, MID): Blend clearly between warmth and pressure.
Lean supportive below 50, lean demanding above 50. The contrast from low vs high slider settings must be obvious if someone heard lines from each side."""

    prompt = f"""You are writing one brief spoken line for "HR-PG" (Human Resources - Professional Gauntlet), a web app that turns job interview practice into a retro turn-based game. Candidates type STAR style answers while a simple game metaphor scores their responses. Your line is NOT scoring feedback. It is only a spoken nudge while they are still thinking and typing.

Context for this session:
- Interview mode: {type_label}
- Target role: {role_info["name"]} ({role_info["description"]})
- Difficulty setting: {difficulty}
- Seconds elapsed on the stopwatch since this question appeared: {elapsed}

{intensity_block}

The interview question they are answering (for reference; do not repeat it verbatim unless a very short echo feels natural):
\"\"\"{question_text}\"\"\"

Requirements:
- Exactly ONE or TWO short sentences, as the interviewer or recruiter speaking aloud.
- Obey the INTENSITY block above as the top priority. Make low slider and high slider sound like different people.
- Realistic interview language only. No game metaphors (no boss, health, damage, bars, etc.).
- Do not mention AI, models, sliders, or the stopwatch.
- FORMATTING: Do not use hyphens anywhere in your reply. That means no ASCII minus hyphen, no en dash, no em dash. Use spaces, commas, or periods instead.

Respond with ONLY the line(s), no quotation marks around them and no preamble."""

    messages = [{"role": "user", "content": prompt}]
    response = make_llm_request(messages, max_tokens=220, temperature=llm_temp)

    if not response:
        return None

    line = response.strip()
    if line.startswith('"') and line.endswith('"') and len(line) > 2:
        line = line[1:-1].strip()

    # Enforce no hyphen like characters in output
    line = line.replace("\u2013", " ").replace("\u2014", " ").replace("\u2212", " ")
    line = re.sub(r"-+", " ", line)
    line = re.sub(r"\s+", " ", line).strip()

    # Keep nudges short if the model runs long
    if len(line) > 400:
        line = line[:397].rstrip() + "..."
    return line or None


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

    email = normalize_email(email)

    if User.query.filter_by(email=email).first():
        return jsonify({"message": "An account with this email already exists."}), 400

    if not is_valid_email(email):
        return jsonify({"message": "Please enter a valid email address."}), 400

    password_error = validate_password(password)
    if password_error:
        return jsonify({"message": password_error}), 400

    try:
        new_user = User(email=email)
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Database error during registration: {e}")
        return jsonify({"message": "An error occurred during registration"}), 500

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
    mode = data.get('mode', 'classic')
    
    user_id = get_jwt_identity()
    
    # Create new session
    role_info = ROLE_INFO[role]
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info['difficulty'])
    new_session = InterviewSession(
        user_id=int(user_id) if user_id else None,
        role=role,
        difficulty=difficulty,
        mode=mode,
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
    requested_question_type = data.get('questionType')

    role_info = ROLE_INFO[role]
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info["difficulty"])
    question_type = normalize_question_type(requested_question_type, fallback="behavioral")

    # If a session exists, trust the session's difficulty (so refresh/reload stays consistent)
    existing_questions = []
    existing_question_norms = set()
    if session_id:
        session = db.session.get(InterviewSession, session_id)
        if session and session.difficulty:
            difficulty = normalize_difficulty(session.difficulty, fallback=difficulty)

        existing_questions = (
            Question.query
            .filter_by(session_id=session_id)
            .order_by(Question.turn_index.asc())
            .all()
        )
        existing_question_norms = {
            normalize_question_text(q.prompt_text)
            for q in existing_questions
            if q and q.prompt_text
        }

    # Try to generate a question with AI and avoid repeats within this session.
    ai_question = None
    max_attempts = 5
    excluded_questions = [q.prompt_text for q in existing_questions if q.prompt_text]

    for _ in range(max_attempts):
        candidate_question = generate_question_with_ai(
            role,
            question_number + 1,
            difficulty,
            question_type=question_type,
            excluded_questions=excluded_questions,
        )
        if not candidate_question:
            continue

        normalized_candidate = normalize_question_text(candidate_question)
        if normalized_candidate and normalized_candidate not in existing_question_norms:
            ai_question = candidate_question
            break

        excluded_questions.append(candidate_question)

    if not ai_question:
        return jsonify({
            "error": True,
            "message": "Unable to generate a unique question. Please try again."
        }), 503
        
    # Save question to DB if session exists
    if session_id:
        try:
            question = Question(
                session_id=session_id,
                turn_index=question_number + 1,
                question_type=question_type,
                prompt_text=ai_question
            )
            db.session.add(question)
            db.session.commit()
            
            # Return question ID so answer can be linked
            return jsonify({
                "questionId": question.id,
                "questionNumber": question_number + 1,
                "question": ai_question,
                "questionType": question_type,
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
        "questionType": question_type,
        "totalQuestions": 5
    })


@app.route('/api/game/nudge', methods=['POST'])
def game_nudge():
    """LLM-generated time-pressure line for the optional interview stopwatch."""
    data = request.json
    if not data or not isinstance(data, dict):
        return jsonify({"message": "Invalid JSON payload"}), 400

    role = data.get('role', 'software_engineer')
    if role not in ROLE_INFO:
        return jsonify({"message": "Invalid role specified"}), 400

    question_text = data.get('question', '')
    if not isinstance(question_text, str) or not question_text.strip():
        return jsonify({"message": "question is required"}), 400

    interview_type = data.get('interviewType', 'role')
    if not isinstance(interview_type, str):
        return jsonify({"message": "interviewType must be a string"}), 400

    requested_difficulty = data.get('difficulty')
    role_info = ROLE_INFO[role]
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info["difficulty"])

    nudge_temperature = data.get('nudgeTemperature', 50)
    seconds_elapsed = data.get('secondsElapsed', 0)

    nudge = generate_interview_nudge_with_ai(
        role,
        difficulty,
        question_text.strip(),
        interview_type,
        nudge_temperature,
        seconds_elapsed,
    )

    if not nudge:
        return jsonify({
            "error": True,
            "message": "Unable to generate a nudge. Please check your API configuration and try again.",
        }), 503

    return jsonify({"nudge": nudge})


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
    question_number = data.get('questionNumber', 0)
    total_questions = data.get('totalQuestions', 5)
    mode = data.get('mode', 'classic')
    is_practice_mode = str(mode).strip().lower() == 'practice'
    
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
        session = db.session.get(InterviewSession, session_id)
        if session and session.difficulty:
            difficulty = normalize_difficulty(session.difficulty, fallback=difficulty)

    # Try to grade with AI
    score, ai_feedback = grade_answer_with_ai(question_text, answer_text, role, difficulty, mode=mode)

    if score is None:
        # AI grading failed - return error
        return jsonify({
            "error": True,
            "message": "Unable to grade your answer. Please check your API configuration and try again."
        }), 503

    feedback = ai_feedback

    if is_practice_mode:
        damage = 0
        updated_boss_health = boss_health
        updated_player_health = player_health
    else:
        combat = calculate_combat_results(score, difficulty, boss_health, player_health)
        damage = combat["boss_damage"]
        updated_boss_health = combat["new_boss_hp"]
        updated_player_health = combat["new_player_hp"]
        feedback = f"{feedback} {combat['feedback']}"
    
    # Security/consistency: Ensure provided question_id actually belongs to the provided session_id
    if question_id and session_id:
        q = db.session.get(Question, question_id)
        if q and q.session_id != session_id:
            # Mismatch due to client race condition; force recovery
            question_id = None

    # Fallback: recover question_id if missing or mismatched
    if not question_id and session_id and question_number:
        existing_question = (
            Question.query
            .filter_by(session_id=session_id, turn_index=question_number)
            .order_by(Question.id.desc())
            .first()
        )
        if existing_question:
            question_id = existing_question.id


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
                session = db.session.get(InterviewSession, session_id)
                if session:
                    # Check if this was the last question
                    is_last_question = question_number >= total_questions
                    
                    if is_practice_mode:
                      if is_last_question:
                          session.status = 'completed_won'
                          session.ended_at = datetime.utcnow()
                    else:
                      if updated_boss_health <= 0:
                          session.status = 'completed_won'
                          session.ended_at = datetime.utcnow()
                      elif updated_player_health <= 0:
                          session.status = 'completed_lost'
                          session.ended_at = datetime.utcnow()
                      elif is_last_question:
                        if updated_boss_health < updated_player_health:
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
        "bossHealth": updated_boss_health,
        "playerHealth": updated_player_health,
        "feedback": feedback
    })

@app.route('/api/game/results/<int:session_id>', methods=['GET'])
@jwt_required(optional=True)
def get_game_results(session_id):
    session = db.session.get(InterviewSession, session_id)

    if not session:
        return jsonify({"message": "Session not found"}), 404

    questions = (
        Question.query
        .filter_by(session_id=session_id)
        .order_by(Question.turn_index.asc())
        .all()
    )

    items = []

    for question in questions:
        answer = (
            Answer.query
            .filter_by(question_id=question.id)
            .order_by(Answer.id.desc())
            .first()
        )

        evaluation = None
        if answer:
            evaluation = (
                Evaluation.query
                .filter_by(answer_id=answer.id)
                .order_by(Evaluation.id.desc())
                .first()
            )

        items.append({
            "questionNumber": question.turn_index,
            "question": question.prompt_text,
            "answer": answer.answer_text if answer else "",
            "feedback": evaluation.feedback_text if evaluation else "",
            "score": evaluation.impact_score if evaluation else None
        })

    return jsonify({
        "sessionId": session.id,
        "role": session.role,
        "difficulty": session.difficulty,
        "status": session.status,
        "questions": items
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
            "mode": session.mode,
            "status": session.status,
            "startedAt": session.started_at.isoformat() if session.started_at else None,
            "endedAt": session.ended_at.isoformat() if session.ended_at else None,
            "questions": questions
        })

    return jsonify({"history": history})


if __name__ == '__main__':
    app.run(debug=True, port=5001)
