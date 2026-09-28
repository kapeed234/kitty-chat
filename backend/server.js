const dotenv = require("dotenv");

dotenv.config();


const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const connectDB = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const User = require("./models/User");
const Message = require("./models/Message");
// Track how many active Socket.IO connections each user has
const onlineUsers = new Map();



const app = express();

const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://kitty-chat-one.vercel.app"
];

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(
    cors({
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
    })
);

app.use(express.json());

app.use(
    "/uploads",
    express.static("uploads")
);

app.use(
    "/api/uploads",
    uploadRoutes
);

connectDB();

app.use("/api/auth", authRoutes);
app.use(
    "/api/messages",
    messageRoutes
);

app.get("/", (req, res) => {
    res.json({
        message: "Kitty Private Chat Backend is running!"
    });
});

/*
    SOCKET.IO AUTHENTICATION
*/

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(
                new Error("Authentication required")
            );
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.userId);

        if (!user) {
            return next(
                new Error("User not found")
            );
        }

        socket.user = user;

        next();

    } catch (error) {
        console.error(
            "Socket authentication failed:",
            error.message
        );

        next(
            new Error("Invalid authentication token")
        );
    }
});

/*
    SOCKET CONNECTION
*/

io.on("connection", async (socket) => {

    console.log(
        `User connected: ${socket.user.name}`
    );

    const ROOM = "kitty-private-room";

    /*
        Allow only two different users
        in the private room.
    */

    const connectedUsers = new Set();

    for (const connectedSocket of io.sockets.sockets.values()) {
        if (connectedSocket.user) {
            connectedUsers.add(
                connectedSocket.user._id.toString()
            );
        }
    }

    if (connectedUsers.size > 2) {

        console.log(
            "Third user attempted to connect."
        );

        socket.emit(
            "chat_error",
            "This private chat already has two authorized users."
        );

        socket.disconnect(true);

        return;
    }

    socket.join(ROOM);

    /*
        SEND PREVIOUS MESSAGES
    */

    const previousMessages = await Message.find()
        .sort({ createdAt: 1 })
        .limit(100)
        .populate("sender", "name email");

    socket.emit(
        "message_history",
        previousMessages
    );

    /*
        USER JOINED
    */

   const userId = socket.user._id.toString();

const currentConnections =
    onlineUsers.get(userId) || 0;

onlineUsers.set(
    userId,
    currentConnections + 1
);

// Tell the other person that this user is online
if (currentConnections === 0) {
    socket.to(ROOM).emit(
        "user_online",
        {
            userId: socket.user._id,
            name: socket.user.name,
            email: socket.user.email
        }
    );
}

// Tell the newly connected user who is already online
for (const [connectedUserId, connectionCount] of onlineUsers) {
    if (
        connectedUserId !== userId &&
        connectionCount > 0
    ) {
        const connectedUser =
            await User.findById(connectedUserId)
                .select("name email");

        if (connectedUser) {
            socket.emit(
                "user_online",
                {
                    userId: connectedUser._id,
                    name: connectedUser.name,
                    email: connectedUser.email
                }
            );
        }
    }
}

    /*
        SEND MESSAGE
    */

    socket.on(
    "send_message",
    async (data) => {

        try {

            const text =
                typeof data.text === "string"
                    ? data.text.trim()
                    : "";

            const imageUrl =
                typeof data.imageUrl === "string"
                    ? data.imageUrl.trim()
                    : "";
            const imagePublicId =
    typeof data.imagePublicId === "string"
        ? data.imagePublicId.trim()
        : "";        

            if (!text && !imageUrl) {
                return;
            }

            const newMessage =
                await Message.create({
                    sender: socket.user._id,
                    text,
                    imageUrl,
                     imagePublicId,
                      delivered: false,
        seen: false
                });

            const populatedMessage =
                await newMessage.populate(
                    "sender",
                    "name email"
                );

            io.to(ROOM).emit(
                "receive_message",
                populatedMessage
            );

        } catch (error) {

            console.error(
                "Message error:",
                error
            );

            socket.emit(
                "chat_error",
                "Unable to send message."
            );
        }
    }
);
socket.on(
    "message_delivered",
    async (data) => {
        try {
            if (!data?.messageId) {
                return;
            }

            const message =
                await Message.findById(
                    data.messageId
                );

            if (!message) {
                return;
            }

            // Only the receiver should mark
            // another user's message as delivered.
            if (
                message.sender.toString() ===
                socket.user._id.toString()
            ) {
                return;
            }

            if (!message.delivered) {
                message.delivered = true;
                message.deliveredAt = new Date();

                await message.save();

                io.to(ROOM).emit(
                    "message_delivered",
                    {
                        messageId:
                            message._id.toString(),
                        deliveredAt:
                            message.deliveredAt
                    }
                );
            }

        } catch (error) {

            console.error(
                "Delivery status error:",
                error
            );
        }
    }
);


socket.on(
    "message_seen",
    async (data) => {
        try {
            if (!data?.messageId) {
                return;
            }

            const message =
                await Message.findById(
                    data.messageId
                );

            if (!message) {
                return;
            }

            // Only the receiver can mark
            // another user's message as seen.
            if (
                message.sender.toString() ===
                socket.user._id.toString()
            ) {
                return;
            }

            if (!message.seen) {
                message.seen = true;
                message.seenAt = new Date();

                // A seen message is also delivered.
                message.delivered = true;

                if (!message.deliveredAt) {
                    message.deliveredAt = new Date();
                }

                await message.save();

                io.to(ROOM).emit(
                    "message_seen",
                    {
                        messageId:
                            message._id.toString(),
                        seenAt:
                            message.seenAt
                    }
                );
            }

        } catch (error) {
            console.error(
                "Seen status error:",
                error
            );
        }
    }
);
        /*
        TYPING INDICATOR
    */

    socket.on("typing", () => {
        socket.to(ROOM).emit("user_typing", {
            userId: socket.user._id,
            name: socket.user.name
        });
    });

    socket.on("stop_typing", () => {
        socket.to(ROOM).emit("user_stop_typing", {
            userId: socket.user._id
        });
    });
socket.on(
    "message_deleted",
    (data) => {

        if (!data?.messageId) {
            return;
        }

        socket.to(ROOM).emit(
            "message_deleted",
            {
                messageId: data.messageId
            }
        );
    }
);
    /*
        DISCONNECT
    */

   socket.on(
    "disconnect",
    () => {

        const userId =
            socket.user._id.toString();

        const currentConnections =
            onlineUsers.get(userId) || 0;

        const remainingConnections =
            Math.max(
                currentConnections - 1,
                0
            );

        if (remainingConnections === 0) {
            onlineUsers.delete(userId);

            console.log(
                `User offline: ${socket.user.name}`
            );

            socket.to(ROOM).emit(
                "user_offline",
                {
                    userId: socket.user._id,
                    name: socket.user.name,
                    email: socket.user.email
                }
            );
        } else {
            onlineUsers.set(
                userId,
                remainingConnections
            );

            console.log(
                `User still connected: ${socket.user.name}`
            );
        }
    }
);
});

const PORT = process.env.PORT || 5000;
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        service: "Kitty Chat Backend"
    });
});
server.listen(PORT, () => {

    console.log(
        `Server running on http://localhost:${PORT}`
    );

});