const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
    deleteMessage
} = require("../controllers/messageController");

const router = express.Router();

router.delete(
    "/:messageId",
    protect,
    deleteMessage
);

module.exports = router;