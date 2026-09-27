const Message = require("../models/Message");
const cloudinary = require("../config/cloudinary");

const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                message: "Message not found"
            });
        }

        // Only the sender can delete their message
        if (
            message.sender.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message:
                    "You can only delete your own messages"
            });
        }

        // Delete image from Cloudinary
        if (message.imagePublicId) {
            try {
                await cloudinary.uploader.destroy(
                    message.imagePublicId
                );

                console.log(
                    "Cloudinary image deleted:",
                    message.imagePublicId
                );

            } catch (cloudinaryError) {

                console.error(
                    "Cloudinary deletion failed:",
                    cloudinaryError.message
                );
            }
        }

        // Delete message from MongoDB
        await Message.findByIdAndDelete(messageId);

        res.json({
            message:
                "Message deleted successfully",
            messageId
        });

    } catch (error) {

        console.error(
            "Delete message error:",
            error
        );

        res.status(500).json({
            message:
                "Unable to delete message"
        });
    }
};

module.exports = {
    deleteMessage
};