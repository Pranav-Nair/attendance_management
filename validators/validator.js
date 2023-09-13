const {V3} = require("paseto")
const isValidpassowrd = (password) =>{
    let valid = true
    const alphabets_low =/[a-z]+/
    const alphabets_upper = /[A-Z]+/
    const digits = /[0-9]+/
    const specials = /\W+/
    if (password.length < 8) {
        console.log("hello")
        valid = false
    }
    if (!alphabets_low.test(password || !alphabets_upper.test(password))) {
        console.log("alpahbets")
        valid = false
    }
    if (!digits.test(password)) {
        valid = false
    }
    if (!specials.test(password)) {
        valid = false
    }
    return valid
}

const isValidusername = (username)=> {
    let valid = true
    let alaphabets = /[a-zA-Z]+/
    let all_specials =/\W+/g
    let allowed_specials = /[\._]/
    if (username.length<2) {
        valid=false
    }
    if (!alaphabets.test(username)) {
        valid=false
    }
    let specials =Array.from(username.matchAll(all_specials)) 
    specials.forEach(special => {
        if (!allowed_specials.test(special)) {
            valid=false
        }
    })
    return valid
}

const parseToken =async(req,resp)=>{
    if (!req.headers.authorization) {
        return resp.status(400).json({error : "missing authorization token"})
    }
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
        return tokenData
}

const isvalidDate = (date)=>{
    let valid = true
    const date_pattern = /(\d{4})-(\d{2})-(\d{2})/
    if (!date_pattern.test(date)) {
        valid = false
        return valid
    }
    let matches = date.match(date_pattern)
    if (Number(matches[2]) > 12 || Number(matches[2]) < 1) {
        valid = false
    }
    if (Number(matches[3]) > 31 || Number(matches[3]) < 1) {
        valid = false
    }
    return valid
}

module.exports={isValidpassowrd,isValidusername,parseToken,isvalidDate}