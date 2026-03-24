from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import json
import os
import re
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

def make_llm_request(messages):

    # Validate input
    if not messages:
        print("Error: Messages list cannot be empty")
        return None

    if not isinstance(messages, list):
        print("Error: Messages must be a list")
        return None

    if not AMPLIFY_API_KEY:
        print("Error: AMPLIFY_API_KEY not found in environment variables")
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
                    print("Warning: Empty response received from API")
                    return None
            except json.JSONDecodeError as e:
                print(f"Error: Failed to parse JSON response: {e}")
                return None

        else:
            print(f"Error: Request failed with status code {response.status_code}")
            return None

    except requests.exceptions.Timeout:
        print("Error: Request timed out")
        return None
    except requests.exceptions.ConnectionError:
        print("Error: Connection failed")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error: Request failed - {e}")
        return None
    except Exception as e:
        print(f"Error: Unexpected error occurred - {e}")
        return None


def generate_question_with_ai(role, question_number, difficulty):
    """Generate an interview question using the Amplify AI."""
    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])

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


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 400
        
    new_user = User(email=email)
    new_user.set_password(password)
    
    db.session.add(new_user)
    db.session.commit()
    
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
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400
        
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
    role = data.get('role', 'software_engineer')
    requested_difficulty = data.get('difficulty')
    
    user_id = get_jwt_identity()
    
    # Create new session
    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info['difficulty'])
    new_session = InterviewSession(
        user_id=int(user_id) if user_id else None,
        role=role,
        difficulty=difficulty,
        status='in_progress'
    )
    
    db.session.add(new_session)
    db.session.commit()

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
    role = data.get('role', 'software_engineer')
    question_number = data.get('questionNumber', 0)
    session_id = data.get('sessionId')
    requested_difficulty = data.get('difficulty')

    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info["difficulty"])

    # If a session exists, trust the session's difficulty (so refresh/reload stays consistent)
    if session_id:
        session = InterviewSession.query.get(session_id)
        if session and session.difficulty:
            difficulty = normalize_difficulty(session.difficulty, fallback=difficulty)

    # Try to generate a question with AI
    ai_question = generate_question_with_ai(role, question_number + 1, difficulty)

    if not ai_question:
        return jsonify({
            "error": True,
            "message": "Unable to generate question. Please check your API configuration and try again."
        }), 503
        
    # Save question to DB if session exists
    if session_id:
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

    return jsonify({
        "questionNumber": question_number + 1,
        "question": ai_question,
        "totalQuestions": 5
    })


@app.route('/api/game/answer', methods=['POST'])
@jwt_required(optional=True)
def submit_answer():
    data = request.json
    answer_text = data.get('answer', '')
    question_text = data.get('question', '')
    boss_health = data.get('bossHealth', 100)
    player_health = data.get('playerHealth', 100)
    role = data.get('role', 'software_engineer')
    session_id = data.get('sessionId')
    requested_difficulty = data.get('difficulty')
    question_id = data.get('questionId')
    question_number = data.get('questionNumber', 0)
    total_questions = data.get('totalQuestions', 5)
    mode = data.get('mode', 'classic')
    is_practice_mode = str(mode).strip().lower() == 'practice'
    
    user_id = get_jwt_identity()

    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    difficulty = normalize_difficulty(requested_difficulty, fallback=role_info["difficulty"])

    if session_id:
        session = InterviewSession.query.get(session_id)
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
        updated_boss_health = max(0, boss_health - damage)
        updated_player_health = max(0, player_health)

        # If score is very low, the boss counterattacks
        if score < counter_threshold:
            player_damage = counter_threshold - score
            updated_player_health = max(0, player_health - player_damage)
            feedback = f"{feedback} The boss counters for {player_damage} damage!"
    

    # Save answer and evaluation to DB
    if question_id:
        answer_entry = Answer(
            question_id=question_id,
            user_id=int(user_id) if user_id else None,
            answer_text=answer_text
        )
        db.session.add(answer_entry)
        db.session.commit()

        evaluation = Evaluation(
            answer_id=answer_entry.id,
            impact_score=score,
            feedback_text=feedback
        )
        db.session.add(evaluation)

        if session_id:
            session = InterviewSession.query.get(session_id)
            if session:
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

    return jsonify({
        "damage": damage,
        "bossHealth": updated_boss_health,
        "playerHealth": updated_player_health,
        "feedback": feedback
    })

@app.route('/api/game/results/<int:session_id>', methods=['GET'])
@jwt_required(optional=True)
def get_game_results(session_id):
    session = InterviewSession.query.get(session_id)

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
            "status": session.status,
            "startedAt": session.started_at.isoformat() if session.started_at else None,
            "endedAt": session.ended_at.isoformat() if session.ended_at else None,
            "questions": questions
        })

    return jsonify({"history": history})


if __name__ == '__main__':
    app.run(debug=True, port=5001)
