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
        if (!req.body.username || ! req.body.password) {
            return resp.status(400).json({error : "missing fields",required_fields : ['username','password']})
        }
        const user = await User.findOne({username : req.body.username})
        if (!user) {
            return resp.status(404).json({error : "username or password is wrong"})
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
        let batches = await Batch.find({members : user._id})
        const createdbatches = await Batch.find({owner : user._id})
        const cocreatedbatches = await Batch.find({co_owners : user._id})
        batches.push(...createdbatches)
        batches.push(...cocreatedbatches)
        if(batches) {
            batches.forEach(batch => {
                authLog.deleteMany({userId : user._id,batchId : batch._id})
                const batchitem = Batch.findById(batch._id)
                if(batchitem.members.includes(user._id)) {
                    Attendance.deleteMany({batchId : batch._id,userId : user._id})
                    batchitem.updateOne({$pull : {members : user._id}})
                }
                if(batchitem.co_owners.includes(user._id)) {
                    batchitem.updateOne({$pull : {co_owners : user._id}})
                }
                if(batchitem.owner==user._id) {
                    console.log("safe delete")
                }
            })
        }

        await user.deleteOne()
        return resp.status(200).json({msg : "user deleted"})
    }catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

userRoute.get("/info",async(req,resp)=>{
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
        return resp.status(200).json({first_name : user.first_name
        ,middle_name : user.middle_name,last_name : user.last_name,email : user.email,
        phone : user.phone})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
    
})

module.exports = userRoute