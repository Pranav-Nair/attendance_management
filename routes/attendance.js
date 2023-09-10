const express = require("express")
const {parseToken} = require("../validators/validator")
const Batch = require("../models/batchmodel")
const {User,authLog} = require("../models/usermodel")
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

        if (!req.files || !req.files.img || !req.body.location || !req.body.deviceId) {
            return resp.json({error : "missing fields",required_fields : ['img','location','deviceId',]})
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
        const status = response.status
        fs.rmSync("./usermedia/"+user._id.toString()+"/photo/"+"self")
        const batches = await Batch.find({members : user._id.toString()})
        for(const batch of batches) {
            const auth = await new authLog({
                location : req.body.location,
                deviceId : req.body.deviceId,
                batchId : batch._id.toString(),
                requestType : "uploadFace",
                userId : user._id.toString()
            })
            await auth.save()
        }
        return resp.status(status).json(resp_json)
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
        const stat = response.status
        fs.rmSync("./usermedia/"+user._id.toString()+"/tmp/"+req.files.img.name)
        return resp.status(stat).json(resp_json)
    }
    catch(err) {
        return resp.status(stat).json({error : err.toString()})
    }
})

attendanceRoute.post("/delete",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.location || !req.body.deviceId) {
            return resp.json({error : "missing fields",required_fields : ['location','deviceId',]})
        } 
        const jsondata = JSON.stringify({
            id : user._id.toString()
        })
        const batches = await Batch.find({members : user._id.toString()})
        for(const batch of batches) {
        const auth = await new authLog({
                location : req.body.location,
                deviceId : req.body.deviceId,
                batchId : batch._id.toString(),
                requestType : "deleteFace",
                userId : user._id.toString()
            })
            await auth.save()

        }
        const response = await fetch("http://localhost:5000/ml/delete",{
            method : "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body : jsondata
        })
        const resp_json = await response.json()
        const status = response.status
        return resp.status(status).json(resp_json)
    }
    catch(err) {
        return resp.json({error : err.toString()})
    }
})

module.exports = attendanceRoute