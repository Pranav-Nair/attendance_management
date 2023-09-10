const express = require("express")
const {User,authLog} = require("../models/usermodel")
const Batch = require("../models/batchmodel")
const Attendance = require("../models/attendancemodel")
const validator = require("email-validator");
const {isValidpassowrd,isValidusername} = require("../validators/validator")
const bcrypt = require("bcrypt")
const {V3} = require("paseto");
const { emit } = require("nodemon");
const userRoute = express.Router()


userRoute.post("/register",async (req,resp)=>{
    try {
        if (! req.body.username || !req.body.password || !req.body.first_name || !req.body.last_name) {
            return resp.status(400).json({error : "missing fields", required_fields : [
                'first_name',"last_name","middle_name (opt)","email (opt)",'username',"password","phone (opt)"
            ]})
        }
        if (req.body._id) {
            return resp.status(400).json({error : "cannot insert _id"})
        }
        if (!isValidusername(req.body.username)) {
            return resp.status(400).json({error : "invalid username",requirements : [
                'must be atleast 2 charecters',
                'must contain alphabets',
                'can contain numbers . and _'
            ]})
        }
        if(req.body.email) {
            if (!validator.validate(req.body.email)) {
                return resp.status(400).json({error : "email not valid"})
            }
        }

        if (!isValidpassowrd(req.body.password.toString())) {
            return resp.status(400).json({error : "weak password",requirements : [
                'minimum 8 charecters',
                'contain Uppercase Lowercase letters , numbers , sspecial charecters'
            ]})
        }
        const existUser = await User.findOne({email : req.body.email})
        if (existUser) {
            return resp.status(400).json({error : "email already taken"})
        }
        const hashedval = await bcrypt.hash(req.body.password,10)
        req.body.password = hashedval
        const newuser = new User(req.body)
        const user =await newuser.save()
        return resp.status(200).json(user)
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }

})

userRoute.post("/login",async (req,resp)=>{
    try {
        if (!req.body.username || ! req.body.password || !req.body.location || !req.body.deviceId) {
            return resp.status(400).json({error : "missing fields",required_fields : ['username','password','location','deviceId']})
        }
        const user = await User.findOne({username : req.body.username})
        if (!user) {
            return resp.status(404).json({error : "username or password is wrong"})
        }
        const batches = await Batch.find({members : user._id.toString()})
        for (const batch of batches) {
            const auth = await new authLog({
                batchId : batch._id.toString(),
                userId : user._id.toString(),
                location : req.body.location,
                deviceId : req.body.deviceId,
                requestType : "logIn"
            })
            auth.save()
        }
        const validpassword = await bcrypt.compare(req.body.password,user.password)
        if (!validpassword) {
            return resp.status(404).json({error : "username or password is wrong"})
        }
        const tokenData = await V3.encrypt({id : user._id},process.env.secretKey)
        const token = await V3.sign({tokendata : tokenData},process.env.signPrivate)
        return resp.status(200).json({publicKey : process.env.publicKey,token : token})
    } catch(err) {
        console.log(err)
        return resp.status(400).json({error : err.toString()})
    }
})

userRoute.post("/edit",async (req,resp)=>{
    let token
    try {
        const authtoken = req.headers.authorization.split(" ")
        if(authtoken.length==2) {
            token = authtoken[1]
        }else {
            token = authtoken[0]
        }
        if (!token) {
            return resp.status(400).json({error : "nrequires autherization"})
        }
        const payload = await V3.verify(token.toString(),process.env.signPublic)
        const tokenData = await V3.decrypt(payload.tokendata,process.env.secretKey)
        if (!tokenData) {
            return resp.status(400).json({error : "token data maybe corrupted"})
        }
        if (!req.body || !req.body.email && !req.body.password && !req.body.first_name && !req.body.last_name
            && !req.body.middle_name && !req.body.phone && !req.body.username) {
            return resp.status(400).json({error : "missing fields",required_fields : [
                "email (opt)","password (opt)","first_name (opt)","last_name (opt)",
                "middle_name (opt)","phone (opt)" ,"username (opt)"
            ]})
        }
        if (req.body.email) {
            if (!validator.validate(req.body.email)) {
                return resp.status(400).json({error : "email not valid"})
            }
            if (await User.findOne({email : req.body.email})) {
                return resp.status(400).json({error : "email already taken"})
            }
        }
        if (req.body.username) {
            if (!isValidusername(req.body.username)) {
                return resp.status(400).json({error : "invalid username",requirements : [
                    'must be atleast 2 charecters',
                    'must contain alphabets',
                    'can contain numbers . and _'
                ]})
            }
            if (await User.findOne({username : req.body.username})) {
                return resp.status(400).json({error : "username already taken"})
            }
        }
        if (req.body.batches) {
            return resp.status(400).json({error : "cannot edit batches"})
        }
        if (req.body.password) {
            if (!isValidpassowrd(req.body.password)) {
                return resp.status(400).json({error : "weak password",requirements : [
                    'minimum 8 charecters',
                    'contain Uppercase Lowercase letters , numbers , sspecial charecters'
                ]})
            }
            req.body.password = await bcrypt.hash(req.body.password,10)
        }
        const user = await User.findById(tokenData.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        await user.updateOne({$set : req.body})
        return resp.status(200).json({msg : "user modified"})
    }
    catch(err) {
        return resp.json({error : err.toString()})
    }
})

userRoute.delete("/delete",async (req,resp)=>{
    let token
    try {
        const authtoken = req.headers.authorization.split(" ")
        if(authtoken.length==2) {
            token = authtoken[1]
        }else {
            token = authtoken[0]
        }
        if (!token) {
            return resp.status(400).json({error : "nrequires autherization"})
        }
        const payload = await V3.verify(token.toString(),process.env.signPublic)
        const tokenData = await V3.decrypt(payload.tokendata,process.env.secretKey)
        if (!tokenData) {
            return resp.status(400).json({error : "token data maybe corrupted"})
        }
        const user = await User.findById(tokenData.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        let batches = await Batch.find({members : user._id.toString()})
        const createdbatches = await Batch.find({owner : user._id.toString()})
        if (createdbatches.length>0) {
            return resp.status(400).json({error : "user deletion failed",msg : "you own one or more batches"})
        }
        const cocreatedbatches = await Batch.find({co_owners : user._id.toString()})
        batches.push(...createdbatches)
        batches.push(...cocreatedbatches)
        if(batches) {
            for (const batch of batches) {
                const batchitem = await Batch.findById(batch._id)
                if(batchitem.members.includes(user._id.toString())) {
                    await batchitem.updateOne({$pull : {members : user._id.toString()}})
                }
                if(batchitem.co_owners.includes(user._id.toString())) {
                    await batchitem.updateOne({$pull : {co_owners : user._id.toString()}})
                }
            }
        }
        const response = await fetch("http://localhost:5000/ml/delete",{
            method : 'POST',
            body : JSON.stringify({id : user._id.toString()})
        })
        if (response.status==400) {
            return resp.status(400).json({error : "user deletion failed",msg : "failed to delete face"})
        }
        await Attendance.deleteMany({userId : user._id.toString()})
        await authLog.deleteMany({userId : user._id.toString()})
        await user.deleteOne()
        return resp.status(200).json({msg : "user deleted"})
    }catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

userRoute.get("/info/:username",async(req,resp)=>{
    let token
    try {
        const authtoken = req.headers.authorization.split(" ")
        if(authtoken.length==2) {
            token = authtoken[1]
        }else {
            token = authtoken[0]
        }
        if (!token) {
            return resp.status(400).json({error : "nrequires autherization"})
        }
        const payload = await V3.verify(token.toString(),process.env.signPublic)
        const tokenData = await V3.decrypt(payload.tokendata,process.env.secretKey)
        if (!tokenData) {
            return resp.status(400).json({error : "token data maybe corrupted"})
        }
        const curr_user = await User.findById(tokenData.id)
        if (!curr_user) {
            return resp.status(404).json({error : "user not found"})
        }
        if (!req.params.username) {
            return resp.json({error : "missing argument",required_args :['username']})
        }
        const user = await User.findOne({username : req.params.username})
        if (!user) {
            return resp.status(404).json({error : "invalid username"})
        }
        return resp.status(200).json({first_name : user.first_name
        ,middle_name : user.middle_name,last_name : user.last_name,email : user.email,
        phone : user.phone})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
    
})

module.exports = userRoute