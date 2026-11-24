from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from app.config.database import db
from app.config.settings import Config
from app.middleware.error_handler import register_error_handlers


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)
    if app.config.get("TESTING") and not app.config.get("SECRET_KEY"):
        app.config["SECRET_KEY"] = "test-secret-key"
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("Falta SECRET_KEY en backend/.env")

    app.json.ensure_ascii = False
    app.url_map.strict_slashes = False
    db.init_app(app)
    register_error_handlers(app)
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
    from app.routes.brigadas_routes import brigadas_bp
    from app.routes.estaciones_routes import estaciones_bp
    from app.routes.recursos_routes import recursos_bp
    from app.routes.usuarios_routes import usuarios_bp
    from app.routes.zona_riesgo_routes import zona_riesgo_bp
    from app.routes.solicitudes_zona_routes import solicitudes_zona_bp
    from app.routes.inspecciones_routes import inspecciones_bp
    from app.routes.avisos_routes import avisos_bp
    from app.routes.health_routes import health_bp
    from app.routes.incidentes_routes import incidentes_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(usuarios_bp, url_prefix="/api/usuarios")
    app.register_blueprint(estaciones_bp, url_prefix="/api/estaciones")
    app.register_blueprint(recursos_bp, url_prefix="/api/recursos")
    app.register_blueprint(brigadas_bp, url_prefix="/api/brigadas")
    app.register_blueprint(zona_riesgo_bp, url_prefix="/api/zonas-riesgo")
    app.register_blueprint(solicitudes_zona_bp, url_prefix="/api/solicitudes-zonas")
    app.register_blueprint(inspecciones_bp, url_prefix="/api/inspecciones")
    app.register_blueprint(health_bp)
    app.register_blueprint(avisos_bp)
    app.register_blueprint(incidentes_bp)

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
