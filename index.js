const express = require("express")
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const fileupload = require("express-fileupload")
const userRoute = require("./routes/user")
const batchRoute = require("./routes/batch")
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

app.listen(3000,(err,_)=>{
    if(err) {
        console.log("[ERROR] ",err.toString())
    }
    else {
        console.log("[OK] Server started")
    }
})