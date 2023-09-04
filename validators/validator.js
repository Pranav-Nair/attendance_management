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

module.exports={isValidpassowrd,isValidusername}