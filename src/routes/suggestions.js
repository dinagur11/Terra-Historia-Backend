import { randomUUID } from "node:crypto";
import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import {
  addUserSuggestion,
  getAllSuggestions,
  getOrCreateUser,
  updateSuggestionStatus, 
} from "../services/users.js";

const router = Router();
const ALLOWED_TYPES = new Set(["event", "mistake", "other"]);
const ALLOWED_STATUSES = new Set(["pending", "accepted", "declined"]);

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const isDeveloper = req.user.groups.includes("developers");

    if (isDeveloper) {
      return res.json({
        isDeveloper: true,
        suggestions: await getAllSuggestions(),
      });
    }

    const user = await getOrCreateUser(req.user);
    res.json({
      isDeveloper: false,
      suggestions: [...user.suggestions].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ),
    });
  } catch (err) {
    console.error("Get suggestions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:userId/:suggestionId/status", async (req, res) => {
  try {
    const isDeveloper = req.user.groups.includes("developers");
    if (!isDeveloper) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { userId, suggestionId } = req.params;
    const { status } = req.body;

    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await updateSuggestionStatus(userId, suggestionId, status);
    res.json({ success: true, status });
  } catch (err) {
    console.error("Update suggestion status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const { type, title = "", date = "", message = "", link = "" } = req.body;

  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: "Invalid suggestion type" });
  }
  if (
    typeof title !== "string" ||
    typeof date !== "string" ||
    typeof message !== "string" ||
    typeof link !== "string"
  ) {
    return res.status(400).json({ error: "Suggestion fields must be strings" });
  }
  if (!message.trim()) {
    return res.status(400).json({ error: "Suggestion message is required" });
  }

  const suggestion = {
    suggestionId: randomUUID(),
    type,
    title: title.trim().slice(0, 160),
    date: date.trim().slice(0, 80),
    message: message.trim().slice(0, 5000),
    link: link.trim().slice(0, 1000),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  try {
    await getOrCreateUser(req.user);
    await addUserSuggestion(req.user.userId, suggestion);
    res.status(201).json(suggestion);
  } catch (err) {
    console.error("Create suggestion error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
