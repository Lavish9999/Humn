# Sightengine model entitlements

Humn treats Sightengine's `genai` and `deepfake` models as the required primary content-detector call. The `recapture` model is invoked separately only when `SIGHTENGINE_RECAPTURE_ENABLED=true`.

This separation is intentional: Sightengine may return HTTP 400 when an account does not have access to the paid Recapture Detection API. That auxiliary entitlement must not erase otherwise valid AI-generation and deepfake scores.

Until recapture access is provisioned, leave `SIGHTENGINE_RECAPTURE_ENABLED=false`. Humn will continue using its explicitly partial local screen/rephotograph heuristics and must escalate suspected recaptures rather than auto-clearing them.

Safety models are also called separately through `SIGHTENGINE_SAFETY_MODELS`, so a safety-model error cannot silently convert a required AI-detector result into a pass.
