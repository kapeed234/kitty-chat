const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("./models/User");

dotenv.config();

const createUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("Connected to MongoDB");

        await User.deleteMany({});

        const password1 = await bcrypt.hash("Person1@123", 12);
        const password2 = await bcrypt.hash("Person2@123", 12);

        await User.create([
            {
                name: "Person 1",
                email: "person1@kitty.com",
                password: password1
            },
            {
                name: "Person 2",
                email: "person2@kitty.com",
                password: password2
            }
        ]);

        console.log("Two private users created successfully");

        await mongoose.disconnect();

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

createUsers();