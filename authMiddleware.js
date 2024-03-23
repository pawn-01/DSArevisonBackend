const jwt = require('jsonwebtoken');
const { User } = require('./db');
require('dotenv').config();

const authMiddleware = async function(req,res,next){
    try{
        const {token} = req.headers;
       
        //console.log("from middleware, token is here :",token);

        if(!token || token=='') return res.json({msg: 'invalid token', a:0});

        const decode = jwt.verify(token,process.env.JWT_SECRET_KEY);
        const user = await User.find({email:decode.email});
        console.log("user len "+user.length);
        if(user.length<=0){
           return res.json({msg:"user not exist" , a:0});
        }
        console.log(decode);
        req.user = decode;
        
        next();
    }
    catch(err){
        console.log("error from middleware", err);
    }
}

module.exports = authMiddleware