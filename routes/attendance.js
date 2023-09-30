const express = require("express")
const {parseToken,isvalidDate} = require("../validators/validator")
const Batch = require("../models/batchmodel")
const {User,authLog} = require("../models/usermodel")
const Attendance = require("../models/attendancemodel")
const fs = require("fs")
const {resolve} = require("path")

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
            return resp.status(400).json({error : "missing fields",required_fields : ['img','location','deviceId',]})
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
        return resp.status(400).json({error : err.toString()})
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
            return resp.status(400).json({error : "missing fields",required_fields : ['img']})
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
        return resp.status(400).json({error : err.toString()})
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
            return resp.status(400).json({error : "missing fields",required_fields : ['location','deviceId',]})
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
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.get("/list/today/:batchcode",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.params.batchcode) {
            return resp.status(400).json({error : "missing arguments",required_args : ['batchcode']})
        } 
        const batch = await Batch.findOne({short_id : req.params.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        const todaystart = new Date().setHours(0,0,0,0)
        const todayend = new Date().setHours(23,59,59,99)
        let attendances = await Attendance.find({batchId : batch._id , createdAt : {$gte : todaystart,$lte : todayend}})
        let checkedIns = []
        let checkedOuts = []
        let absent = []
        for (const attendance of attendances) {
            let member = await User.findById(attendance.userId)
            if (attendance.checkedIn) {
                checkedIns.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedIn : attendance.checkedIn,cheeckin_time : attendance.createdAt})
            }else {
                let clocked_hours = Math.abs(attendance.updatedAt - attendance.createdAt)/36e5
                clocked_hours =parseFloat(clocked_hours.toFixed(2))
                checkedOuts.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : !attendance.checkedIn,cheeckout_time : attendance.updatedAt,clocked_hours : clocked_hours})
            }
        }
        for (const member of batch.members) {
            const memberuser = await User.findById(member)
            if (!checkedIns.some(checkIn=> checkIn.username==memberuser.username) && !checkedOuts.some(checkout=> checkout.username==memberuser.username)) {
                absent.push({username : memberuser.username,email : memberuser.email,phone : memberuser.phone,name : memberuser.first_name +" "+memberuser.middle_name + " "+memberuser.last_name})
            }
        }

        return resp.status(200).json({checkedIns : checkedIns,checkedOuts : checkedOuts,absent : absent})

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/list", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode || !req.body.startdate) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','startdate','enddate']})
        }
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let enddate =req.body.startdate
        if (req.body.enddate) {
            if (!isvalidDate(req.body.enddate)) {
                return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
            }
            enddate = req.body.enddate
        }
        const todaystart = new Date(req.body.startdate).setHours(0,0,0,0)
        const todayend = new Date(enddate).setHours(23,59,59,99)
        let attendances = await Attendance.find({batchId : batch._id , createdAt : {$gte : todaystart,$lte : todayend}})
        let checkedOuts = []
        let checkedIns = []
        let absent = []
        for (const attendance of attendances) {
            let member = await User.findById(attendance.userId)
            let clocked_hours = Math.abs(attendance.updatedAt - attendance.createdAt)/36e5
            clocked_hours = parseFloat(clocked_hours.toFixed(2))
            if (attendance.checkedIn && !checkedIns.some(checkin=>checkin.username===member.username)) {
                checkedIns.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : attendance.checkedIn,cheeckout_time : attendance.updatedAt})

            }
            if (!attendance.checkedIn && !checkedOuts.some(checkout=>checkout.username===member.username)) {
                checkedOuts.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : !attendance.checkedIn,cheeckout_time : attendance.updatedAt,clocked_hours : clocked_hours})
            }
            if (!attendance.checkedIn && checkedOuts.some(checkout=>checkout.username===member.username)) {
                checkedOuts.map(checkout=>{
                    if (checkout.username===member.username) {
                        checkout.clocked_hours = checkout.clocked_hours + clocked_hours
                    }
                })
            }
        }
        for (const member of batch.members) {
            const memberuser = await User.findById(member)
            if (!checkedOuts.some(checkout=> checkout.username==memberuser.username)) {
                console.log(checkedIns.includes({username : memberuser.username}))
                absent.push({username : memberuser.username,email : memberuser.email,phone : memberuser.phone,name : memberuser.first_name +" "+memberuser.middle_name + " "+memberuser.last_name})
            }
        }

        return resp.status(200).json({checkedOuts : checkedOuts,absents :absent,checkedIns : checkedIns})

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/list/user", async(req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode || !req.body.startdate || !req.body.username) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','startdate','enddate','username']})
        } 
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const memberuser = await User.findOne({username : req.body.username})
        if (!memberuser) {
            return resp.status(404).json({error : "member not found"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (!batch.members.includes(memberuser._id.toString())) {
            return resp.status(404).json({error : "member not in batch"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let enddate =req.body.startdate
        if (req.body.enddate) {
            if (!isvalidDate(req.body.enddate)) {
                return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
            }
            enddate = req.body.enddate
        }
        const todaystart = new Date(req.body.startdate).setHours(0,0,0,0)
        const todayend = new Date(enddate).setHours(23,59,59,99)
        let attendances = await Attendance.find({batchId : batch._id.toString(),userId : memberuser._id.toString() , createdAt : {$gte : todaystart,$lte : todayend}})
        let checkedIns = []
        let checkedOuts = []
        for (const attendance of attendances) {
            let member = await User.findById(attendance.userId)
            if (attendance.checkedIn) {
                checkedIns.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedIn : attendance.checkedIn,cheeckin_time : attendance.createdAt})
            }else {
                let clocked_hours = Math.abs(attendance.updatedAt - attendance.createdAt)/36e5
                clocked_hours = parseFloat(clocked_hours.toFixed(2))
                checkedOuts.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : !attendance.checkedIn,cheeckout_time : attendance.updatedAt,clocked_hours : clocked_hours})
            }
        }
        return resp.status(200).json({checkedIns : checkedIns,checkedOuts : checkedOuts})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.get("/logs/today/:batchcode",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.params.batchcode) {
            return resp.status(400).json({error : "missing arguments",required_args : ['batchcode']})
        } 
        const batch = await Batch.findOne({short_id : req.params.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        const todaystart = new Date().setHours(0,0,0,0)
        const todayend = new Date().setHours(23,59,59,99)
        const authlogs =  await authLog.find({batchId : batch._id.toString(),createdAt : {$gte : todaystart,$lte : todayend}})
        let auths = []
        for (const authlog of authlogs) {
            const member = await User.findById(authlog.userId.toString())
            console.log(authlog.userId)
            auths.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name+ " "+member.middle_name+" "+member.last_name,
        action : authlog.requestType,location : authlog.location,deviceId : authlog.deviceId,action_time : authlog.createdAt})
        }

        return resp.status(200).json({user_activity : auths})

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/logs/user",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode || !req.body.startdate || !req.body.username) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','startdate','enddate','username']})
        } 
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const memberuser = await User.findOne({username : req.body.username})
        if (!memberuser) {
            return resp.status(404).json({error : "member not found"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (!batch.members.includes(memberuser._id.toString())) {
            return resp.status(404).json({error : "member not in batch"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let enddate =req.body.startdate
        if (req.body.enddate) {
            if (!isvalidDate(req.body.enddate)) {
                return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
            }
            enddate = req.body.enddate
        }
        const todaystart = new Date(req.body.startdate).setHours(0,0,0,0)
        const todayend = new Date(enddate).setHours(23,59,59,99)
        const authlogs =  await authLog.find({batchId : batch._id.toString(),userId : memberuser._id.toString(),createdAt : {$gte : todaystart,$lte : todayend}})
        let auths = []
        for (const authlog of authlogs) {
            const member = await User.findById(authlog.userId.toString())
            auths.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name+ " "+member.middle_name+" "+member.last_name,
        action : authlog.requestType,location : authlog.location,deviceId : authlog.deviceId,action_time : authlog.createdAt})
        }
        return resp.json({user_activity : auths})

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/logs",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode || !req.body.startdate) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','startdate','enddate']})
        } 
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let enddate =req.body.startdate
        if (req.body.enddate) {
            if (!isvalidDate(req.body.enddate)) {
                return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
            }
            enddate = req.body.enddate
        }
        const todaystart = new Date(req.body.startdate).setHours(0,0,0,0)
        const todayend = new Date(enddate).setHours(23,59,59,99)
        const authlogs =  await authLog.find({batchId : batch._id.toString(),createdAt : {$gte : todaystart,$lte : todayend}})
        let auths = []
        for (const authlog of authlogs) {
            const member = await User.findById(authlog.userId.toString())
            auths.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name+ " "+member.middle_name+" "+member.last_name,
        action : authlog.requestType,location : authlog.location,deviceId : authlog.deviceId,action_time : authlog.createdAt})
        }
        return resp.json({user_activity : auths})

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/graph/avg-v-user",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode || !req.body.startdate || !req.body.username) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','startdate','enddate','username']})
        } 
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const memberuser = await User.findOne({username : req.body.username})
        if (!memberuser) {
            return resp.status(404).json({error : "member not found"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let enddate =req.body.startdate
        if (req.body.enddate) {
            if (!isvalidDate(req.body.enddate)) {
                return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
            }
            enddate = req.body.enddate
        }
        const todaystart = new Date(req.body.startdate).setHours(0,0,0,0)
        const todayend = new Date(enddate).setHours(23,59,59,99)
        let attendances = await Attendance.find({batchId : batch._id.toString() , createdAt : {$gte : todaystart,$lte : todayend},checkedIn : false})
        let checkedOuts = []
        let usercheckOuts = []
        for (const attendance of attendances) {
            let member = await User.findById(attendance.userId)
            let clocked_hours = Math.abs(attendance.updatedAt - attendance.createdAt)/36e5
            clocked_hours = parseFloat(clocked_hours.toFixed(2))
            if (attendance.userId=memberuser._id.toString()) {
                usercheckOuts.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : !attendance.checkedIn,cheeckout_time : attendance.updatedAt,clocked_hours : clocked_hours})
            } else {
                checkedOuts.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : !attendance.checkedIn,cheeckout_time : attendance.updatedAt,clocked_hours : clocked_hours})
            }
        }
        let useravg = usercheckOuts.reduce((total,next)=>total + next.checkedOut,0) / usercheckOuts.length
        let batchavg = checkedOuts.reduce((total,next)=>total + next.checkedOut,0) / checkedOuts.length
        if (!batchavg || batchavg==0) {
            batchavg=0.00001
        }
        const jsondata = JSON.stringify({useravg : useravg,batchavg : batchavg,batchId : batch._id.toString()})
        const response = await fetch("http://localhost:5000/analytics/user-v-batch",{
            method : "POST",
            body : jsondata,
            headers : {
                'Content-Type': 'application/json'
            }
        })

        const blob = await response.blob()
        let arraybuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arraybuffer)
        if (!fs.existsSync("graphs/"+batch._id.toString())) {
            fs.mkdirSync("graphs/"+batch._id.toString(),{recursive : true})
        }
        fs.writeFileSync("graphs/"+batch._id.toString()+"/user-v-batch.png",buffer)
        const abs_path = resolve("graphs/"+batch._id.toString()+"/user-v-batch.png")
        return resp.sendFile(abs_path)

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/graph/checkin-v-checkout",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode || !req.body.startdate) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','startdate']})
        } 
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let enddate =req.body.startdate
        const todaystart = new Date(req.body.startdate).setHours(0,0,0,0)
        const todayend = new Date(enddate).setHours(23,59,59,99)
        let attendances = await Attendance.find({batchId : batch._id.toString() , createdAt : {$gte : todaystart,$lte : todayend}})
        let checkedOuts = []
        let checkIns = []
        for (const attendance of attendances) {
            let member = await User.findById(attendance.userId)
            let clocked_hours = Math.abs(attendance.updatedAt - attendance.createdAt)/36e5
            clocked_hours = parseFloat(clocked_hours.toFixed(2))
            if (attendance.checkedIn) {
                checkIns.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : !attendance.checkedIn,cheeckout_time : attendance.updatedAt,clocked_hours : clocked_hours})
            } else {
                checkedOuts.push({username : member.username,email : member.email,phone : member.phone,name : member.first_name +" "+member.middle_name + " "+member.last_name,checkedOut : !attendance.checkedIn,cheeckout_time : attendance.updatedAt,clocked_hours : clocked_hours})
            }
        }
        let checkinCount = checkIns.length
        let checkoutCount = checkedOuts.length
        let memberCount = batch.members.length
        const jsondata = JSON.stringify({checkIns : checkinCount,checkOuts : checkoutCount,total : memberCount,batchId : batch._id.toString()})
        console.log(jsondata)
        const response = await fetch("http://localhost:5000/analytics/checkin-v-checkout",{
            method : "POST",
            body : jsondata,
            headers : {
                'Content-Type': 'application/json'
            }
        })

        const blob = await response.blob()
        let arraybuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arraybuffer)
        if (!fs.existsSync("graphs/"+batch._id.toString())) {
            fs.mkdirSync("graphs/"+batch._id.toString(),{recursive : true})
        }
        fs.writeFileSync("graphs/"+batch._id.toString()+"/checkin-v-checkout.png",buffer)
        const abs_path = resolve("graphs/"+batch._id.toString()+"/checkin-v-checkout.png")
        return resp.sendFile(abs_path)

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/graphs/avgtime-btw-dates", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode || !req.body.startdate || !req.body.enddate) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','startdate','enddate']})
        } 
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let enddate =req.body.startdate
        const todaystart = new Date(req.body.startdate).setHours(0,0,0,0)
        const todayend = new Date(enddate).setHours(23,59,59,99)
        let attendances = await Attendance.aggregate([
            {
              $match: {
                batchId: batch._id.toString()
              }
            },
            {
              $project: {
                createdAt : 1,
                day: { $dayOfYear: "$createdAt" },
                timeDifference: {
                  $divide: [
                    { $subtract: ["$updatedAt", "$createdAt"] },
                    3600000
                  ]
                }
              }
            },
            {
              $group: {
                _id: {
                    day: { $dayOfYear: "$createdAt" },
                    year: { $year: "$createdAt" }, // Extract the year from createdAt
                  },
                avgTimeDifference: { $avg: "$timeDifference" }
              }
            },
            {
              $sort: { _id: 1 }
            }
          ])
        
        let dates = []
        let avg_time = []
        attendances = attendances.map((attendance) => {
        const year = attendance._id.year;
        const dayOfYear = attendance._id.day;
        const date = new Date(year, 0); // Create a new date with the extracted year
        date.setDate(dayOfYear); // Set the day of the year
            return {
                date,
                avgTimeDifference: attendance.avgTimeDifference,
            };
        });
        for (const attendance of attendances) {
            dates.push(attendance.date)
            avg_time.push(attendance.avgTimeDifference)
        }
        const jsondata = JSON.stringify({dates : dates,avg_times : avg_time,batchId : batch._id.toString()})
        const response = await fetch("http://localhost:5000/analytics/avgtime-btw-dates",{
            method : "POST",
            body : jsondata,
            headers : {
                'Content-Type': 'application/json'
            }
        })

        const blob = await response.blob()
        let arraybuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arraybuffer)
        if (!fs.existsSync("graphs/"+batch._id.toString())) {
            fs.mkdirSync("graphs/"+batch._id.toString(),{recursive : true})
        }
        fs.writeFileSync("graphs/"+batch._id.toString()+"/avgtime-btw-dates.png",buffer)
        const abs_path = resolve("graphs/"+batch._id.toString()+"/avgtime-btw-dates.png")
        return resp.sendFile(abs_path)

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

attendanceRoute.post("/graphs/location-v-checkouts", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }

        if (!req.body.batchcode) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode']})
        } 
        if (!isvalidDate(req.body.startdate)) {
            return resp.status(400).json({error : "invalid date format",format : "YYYY-MM-DD"})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner !== user._id.toString() && !batch.co_owners.includes(user._id.toString())) {
            return resp.status(400).json({error : "PErmission denied",msg : "owners and co_owners can view attendance"})
        }
        let attendances = await Attendance.aggregate([
            {
                $match: {
                    checkedIn: false,
                    batchId : batch._id.toString()
                }
            },
            {
                $group: {
                    _id: '$location',
                    checkedIn: { $sum: 1 }
                }
            },
            {
                $project: {
                    location: '$_id',
                    checkedIn: 1,
                    _id: 0
                }
            }
        ]);
        let locations = []
        let count = []
        for (const attendance of attendances) {
            locations.push(attendance.location)
            count.push(attendance.checkedIn)
        }
        const jsondata = JSON.stringify({locations : locations,count : count,batchId : batch._id.toString()})
        const response = await fetch("http://localhost:5000/analytics/location-v-checkout",{
            method : "POST",
            body : jsondata,
            headers : {
                'Content-Type': 'application/json'
            }
        })

        const blob = await response.blob()
        let arraybuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arraybuffer)
        if (!fs.existsSync("graphs/"+batch._id.toString())) {
            fs.mkdirSync("graphs/"+batch._id.toString(),{recursive : true})
        }
        fs.writeFileSync("graphs/"+batch._id.toString()+"/locations-checkout.png",buffer)
        const abs_path = resolve("graphs/"+batch._id.toString()+"/locations-checkout.png")
        return resp.sendFile(abs_path)

    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})


module.exports = attendanceRoute