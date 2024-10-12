import mongoose from "mongoose";
import {DB_NAME} from "../constants.js";

const connectDB = async () => {
    try {
        const conneectionInstance =await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

        console.log(`MongoDB connected! Host: ${conneectionInstance.connection.host}`);
    } catch (error) {
        console.log("MongoDB connection error",error);
        process.exit(1);
    }
}

export default connectDB


//Assignments
//1. process.exit
//2. console log the connectionInstance