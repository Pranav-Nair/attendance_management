const express = require("express")
const {parseToken} = require("../validators/validator")
const Batch = require("../models/batchmodel")
const {User} = require("../models/usermodel")
const Attendance = require("../models/attendancemodel")
const fs = require("fs")

const attendanceRoute = express.Router()

attendanceRoute.post("/checkin", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if (!req.body.batchcode || !req.body.location || !req.body.deviceId) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','location','deviceId']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode,members : user._id.toString()})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        const todaystart = new Date().setHours(0,0,0,0)
        const todayend = new Date().setHours(23,59,59,999)
        const lastAttended = await Attendance.findOne({userId : user._id.toString(),batchId : batch._id.toString()})
            .sort({createdAt : -1}).limit(1)
        if (lastAttended.checkedIn) {
            return resp.status(400).json({error : "already checked in"})
        }
        if(lastAttended.createdAt >= todaystart && lastAttended.createdAt <=todayend && lastAttended.checkedIn==false) {
            return resp.status(400).json({error : "you are checked out for todat"})
        }
        const newattendance = await new Attendance({userId : user._id.toString(),batchId : batch._id.toString(),checkedIn : true
            ,deviceId : req.body.deviceId,location : req.body.location})
            const attendance = await newattendance.save()
            return resp.json(attendance)
    }
    catch(err){
        console.log(err)
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/checkout", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if (!req.body.batchcode || !req.body.location || !req.body.deviceId) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','location','deviceId']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode,members : user._id.toString()})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        const todaystart = new Date().setHours(0,0,0,0)
        const todayend = new Date().setHours(23,59,59,999)
        const attendance = await Attendance.findOne({userId : user._id.toString(),batchId : batch._id.toString(),checkedIn : true})
            .sort({createdAt : -1}).limit(1)
        if (!attendance) {
            return resp.status(400).json({error : "you are not checked in"})
        }
        const update = await attendance.updateOne({checkedIn : false})
        return resp.json(update)
    }
    catch(err){
        console.log(err)
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/upload",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        let form = new FormData()

        if (!req.files || !req.files.img) {
            return resp.json({error : "missing fields",required_fields : ['img']})
        } 
        fs.mkdirSync("./usermedia/"+user._id.toString()+"/photo",{recursive : true})
        await req.files.img.mv("./usermedia/"+user._id.toString()+"/photo/"+"self")
        const image = fs.readFileSync("./usermedia/"+user._id.toString()+"/photo/"+"self")
        let blob = new Blob([image])
        form.append("id",user._id.toString())
        form.append("img",blob,req.files.img.name)
        const response = await fetch("http://localhost:5000/ml/upload",{
            method : "POST",
            body : form
        })
        const resp_json = await response.json()
        fs.rmSync("./usermedia/"+user._id.toString()+"/photo/"+"self")
        return resp.json(resp_json)
    }
    catch(err) {
        return resp.json({error : err.toString()})
    }
})

attendanceRoute.post("/compare",async(req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        let form = new FormData()

        if (!req.files || !req.files.img) {
            return resp.json({error : "missing fields",required_fields : ['img']})
        } 
        fs.mkdirSync("./usermedia/"+user._id.toString()+"/tmp",{recursive : true})
        await req.files.img.mv("./usermedia/"+user._id.toString()+"/tmp/"+req.files.img.name)
        const image = fs.readFileSync("./usermedia/"+user._id.toString()+"/tmp/"+req.files.img.name)
        let blob = new Blob([image])
        form.append("id",user._id.toString())
        form.append("img",blob,req.files.img.name)
        const response = await fetch("http://localhost:5000/ml/compare",{
            method : "POST",
            body : form
        })
        const resp_json = await response.json()
        fs.rmSync("./usermedia/"+user._id.toString()+"/tmp/"+req.files.img.name)
        return resp.json(resp_json)
    }
    catch(err) {
        return resp.json({error : err.toString()})
    }
})

module.exports = attendanceRoute