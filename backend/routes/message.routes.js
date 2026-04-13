const express = require("express");
const router = express.Router();
const messageService = require("../services/message.service");
const { verifyToken } = require("../utils/jwt.util");

// ─── Auth middleware ───────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
};

// ─── GET /api/messages/global ─────────────────────────────────────────────────
// Load paginated global messages (newest page, reversed for display)
router.get("/global", authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // cap at 100
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const [messages, totalCount] = await Promise.all([
      messageService.getGlobalMessages(limit, offset),
      messageService.getGlobalMessageCount(),
    ]);

    res.json({
      messages,
      totalCount,
      offset,
      hasMore: offset + limit < totalCount,
    });
  } catch (error) {
    console.error("❌ GET /global error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ─── PATCH /api/messages/global/:id ──────────────────────────────────────────
// Edit own message (within 15-minute window).
// After success the client emits `broadcast-message-edit` via socket so all
// other connected clients receive the update in real-time.
router.patch("/global/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    if (content.trim().length > 500) {
      return res
        .status(400)
        .json({ error: "Message too long (max 500 characters)" });
    }

    const updated = await messageService.editGlobalMessage(
      id,
      req.userId,
      content.trim(),
    );

    res.json({ message: updated });
  } catch (error) {
    console.error("❌ PATCH /global/:id error:", error);

    if (error.message === "Message not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Unauthorized") {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Message already deleted") {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === "Edit window has expired (15 minutes)") {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to edit message" });
  }
});

// ─── DELETE /api/messages/global/:id ─────────────────────────────────────────
// Delete own message (any time).
// After success the client emits `broadcast-message-delete` via socket so all
// other connected clients remove it from their UI in real-time.
router.delete("/global/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedMessage = await messageService.deleteGlobalMessage(
      id,
      req.userId,
    );

    res.json({ success: true, message: deletedMessage });
  } catch (error) {
    console.error("❌ DELETE /global/:id error:", error);

    if (error.message === "Message not found") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === "Unauthorized") {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Message already deleted") {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to delete message" });
  }
});

module.exports = router;
