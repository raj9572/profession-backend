import mongoose from "mongoose";
import { DB_Name } from "../constants.js";



async function connectDB() {
    try {
      const connectionInstant = await mongoose.connect(`${process.env.MONGODB_URI}`);
      console.log(`/n Mongodb connected !! DB HOST : ${connectionInstant.connection.host}`)

        
    } catch (error) {
        console.log('mongodb connection error',error)
        process.exit(1)
    }

}

export default connectDB