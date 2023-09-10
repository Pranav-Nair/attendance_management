const mongoose = require("mongoose")
const UserSchema = mongoose.Schema({
    email : {
        type : String,
    },
    username : {
        type : String,
        required : true,
        unique : true
    },
    phone : {
        type : Number,
    },
    first_name : {
        type : String,
        required : true
    },
    last_name : {
        type : String,
        required : true
    },
    middle_name : {
        type : String,
    },
    password : {
        type : String,
        required : true
    }
},{timestamps : true})

const User = mongoose.model("User",UserSchema)

const authSchema = mongoose.Schema({
    userId : {
        type : String,
        required : true
    },
    batchId : {
        type : String,
        required : true
    },
    location : {
        type : String,
        required : true
    },
    deviceId : {
        type : String,
        required : true
    },
    requestType : {
        type : String,
        enum : ["logIn","Ping","uploadFace","deleteFace"]
    }
},{timestamps : true})

const authLog = mongoose.model("authLog",authSchema)

module.exports ={ User,authLog}