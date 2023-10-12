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
        if (!req.body.username || !req.body.password || !req.body.first_name || !req.body.last_name) {
            return resp.status(400).json({error : "missing fields", required_fields : [
                'first_name',"last_name","middle_name (opt)","email (opt)",'username',"password","phone (opt)","country_code (opt)"
            ]})
        }
        if (!req.body.first_name.trim() || !req.body.last_name.trim()) {
            return resp.status(400).json({error : "empty fields",msg : ["first_name","last_name"]})
        }
        if (req.body.phone) {
            if (!req.body.country_code) {
                return resp.status(400).json({error : "phone number must be included with country_code"})
            }
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
        if (await User.findOne({username : req.body.username})) {
            return resp.status(400).json({error : "username already taken"})
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
        if (req.body.email) {
            const existUser = await User.findOne({email : req.body.email})
            if (existUser) {
                return resp.status(400).json({error : "email already taken"})
            }
        }
        if (req.body.phone) {
            const existphone = await User.findOne({phone : req.body.phone,country_code : req.body.country_code})
            if (existphone) {
                return resp.status(400).json({error : "phone number already taken"})
            }
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
            await auth.save()
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
        if (!req.body || !req.body.email && !req.body.password && !req.body.first_name && !req.body.last_name && 
            !req.body.middle_name && !req.body.phone && !req.body.username) {
            return resp.status(400).json({error : "missing fields",required_fields : [
                "email (opt)","password (opt)","first_name (opt)","last_name (opt)",
                "middle_name (opt)","phone (opt)" ,"username (opt)"
            ]})
        }
        if ((req.body.middle_name && req.body.middle_name!==-1 &&!req.body.middle_name.trim()) || (req.body.first_name && !req.body.first_name.trim()) ||
        (req.body.last_name && !req.body.last_name.trim())) {
            return resp.status(400).json({error : "empty fileds"})
        }
        if (req.body._id) {
            return resp.status(400).json({error : "cannot edit _id"})
        }
        if (req.body.email && req.body.email!==-1) {
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
        if (req.body.phone===-1) {
            let unset = {phone : user.phone,country_code : user.country_code}
            await user.updateOne({$unset : unset})
            delete req.body.phone
            delete req.body.country_code
        }
        if (req.body.phone) {
            let cc = user.country_code
            if (req.body.country_code) {
                cc = req.body.country_code
            }
            if (!cc) {
                return resp.status(400).json({error : "phone number must be accompanied by country code"})
            }
            if (await User.findOne({phone : req.body.phone,country_code :cc })) {
                return resp.status(400).json({error : "phone number and country code combination in use"})
            }
        }
        if (req.body.email===-1) {
            delete req.body.email
            await user.updateOne({$unset : {email : user.email}})
        }
        if (req.body.middle_name===-1) {
            delete req.body.middle_name
            await user.updateOne({$unset:{middle_name : user.middle_name}})
        }
        await user.updateOne({$set : req.body})
        return resp.status(200).json({msg : "user modified"})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
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
        const response = await fetch(process.env.pyfaceURi+"/ml/delete",{
            method : 'POST',
            headers : {
                "Content-Type":"application/json"
            },
            body : JSON.stringify({id : user._id.toString()})
        })
        if (response.status==400) {
            console.log(await response.json())
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
        country_code : user.country_code,phone : user.phone,username : user.username})
    }
    catch(err) {
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
        country_code : user.country_code,phone : user.phone,username : user.username})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
    
})

module.exports = userRoute