// require('dotenv').config({path: './env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import {app} from './app.js'


dotenv.config({
    path:"./.env"
})


connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("server Error",error)
        
    })
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`server is listning on port ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log('MONGODB Connection FAILED:',err)
})












/*
import express from 'express'
const app = express()


;(async ()=>{
    try {
       await mongoose.connect(`${process.env.MONGODB_URI}/${DB_Name}`)
        app.on("error",(error)=>{
            console.log("Error",error)
            throw error
        })

        app.listen(process.env.PORT,()=>{
            console.log(`app is listning on port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("Error",error)
        throw error
    }
})()
*/