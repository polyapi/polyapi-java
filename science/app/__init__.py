from flask import Flask, got_request_exception, request
from prisma import Prisma, register
import socket
import rollbar
import rollbar.contrib.flask


def report_exception(app, exception):
    rollbar.report_exc_info(request=request)
    # HACK recommended by rollbar support because otherwise
    # multi-process uwsgi does not log
    rollbar.wait()


def create_app(testing=False):
    # create and configure the app
    db = Prisma()
    db.connect()
    register(db)

    app = Flask(__name__, instance_relative_config=True)
    app.testing = testing
    from . import views
    app.register_blueprint(views.bp)

    # TODO handle config more pro
    if app.config["DEBUG"]:
        app.config["NODE_API_URL"] = "http://localhost:8000"
    else:
        print("DEBUG OFF")
        app.config["NODE_API_URL"] = "http://localhost:8000"

        rollbar.init("d31f5efb15034e86b11fa6cf82d8cef0", socket.gethostname())
        got_request_exception.connect(report_exception, app)

    return app
