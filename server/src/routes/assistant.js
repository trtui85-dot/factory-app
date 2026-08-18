import { Router } from "express";
import { ah } from "../async.js";
import { runAssistant } from "../assistant.js";

export const assistantRouter = Router();

assistantRouter.post(
  "/assistant/chat",
  ah(async (req, res) => {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: { code: "INVALID_BODY", message: "message is required" } });
    }
    try {
      const reply = await runAssistant({ message, history });
      res.json({ reply });
    } catch (err) {
      console.error("Assistant error:", err?.message || err);
      res.status(502).json({
        error: {
          code: "ASSISTANT_UNAVAILABLE",
          message: "L'assistant est momentanément indisponible (limite de débit API). Veuillez réessayer dans quelques secondes.",
        },
      });
    }
  })
);
