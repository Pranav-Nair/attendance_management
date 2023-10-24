const express = require("express")
const Batch = require("../models/batchmodel")
const {parseToken} = require("../validators/validator")
const {User,authLog} = require("../models/usermodel")
const Attendance = require("../models/attendancemodel")
const fs = require("fs")
const batchRoute = express.Router()

batchRoute.post("/create",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp)
        const user = await User.findById(data.id)
        let valid_co_owners = []
        let valid_members = []
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if (!req.body.batchname || !req.body.batchname.trim()) {
            return resp.json({error : "missing fields",required_fields : ['batchname','co_owners [] (opt)','members [](opt)']})
        }
        if (await Batch.findOne({name : req.body.batchname,owner : user._id})) {
            return resp.status(400).json({error : "batch already exists"})
        }
        if(req.body.co_owners) {
            const co_owners = req.body.co_owners
            for (const co_owner of co_owners) {
                const coOwner = await User.findOne({username : co_owner})
                if (!coOwner) {
                    return resp.status(400).json({error : "invalid co_owner",co_owner : co_owner})
                }
                if (user._id===coOwner._id) {
                    return resp.json({error : "already owner",co_owner : co_owner})
                }
                if (valid_co_owners.includes(coOwner._id)) {
                    return resp.status(400).json({error : "duplicate co_owner",co_owner : co_owner})
                }
                valid_co_owners.push(coOwner._id.toString())
            }
        }

        if(req.body.members) {
            const members = req.body.members
            for (const member of req.body.members) {
                const member_user =  await User.findOne({username : member})
                if (!member_user) {
                    return resp.status(400).json({error : "invalid co_owner",member : member})
                }
                if (valid_co_owners.includes(member_user._id)) {
                    return resp.status(400).json({error : "duplicate in co_owners",member : member})
                }
                if (valid_members.includes(member_user._id)) {
                    return resp.status(400).json({error : "duplicate in members",member : member})
                }
                if (user === member_user._id) {
                    return resp.status(400).json({error : "already owner",member : member})
                }
                valid_members.push(member_user._id.toString())

            }
        }
        const idgeners = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890"
        let short_id = ""
        do{
            for (let i=0;i<8;i++) {
                short_id+= idgeners.charAt(Math.floor(Math.random()*idgeners.length))
            }
        }
        while(await Batch.findOne({short_id : short_id}))
        const batch = await new Batch({
            name : req.body.batchname,
            owner : user._id,
            co_owners : valid_co_owners,
            members : valid_members,
            short_id : short_id
        })
        const newbatch = await batch.save()
        return resp.status(200).json({newbatch})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }

})

batchRoute.put("/join/:batchcode",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.params.batchcode) {
            return resp.status(400).json({error : "missing argument",required_args : ['batchcode']})
        }
        const batch = await Batch.findOne({short_id : req.params.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if(batch.owner===user._id) {
            return resp.status(400).json({error : "already in batch"})
        }
        if (batch.co_owners.includes(user._id)) {
            return resp.status(400).json({batchcode : batch.short_id,batchname : batch.name
            ,username : user.username,position : "co_owner",membership_status : "already joined"})
        }
        if (batch.members.includes(user._id)) {
            return resp.status(400).json({batchcode : batch.short_id,batchname : batch.name
                ,username : user.username,position : "member",membership_status : "already joined"})
        } else {
            await batch.updateOne({$push : {members : user._id.toString()}})
            return resp.json({batchcode : batch.short_id,batchname : batch.name
                ,username : user.username,position : "member",membership_status : "newly joined"})
        }
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.put("/leave/:batchcode",async(req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.params.batchcode) {
            return resp.status(400).json({error : "missing argument",required_args : ['batchcode']})
        }
        const batch = await Batch.findOne({short_id : req.params.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if(batch.owner===user._id) {
            return resp.status(400).json({error : "owner cannot leave batch"})
        }
        if (batch.co_owners.includes(user._id)) {
            batch.updateOne({$pull : {co_owners : user._id.toString()}})
            return resp.status(200).json({batchcode : batch.short_id,batchname : batch.name
            ,username : user.username,position : "co_owner",membership_status : "left"})
        }
        if (batch.members.includes(user._id)) {
            await batch.updateOne({$pull : {members : user._id.toString()}})
            return resp.status(200).json({batchcode : batch.short_id,batchname : batch.name
                ,username : user.username,position : "member",membership_status : "left"})
        } 
        return resp.status(400).json({error : "you are not in batch"})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.post("/add-users", async (req,resp)=>{
    try {
        let valid_members = []
        let valid_co_owners= []
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.batchcode) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','members (opt)','co_owners (opt)']})
        }
        if (!req.body.members && !req.body.co_owners) {
            return resp.status(400).json({error : "missing fields",required_fields : ['members (opt)','co_owners (opt)']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner!==user._id.toString() && !batch.co_owners.includes(user._id)) {
            return resp.status(400).json({error : "Permission denied",msg : "you need to be leader or co leader for doing this action"})
        }
        if(req.body.co_owners) {
            for (const co_owner of req.body.co_owners){
                const co_owner_user =  User.findOne({username : co_owner})
                if(!co_owner_user) {
                    return resp.status(404).json({error : "user not found",co_owner : co_owner})
                }
                if (batch.owner===co_owner_user._id) {
                    return resp.status(400).json({error : "already owner",co_owner:co_owner})
                }
                if(batch.co_owners.includes(co_owner_user._id) || valid_co_owners.includes(co_owner_user._id)) {
                    return resp.status(400).json({error : " duplicate co_owner",co_owner : co_owner})
                }
                if (batch.members.includes(co_owner_user._id) || valid_members.includes(co_owner_user._id)) {
                    return resp.status(400).json({error : "duplicate member",co_owner : co_owner})
                }
                valid_co_owners.push(co_owner_user._id.toString())
            }
        }
        if (req.body.members) {
            for (const member of req.body.members){
                const member_user = await User.findOne({username : member})
                if(!member_user) {
                    return resp.status(404).json({error : "user not found",co_owner : member})
                }
                if (batch.owner===member_user._id) {
                    return resp.status(400).json({error : "already owner",member:member})
                }
                if(batch.co_owners.includes(member_user._id) || valid_co_owners.includes(member_user._id)) {
                    return resp.status(400).json({error : " duplicate co_owner",member : member})
                }
                if (batch.members.includes(member_user._id) || valid_members.includes(member_user._id)) {
                    return resp.status(400).json({error : "duplicate member",member : member})
                }
                valid_members.push(member_user._id.toString())
            }
        }
        let res = await batch.updateOne({$push : {co_owners : {$each : valid_co_owners} ,members : {$each : valid_members}}})
        return resp.json({msg : "added users to batch",batchcode : batch.short_id,
    members_added : req.body.members,co_owners_added : req.body.co_owners})
    }
    catch(err) {
        console.log(err)
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.post("/del-users",async (req,resp)=>{
    try {
        let valid_members = []
        let valid_co_owners= []
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.batchcode) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','members (opt)','co_owners (opt)']})
        }
        if (!req.body.members && !req.body.co_owners) {
            return resp.status(400).json({error : "missing fields",required_fields : ['members (opt)','co_owners (opt)']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner!==user._id.toString() && !batch.co_owners.includes(user._id)) {
            return resp.status(400).json({error : "Permission denied",msg : "you need to be leader or co leader for doing this action"})
        }
        if(req.body.co_owners) {
            for (const co_owner of req.body.co_owners){
                const co_owner_user =await User.findOne({username : co_owner})
                if(!co_owner_user) {
                    return resp.status(404).json({error : "user not found",co_owner : co_owner})
                }
                if(!batch.co_owners.includes(co_owner_user._id)) {
                    return resp.status(404).json({error : " co_owner not found",co_owner : co_owner})
                }
                if (valid_members.includes(co_owner_user._id)) {
                    return resp.status(400).json({error : "duplicate co_owner",co_owner : co_owner})
                }
                valid_co_owners.push(co_owner_user._id.toString())
            }
        }
        if (req.body.members) {
            for(const member of req.body.members){
                const member_user = await User.findOne({username : member})
                if(!member_user) {
                    return resp.status(404).json({error : "user not found",co_owner : member})
                }
                if (!batch.members.includes(member_user._id)) {
                    return resp.status(404).json({error : "member not found",member : member})
                }
                if (valid_members.includes(member_user)) {
                    return resp.status(400).json({error : "duplicate member",member : member})
                }
                valid_members.push(member_user._id.toString())
            }
        }
        await batch.updateOne({$pull : {co_owners :{$in :valid_co_owners } ,members :{$in :valid_members } }})
        return resp.json({msg : "removed users to batch",batchcode : batch.short_id,
    members_removed : req.body.members,co_owners_removed : req.body.co_owners})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.post("/edit",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.batchcode || !req.body.batchname || !req.body.batchname.trim() || !req.body.batchcode.trim()) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','batchname']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner!==user._id.toString() && !batch.co_owners.includes(user._id)) {
            return resp.status(400).json({error : "Permission denied",msg : "you need to be owner or co_owner to do this action"})
        }
        await batch.updateOne({$set : {name : req.body.batchname}})
        return resp.json({batch_new_name : req.body.batchname,batchcode : req.body.batchcode})
    }
    catch(err) {
        return resp.status(400).json({error :err.toString()})
    }
})

batchRoute.post("/ping",async (req,resp)=>{
    try {
        let pinged_batches =[]
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.deviceId || !req.body.location) {
            return resp.status(400).json({error : "missing fields",required_fields : ['deviceId',
        'location']})
        }
        const batches = await Batch.find({members : user._id.toString()})
        if (!batches) {
            return resp.status(404).json({error : "batches not found"})
        }
        for (const batch of batches) {
            const ping = await new authLog({
                userId : user._id.toString(),
                batchId : batch._id.toString(),
                location : req.body.location,
                deviceId : req.body.deviceId,
                requestType : "Ping"
            })
            await ping.save()
            pinged_batches.push(batch.short_id)
        }
        return resp.json({msg : "ping successfull",batches : pinged_batches})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.post("/promote",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.batchcode || !req.body.username) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','username']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        const promotion_user = await User.findOne({username : req.body.username})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner!==user._id.toString()) {
            return resp.status(400).json({error : "Permission denies",msg : "you need to be owner to perform this action"})
        }
        if (!promotion_user) {
            return resp.status(400).json({error : "username is invalid"})
        }
        if (!batch.members.includes(promotion_user._id) && !batch.co_owners.includes(promotion_user._id)) {
            return resp.status(400).json({error : "user must be member or co_owner of batch"})
        }
        if (batch.members.includes(promotion_user._id)) {
            await batch.updateOne({$pull : {members : promotion_user._id.toString()}})
            await batch.updateOne({$push : {co_owners : promotion_user._id.toString()}})
            return resp.json({msg : "user promoted",username : req.body.username,old_position : "member",
        new_position : "co_owner"})
        }
        if (batch.co_owners.includes(promotion_user._id)) {
            await batch.updateOne({$pull : {co_owners : promotion_user._id}})
            await batch.updateOne({$set : {owner : promotion_user._id}})
            await batch.updateOne({$push : {co_owners : user._id}})
            return resp.json({msg : "user promoted",username : req.body.username,old_position : "co_owner",
            new_position : "owner"})
        }
    }
    catch(err) {
        console.log(err)
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.post("/demote", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.batchcode || !req.body.username) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode','username']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        const demotion_user = await User.findOne({username : req.body.username})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner!==user._id.toString()) {
            return resp.status(400).json({error : "Permission denies",msg : "you need to be owner to perform this action"})
        }
        if (!demotion_user) {
            return resp.status(400).json({error : "username is invalid"})
        }
        if (!batch.co_owners.includes(demotion_user._id)) {
            return resp.status(400).json({error : "user must be member or co_owner of batch"})
        }
        await batch.updateOne({$pull : {co_owners : demotion_user._id.toString()}})
        await batch.updateOne({$push : {members : demotion_user._id.toString()}})
        return resp.json({msg : "user demoted",old_postion : "co_owner",new_position : "member",username : req.body.username
    ,batchcode : req.body.batchcode})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.post("/delete", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.batchcode) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        if (batch.owner!==user._id.toString()) {
            return resp.status(400).json({error : "Permission denies",msg : "you need to be owner to perform this action"})
        }
        let response = await fetch(process.env.pyfaceURi+"/analytics/purge",{
            method : "POST",
            headers : {
                'Content-Type': 'application/json'
            },
            body : JSON.stringify({batchId : batch._id.toString()})
        })
        if( response.status == 400) {
            response = await response.json()
            return resp.json(response)
        }
        if (fs.existsSync("graphs/"+batch._id.toString())) {
            fs.rmSync("graphs/"+batch._id.toString(),{recursive : true})
        }
        await authLog.deleteMany({batchId : batch._id.toString()})
        await Attendance.deleteMany({batchId : batch._id.toString()})
        await batch.deleteOne()
        return resp.json({msg : "batch deleted"})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.post("/details",async (req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        let members= []
        let co_owners = []
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        if(!req.body.batchcode) {
            return resp.status(400).json({error : "missing fields",required_fields : ['batchcode']})
        }
        const batch = await Batch.findOne({short_id : req.body.batchcode})
        if (!batch) {
            return resp.status(404).json({error : "batch not found"})
        }
        for (const member of batch.members) {
            const member_user = await User.findById(member)
            members.push(member_user.username.toString())
        }
        for (const co_owner of batch.co_owners) {
            const co_owner_user = await User.findById(co_owner)
            co_owners.push(co_owner_user.username.toString())
        }
        const owner = await User.findById(batch.owner)
        return resp.json({batchname : batch.name,batchcode : batch.short_id,members : members,co_owners : co_owners,owner : owner.username})
    }
    catch(err) {
        return resp.status(400).json({error : err.toString()})
    }
})

batchRoute.get("/list/", async (req,resp)=>{
    try {
        const data = await parseToken(req,resp) 
        const user = await User.findById(data.id)
        let member_batches =[]
        let co_owned_batches = []
        let owned_batches = []
        if (!user) {
            return resp.status(404).json({error : "user not found"})
        }
        const member_batches_raw = await Batch.find({members : user._id.toString()})
        const co_owned_batches_raw = await Batch.find({co_owners : user._id.toString()})
        const owned_batches_raw = await Batch.find({owner : user._id.toString()})
        for (const batch of member_batches_raw) {
            member_batches.push(batch.short_id)
        }
        for (const batch of co_owned_batches_raw) {
            co_owned_batches.push(batch.short_id)
        }
        for (const batch of owned_batches_raw) {
            owned_batches.push(batch.short_id)
        }
        if (!member_batches.length>0 && !co_owned_batches.length>0 && !owned_batches.length>0) {
            return resp.status(404).json({error : "batches not found"})
        }
        return resp.json({member_batches : member_batches,co_owned_batches : co_owned_batches,owned_batches : owned_batches})
    }
    catch(err) {
        return resp.json({error : err.toString()})
    }
})

module.exports = batchRoute