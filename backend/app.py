from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import requests
import json
import os
import re

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Amplify API Configuration
AMPLIFY_API_KEY = os.getenv("AMPLIFY_API_KEY")

# Role display names and difficulty descriptions
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


@app.route('/api/roles', methods=['GET'])
def get_roles():
    roles = [
        {"id": "software_engineer", "name": "Software Engineer", "difficulty": "Medium"},
        {"id": "product_manager", "name": "Product Manager", "difficulty": "Hard"},
        {"id": "data_scientist", "name": "Data Scientist", "difficulty": "Medium"}
    ]
    return jsonify(roles)


@app.route('/api/game/start', methods=['POST'])
def start_game():
    data = request.json
    role = data.get('role', 'software_engineer')

    # Default to 5 questions per game
    total_questions = 5

    return jsonify({
        "gameId": "game_" + role,
        "role": role,
        "totalQuestions": total_questions,
        "bossHealth": 100,
        "playerHealth": 100
    })


@app.route('/api/game/question', methods=['POST'])
def get_question():
    data = request.json
    role = data.get('role', 'software_engineer')
    question_number = data.get('questionNumber', 0)

    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    difficulty = role_info["difficulty"]

    # Try to generate a question with AI
    ai_question = generate_question_with_ai(role, question_number + 1, difficulty)

    if not ai_question:
        return jsonify({
            "error": True,
            "message": "Unable to generate question. Please check your API configuration and try again."
        }), 503

    return jsonify({
        "questionNumber": question_number + 1,
        "question": ai_question,
        "totalQuestions": 5
    })


@app.route('/api/game/answer', methods=['POST'])
def submit_answer():
    data = request.json
    answer = data.get('answer', '')
    question = data.get('question', '')
    boss_health = data.get('bossHealth', 100)
    player_health = data.get('playerHealth', 100)
    role = data.get('role', 'software_engineer')

    role_info = ROLE_INFO.get(role, ROLE_INFO["software_engineer"])
    difficulty = role_info["difficulty"]

    # Try to grade with AI
    score, ai_feedback = grade_answer_with_ai(question, answer, role, difficulty)

    if score is None:
        # AI grading failed - return error
        return jsonify({
            "error": True,
            "message": "Unable to grade your answer. Please check your API configuration and try again."
        }), 503

    # AI grading successful - use score as damage to boss
    damage = score
    feedback = ai_feedback

    # If score is very low, the boss counterattacks
    if score < 30:
        player_damage = 30 - score  # Lower score = more player damage
        player_health -= player_damage
        feedback = f"{feedback} The boss counters for {player_damage} damage!"

    boss_health -= damage

    return jsonify({
        "damage": damage,
        "bossHealth": max(0, boss_health),
        "playerHealth": max(0, player_health),
        "feedback": feedback
    })


if __name__ == '__main__':
    app.run(debug=True, port=5001)
