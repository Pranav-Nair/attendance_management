const mongoose = require("mongoose")

const BatchSchema = mongoose.Schema({
    name : {
        type : String,
        required : true
    },
    short_id : {
        type : String,
        unique : true
    },
    owner : {
        type : String,
        required : true
    },
    co_owners : {
        type : Array,
        default : []
    },
    members : {
        type : Array,
        default : []
    }
},{timestamps : true})

const Batch = mongoose.model("Batch",BatchSchema)

module.exports = Batch