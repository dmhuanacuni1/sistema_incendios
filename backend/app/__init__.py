from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from app.config.database import db
from app.config.settings import Config


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("Falta SECRET_KEY en backend/.env")

    app.json.ensure_ascii = False
    app.url_map.strict_slashes = False
    db.init_app(app)
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ]
            }
        },
    )

    from app.routes.auth_routes import auth_bp
    from app.routes.usuarios_routes import usuarios_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(usuarios_bp, url_prefix="/api/usuarios")

    @app.get("/api/salud")
    def salud():
        return jsonify({"estado": "ok", "modulo": "usuarios"})

    @app.errorhandler(HTTPException)
    def error_http(exc):
        return jsonify({"error": exc.description}), exc.code

    @app.errorhandler(Exception)
    def error_interno(exc):
        if isinstance(exc, HTTPException):
            return jsonify({"error": exc.description}), exc.code
        app.logger.exception("Error no controlado")
        return jsonify({"error": "Error interno del servidor"}), 500

    return app
