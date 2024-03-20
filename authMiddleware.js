const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = async function(req,res,next){
    try{
        const {token} = req.headers;
        console.log("from middleware, token is here :",token);

        if(!token || token=='') return res.json({msg: 'invalid token', a:0});

        const decode = jwt.verify(token,process.env.JWT_SECRET_KEY);
        console.log(decode);
        req.user = decode;
        
        next();
    }
    catch(err){
        console.log("error from middleware", err);
    }
}

module.exports = authMiddleware