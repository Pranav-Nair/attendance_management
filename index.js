const express = require("express")
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const https = require("https")
const fs = require("fs")
const fileupload = require("express-fileupload")
const userRoute = require("./routes/user")
const batchRoute = require("./routes/batch")
const attendanceRoute = require("./routes/attendance")
const {V3} = require("paseto")

dotenv.config()
mongoose.connect(process.env.dbURi,{dbName : "attendancedb"})
    .then(()=>{
        console.log("[OK] Database Connection Success")
    })
    .catch((err)=>{
        console.log("[ERROR] ",err.toString())
    })
const app = express()
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(fileupload())
app.use("/api/user",userRoute)
app.use("/api/batch",batchRoute)
app.use("/api/attendance",attendanceRoute)

fetch(process.env.pyfaceURi)
    .then((response)=>{
        console.log("[OK] face recognition system running")
    })
    .catch((err)=>{
        console.log("[ERROR] face recognitionsystem is down")
    })

    const https_server = https.createServer({key :fs.readFileSync("certs/key.pem",).toString(),cert : fs.readFileSync("certs/cert.pem").toString()},app)
    https_server.listen(3000,"0.0.0.0",()=>{
        console.log("[OK] server is running")
    })