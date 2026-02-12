from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db
import json

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sessions = db.relationship('InterviewSession', backref='user', lazy=True)
    answers = db.relationship('Answer', backref='user', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class InterviewSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    role = db.Column(db.String(50), nullable=False)
    difficulty = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='in_progress')  # in_progress, completed, abandoned
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)

    questions = db.relationship('Question', backref='session', lazy=True)

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('interview_session.id'), nullable=False)
    turn_index = db.Column(db.Integer, nullable=False)
    question_type = db.Column(db.String(50), nullable=True) # behavioral, technical, etc.
    prompt_text = db.Column(db.Text, nullable=False)
    
    answers = db.relationship('Answer', backref='question', lazy=True)

class Answer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('question.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    answer_text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    evaluation = db.relationship('Evaluation', backref='answer', uselist=False, lazy=True)

class Evaluation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('answer.id'), nullable=False)
    impact_score = db.Column(db.Integer, nullable=False)
    feedback_text = db.Column(db.Text, nullable=False)
    rubric_scores_json = db.Column(db.Text, nullable=True)

    def get_rubric_scores(self):
        if self.rubric_scores_json:
            return json.loads(self.rubric_scores_json)
        return {}
    
    def set_rubric_scores(self, scores):
        self.rubric_scores_json = json.dumps(scores)
