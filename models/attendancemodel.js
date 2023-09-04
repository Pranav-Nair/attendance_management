const mongoose = require("mongoose")

const AttendanceSchema = mongoose.Schema({
    batchId : {
        type : String,
        required : true
    },
    userId : {
        type : String,
        required : true
    },
    checkedIn : {
        type : Boolean,
        required : true
    },
    location : {
        type : String,
        required : true
    },
    deviceId : {
        type : String,
        required : true
    }
},{timestamps : true})

const Attendance = mongoose.model("Attendance",AttendanceSchema)

module.exports = Attendance