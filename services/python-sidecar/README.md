# Python sidecar placeholder

This service demonstrates the boundary for EAI-only capabilities. It contains
no clinical logic and deliberately returns HTTP 501 from the legacy-compatible
`POST /triage/perform` route.

Do not copy the entire legacy backend here. Connect or migrate one route at a
time after its request/response contract and authorization behavior are tested.
