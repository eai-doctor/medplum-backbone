import os

from flask import Flask, jsonify, request


app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify(ok=True, service="eai-python-sidecar-placeholder")


@app.post("/triage/perform")
def triage():
    # This intentionally does not make a clinical decision. Replace this route
    # with the existing, tested EAI implementation after contract verification.
    return (
        jsonify(
            error="NOT_CONNECTED",
            message="The development sidecar is not connected to the EAI triage engine.",
            request_id=request.headers.get("X-Request-ID"),
        ),
        501,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5101")))
