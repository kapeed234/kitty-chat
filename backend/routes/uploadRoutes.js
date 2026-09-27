const express = require("express");
const multer = require("multer");
const protect = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),

    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only JPG, PNG, WEBP and GIF images are allowed."
                )
            );
        }
    },

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

router.post(
    "/image",
    protect,
    upload.single("image"),
    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    message: "No image uploaded"
                });
            }

            const result =
                await new Promise(
                    (resolve, reject) => {

                        const stream =
                            cloudinary.uploader.upload_stream(
                                {
                                    folder: "kitty-chat"
                                },
                                (error, result) => {

                                    if (error) {
                                        reject(error);
                                    } else {
                                        resolve(result);
                                    }
                                }
                            );

                        stream.end(req.file.buffer);
                    }
                );

            res.json({
                message:
                    "Image uploaded successfully",

                imageUrl: result.secure_url,

                publicId: result.public_id
            });

        } catch (error) {

            console.error(
                "Cloudinary upload error:",
                error
            );

            res.status(500).json({
                message:
                    "Unable to upload image"
            });
        }
    }
);

module.exports = router;