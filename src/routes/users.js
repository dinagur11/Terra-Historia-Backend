import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getOrCreateUser,
  updateDeepDiveBookmarks,
  updateUserProgress,
} from "../services/users.js";

const router = Router();

router.use(requireAuth);

router.get("/me", async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);
    res.json(user.toResponse());
  } catch (err) {
    console.error("User profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me/bookmarks", async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);
    res.json({ deepDiveBookmarks: user.deepDiveBookmarks });
  } catch (err) {
    console.error("User bookmarks error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me/bookmarks", async (req, res) => {
  const { deepDiveBookmarks } = req.body;

  if (!Array.isArray(deepDiveBookmarks)) {
    return res.status(400).json({ error: "deepDiveBookmarks must be an array" });
  }

  try {
    await getOrCreateUser(req.user);
    const user = await updateDeepDiveBookmarks(req.user.userId, deepDiveBookmarks);
    res.json({ deepDiveBookmarks: user.deepDiveBookmarks });
  } catch (err) {
    console.error("Update bookmarks error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me/progress", async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);
    res.json({
      deepDiveProgress: user.deepDiveProgress,
      timelineProgress: user.timelineProgress,
    });
  } catch (err) {
    console.error("User progress error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me/progress", async (req, res) => {
  const { deepDiveProgress = {}, timelineProgress = {} } = req.body;

  try {
    await getOrCreateUser(req.user);
    const user = await updateUserProgress(req.user.userId, {
      deepDiveProgress,
      timelineProgress,
    });

    res.json({
      deepDiveProgress: user.deepDiveProgress,
      timelineProgress: user.timelineProgress,
    });
  } catch (err) {
    console.error("Update progress error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
