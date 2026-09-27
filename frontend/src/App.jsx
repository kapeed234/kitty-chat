import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000";

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    "http://localhost:5000";

function App() {
    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem("user");
            return savedUser ? JSON.parse(savedUser) : null;
        } catch {
            return null;
        }
    });

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [message, setMessage] = useState("");
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [uploadingImage, setUploadingImage] = useState(false);
    const [messages, setMessages] = useState([]);
    const [connectionStatus, setConnectionStatus] =
        useState("Connecting...");
        const [partnerStatus, setPartnerStatus] =
    useState("Offline");

const [partnerTyping, setPartnerTyping] =
    useState(false);

const typingTimeoutRef = useRef(null);

    const socketRef = useRef(null);

    // =====================================
    // CONNECT TO SOCKET.IO
    // =====================================

    useEffect(() => {
        if (!user) {
            return;
        }

        const token = localStorage.getItem("token");

        if (!token) {
            return;
        }

       const socket = io(SOCKET_URL, {
            auth: {
                token: token
            }
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
            setConnectionStatus("Online");
        });

        socket.on("connect_error", (error) => {
            console.error(
                "Socket connection error:",
                error.message
            );

            setConnectionStatus("Connection failed");
        });

        // Previous messages from MongoDB
        socket.on("message_history", (history) => {
            console.log("Message history:", history);
            setMessages(history);
        });

        // New real-time message
       

       socket.on("user_online", (onlineUser) => {
    console.log(
        `${onlineUser.name} is online`
    );

    setPartnerStatus("Online");
});

socket.on("receive_message", (newMessage) => {
    console.log("New message:", newMessage);

    setMessages((oldMessages) => [
        ...oldMessages,
        newMessage
    ]);

    const senderId =
        newMessage.sender?._id ||
        newMessage.sender;

    if (
        senderId?.toString() !==
        user.id?.toString()
    ) {
        // Mark as delivered
        socket.emit(
            "message_delivered",
            {
                messageId: newMessage._id
            }
        );

        // The chat is currently open,
        // so mark it as seen.
        socket.emit(
            "message_seen",
            {
                messageId: newMessage._id
            }
        );
    }
});

socket.on(
    "message_delivered",
    (data) => {
        console.log(
            "Message delivered:",
            data.messageId
        );

        setMessages((oldMessages) =>
            oldMessages.map((item) =>
                item._id === data.messageId
                    ? {
                        ...item,
                        delivered: true,
                        deliveredAt:
                            data.deliveredAt
                    }
                    : item
            )
        );
    }
);

socket.on(
    "message_seen",
    (data) => {
        console.log(
            "Message seen:",
            data.messageId
        );

        setMessages((oldMessages) =>
            oldMessages.map((item) =>
                item._id === data.messageId
                    ? {
                        ...item,
                        seen: true,
                        seenAt: data.seenAt,
                        delivered: true
                    }
                    : item
            )
        );
    }
);

socket.on("user_offline", (offlineUser) => {
    console.log(
        `${offlineUser.name} is offline`
    );

    setPartnerStatus("Offline");
    setPartnerTyping(false);
});

socket.on("user_typing", (typingUser) => {
    console.log(
        `${typingUser.name} is typing`
    );

    setPartnerTyping(true);
});

socket.on("user_stop_typing", () => {
    setPartnerTyping(false);
});

       socket.on(
    "message_deleted",
    (data) => {

        setMessages((oldMessages) =>
            oldMessages.filter(
                (item) =>
                    item._id !== data.messageId
            )
        );
    }
);

        socket.on("chat_error", (errorMessage) => {
            console.error(
                "Chat error:",
                errorMessage
            );
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };

    }, [user]);

    // =====================================
    // LOGIN
    // =====================================

    const handleLogin = async (event) => {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await axios.post(
               `${API_URL}/api/auth/login`,
                {
                    email,
                    password
                }
            );

            localStorage.setItem(
                "token",
                response.data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(response.data.user)
            );

            setUser(response.data.user);

        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Unable to connect to backend"
            );
        } finally {
            setLoading(false);
        }
    };

    // =====================================
    // SEND MESSAGE
    // =====================================

   const handleImageSelect = (event) => {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("Please select an image.");
        event.target.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("Image must be smaller than 5 MB.");
        event.target.value = "";
        return;
    }

    setSelectedImage(file);

const previewUrl = URL.createObjectURL(file);

setImagePreview(previewUrl);
};

const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview("");
};
const handleSendMessage = async (event) => {
    event.preventDefault();

    const text = message.trim();

    if (!text && !selectedImage) {
        return;
    }

    if (
        !socketRef.current ||
        !socketRef.current.connected
    ) {
        setError("Chat server is not connected.");
        return;
    }

    let imageUrl = "";
    let imagePublicId = "";

    try {
        if (selectedImage) {
            setUploadingImage(true);

            const formData = new FormData();

            formData.append(
                "image",
                selectedImage
            );

            const token =
                localStorage.getItem("token");

            const response = await axios.post(
                `${API_URL}/api/uploads/image`,
                formData,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            imageUrl =
                response.data.imageUrl;

            imagePublicId =
    response.data.publicId;    
        }

        socketRef.current.emit(
            "send_message",
            {
                text,
                imageUrl,
                imagePublicId
            }
        );

       setMessage("");
setSelectedImage(null);
setImagePreview("");

    } catch (error) {

        console.error(
            "Image upload error:",
            error
        );

        alert(
            error.response?.data?.message ||
            "Unable to upload image."
        );

    } finally {
        setUploadingImage(false);
    }
};
const handleDeleteMessage = async (messageId) => {
    if (!messageId) {
        return;
    }

    const confirmed = window.confirm(
        "Delete this message?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const token =
            localStorage.getItem("token");

        await axios.delete(
            `${API_URL}/api/messages/${messageId}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        // Remove it immediately from this user's screen
        setMessages((oldMessages) =>
            oldMessages.filter(
                (item) =>
                    item._id !== messageId
            )
        );

        // Tell the other user to remove it too
        socketRef.current?.emit(
            "message_deleted",
            {
                messageId
            }
        );

    } catch (error) {

        console.error(
            "Delete message error:",
            error
        );

        alert(
            error.response?.data?.message ||
            "Unable to delete message."
        );
    }
};
    // =====================================
    // LOGOUT
    // =====================================

    const handleLogout = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        setUser(null);
        setMessages([]);
        setEmail("");
        setPassword("");
    };

    // =====================================
    // LOGIN PAGE
    // =====================================

    if (!user) {
        return (
            <div className="login-page">

                <div className="login-card">

                    <div className="logo">
                        🔒
                    </div>

                    <h1>
                        Kitty Chat
                    </h1>

                    <p className="subtitle">
                        Private chat for two people
                    </p>

                    <form onSubmit={handleLogin}>

                        <div className="input-group">

                            <label>
                                Email
                            </label>

                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                required
                            />

                        </div>

                        <div className="input-group">

                            <label>
                                Password
                            </label>

                            <input
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                required
                            />

                        </div>

                        {error && (
                            <p className="error-message">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                        >
                            {loading
                                ? "Logging in..."
                                : "Login"}
                        </button>

                    </form>

                    <p className="private-note">
                        🔐 Only two authorized users can access this chat.
                    </p>

                </div>

            </div>
        );
    }

    // =====================================
    // CHAT PAGE
    // =====================================

    return (
        <div className="chat-page">

            <header className="chat-header">

                <div className="chat-user">

                    <div className="avatar">
                        {user.name
                            ? user.name
                                .charAt(0)
                                .toUpperCase()
                            : "U"}
                    </div>

                    <div>

                        <h2>
                            Kitty Chat
                        </h2>

                        <span className="online-status">
                            🟢 {connectionStatus}
                        </span>

                    </div>

                </div>

                <button
                    className="logout-button"
                    onClick={handleLogout}
                >
                    Logout
                </button>

            </header>

            <main className="messages-container">

                {messages.length === 0 ? (

                    <div className="empty-chat">

                        <div className="empty-icon">
                            💬
                        </div>

                        <h3>
                            No messages yet
                        </h3>

                        <p>
                            Start your private conversation.
                        </p>

                    </div>

                ) : (

                    messages.map((item) => {

                        const senderId =
                            item.sender?._id ||
                            item.sender;

                        const isMine =
                            senderId?.toString() ===
                            user.id?.toString();

                        return (
                            <div
                                className="message-wrapper"
                                key={item._id || item.id}
                                style={{
                                    justifyContent: isMine
                                        ? "flex-end"
                                        : "flex-start"
                                }}
                            >

                                <div
                                    className="message-bubble"
                                    style={{
                                        background: isMine
                                            ? "#667eea"
                                            : "#e5e7eb",
                                        color: isMine
                                            ? "white"
                                            : "#222"
                                    }}
                                >

                                    {!isMine && (
                                        <strong>
                                            {item.sender?.name ||
                                                "Person 2"}
                                        </strong>
                                    )}

                                   {item.text && (
    <p>
        {item.text}
    </p>
)}

{item.imageUrl && (
    <img
        src={
    item.imageUrl.startsWith("http")
        ? item.imageUrl
        :  `${API_URL}${item.imageUrl}`
}
        alt="Shared"
        style={{
            maxWidth: "250px",
            maxHeight: "300px",
            borderRadius: "12px",
            display: "block",
            marginTop: item.text
                ? "8px"
                : "0",
            objectFit: "cover"
        }}
    />
)}
{isMine && (
    <button
        type="button"
        onClick={() =>
            handleDeleteMessage(item._id)
        }
        style={{
            border: "none",
            background: "transparent",
            color: isMine
                ? "rgba(255,255,255,0.8)"
                : "#777",
            cursor: "pointer",
            fontSize: "12px",
            padding: "2px 0",
            marginTop: "5px"
        }}
    >
        🗑️ Delete
    </button>
)}

{isMine && (
    <span
        className={
            item.seen
                ? "message-status seen"
                : "message-status"
        }
    >
        {item.delivered ? "✓✓" : "✓"}
    </span>
)}
                                    <span>
                                        {item.createdAt
                                            ? new Date(
                                                item.createdAt
                                            ).toLocaleTimeString(
                                                [],
                                                {
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                }
                                            )
                                            : ""}
                                    </span>

                                </div>

                            </div>
                        );
                    })

                )}

                {partnerTyping && (
    <div
        style={{
            padding: "5px 10px",
            color: "#777",
            fontSize: "13px",
            fontStyle: "italic"
        }}
    >
        ✍️ Partner is typing...
    </div>
)}

            </main>

           <form
    className="message-input-area"
    onSubmit={handleSendMessage}
>
     {imagePreview && (
    <div
        style={{
            position: "absolute",
            bottom: "80px",
            left: "20px",
            padding: "10px",
            background: "white",
            borderRadius: "14px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "10px"
        }}
    >

        <img
            src={imagePreview}
            alt="Preview"
            style={{
                width: "80px",
                height: "80px",
                objectFit: "cover",
                borderRadius: "10px"
            }}
        />

        <button
            type="button"
            onClick={handleRemoveImage}
            style={{
                width: "30px",
                height: "30px",
                border: "none",
                borderRadius: "50%",
                background: "#ef4444",
                color: "white",
                cursor: "pointer"
            }}
        >
            ×
        </button>

    </div>
)}
    <label
        style={{
            width: "45px",
            height: "45px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: "50%",
            background: "#f1f3ff",
            cursor: "pointer",
            fontSize: "20px"
        }}
        title="Send image"
    >
        📷

        <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{
                display: "none"
            }}
        />
    </label>


    <input
        type="text"
        placeholder={
            selectedImage
                ? "Add a message (optional)..."
                : "Type a message..."
        }
        value={message}
        onChange={(event) => {

            const value =
                event.target.value;

            setMessage(value);

            if (!socketRef.current) {
                return;
            }

            if (value.trim()) {

                socketRef.current.emit(
                    "typing"
                );

                clearTimeout(
                    typingTimeoutRef.current
                );

                typingTimeoutRef.current =
                    setTimeout(() => {

                        socketRef.current?.emit(
                            "stop_typing"
                        );

                    }, 1200);

            } else {

                socketRef.current.emit(
                    "stop_typing"
                );

                clearTimeout(
                    typingTimeoutRef.current
                );
            }
        }}
    />

    {selectedImage && (
        <span
            style={{
                fontSize: "12px",
                color: "#555",
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            }}
            title={selectedImage.name}
        >
            📎 {selectedImage.name}
        </span>
    )}

    <button
        type="submit"
        disabled={uploadingImage}
    >
        {uploadingImage ? "⏳" : "➤"}
    </button>

</form>

        </div>
    );
}

export default App;