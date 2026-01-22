from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Placeholder questions for different job roles
QUESTIONS = {
    "software_engineer": [
        "Tell me about a time you debugged a complex issue.",
        "Describe your experience with data structures and algorithms.",
        "How do you handle code reviews and feedback?"
    ],
    "product_manager": [
        "Tell me about a time you had to prioritize features.",
        "Describe your experience working with engineering teams.",
        "How do you gather and incorporate user feedback?"
    ],
    "data_scientist": [
        "Tell me about a time you worked with a large dataset.",
        "Describe your experience with machine learning models.",
        "How do you communicate technical findings to non-technical stakeholders?"
    ]
}

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

    questions = QUESTIONS.get(role, QUESTIONS['software_engineer'])

    return jsonify({
        "gameId": "game_" + role,
        "role": role,
        "totalQuestions": len(questions),
        "bossHealth": 100,
        "playerHealth": 100
    })

@app.route('/api/game/question', methods=['POST'])
def get_question():
    data = request.json
    role = data.get('role', 'software_engineer')
    question_number = data.get('questionNumber', 0)

    questions = QUESTIONS.get(role, QUESTIONS['software_engineer'])

    if question_number < len(questions):
        return jsonify({
            "questionNumber": question_number + 1,
            "question": questions[question_number],
            "totalQuestions": len(questions)
        })
    else:
        return jsonify({"error": "No more questions"}), 400

@app.route('/api/game/answer', methods=['POST'])
def submit_answer():
    data = request.json
    answer = data.get('answer', '')
    boss_health = data.get('bossHealth', 100)
    player_health = data.get('playerHealth', 100)

    # Placeholder scoring logic
    # In the future, this will use LLM for evaluation
    answer_length = len(answer.split())

    if answer_length > 50:
        damage = 35
        feedback = "Excellent answer! Critical hit!"
    elif answer_length > 30:
        damage = 25
        feedback = "Good answer! Solid damage."
    elif answer_length > 15:
        damage = 15
        feedback = "Decent answer, but could be stronger."
    else:
        damage = 5
        feedback = "Weak answer. The boss counters!"
        player_health -= 20

    boss_health -= damage

    return jsonify({
        "damage": damage,
        "bossHealth": max(0, boss_health),
        "playerHealth": max(0, player_health),
        "feedback": feedback
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
