const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        text: {
            type: String,
            trim: true,
            default: ""
        },

        imageUrl: {
            type: String,
            default: ""
        },

        imagePublicId: {
            type: String,
            default: ""
        },

        delivered: {
            type: Boolean,
            default: false
        },

        deliveredAt: {
            type: Date,
            default: null
        },

        seen: {
            type: Boolean,
            default: false
        },

        seenAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Message", messageSchema);