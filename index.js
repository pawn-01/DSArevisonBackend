const express = require('express');
const mongoose = require('mongoose');
const zod = require('zod');
const {Dsa, User, userotp} = require('./db');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const authMiddleware = require('./authMiddleware');
const nodemailer = require("nodemailer");
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service:'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
        user:process.env.EMAIL,
        pass:process.env.Pass
    }
});

const app = express();
app.use(express.json());

const corsOptions ={
    origin:`${process.env.Frontend_URL}`, 
    credentials:true,      
    methods:['GET','POST','PUT','DELETE']
}


app.use(cors(corsOptions));

const userSchema = zod.object({
    username : zod.string().min(1),
    email : zod.string().email().min(1),
    password : zod.string().min(6)
})

const salt = bcrypt.genSaltSync(10);


mongoose.connect(process.env.DATABASE_URL)
    .then(()=> {
        console.log("connected to mongodb");
    })
    .catch((err) => {
        console.log("can't connect to mongodb",err);
    })

app.post('/signup', async function(req, res, next){
    try{
        const {username,email,password} = req.body;
        const result =  userSchema.safeParse(req.body);
        if(!result.success){
            return res.json({msg: "invalid credentials",a:0});
        }
    
        const newUser = await new User({
            username,
            email,
            password :bcrypt.hashSync(password,salt),
            verify:false,
        })
        await newUser.save();
    
        return res.json({msg:"signup successful",a:1});
    }
    catch(err){
       // console.log("error while signing up",err);
        return res.json({msg:"you have an account so login",a:0});
    }
})

app.post('/login', async function(req, res, next){
    try{
        const userSchema = zod.object({
            email : zod.string().email(),
            password : zod.string()
        })

        const {email,password} = req.body;
        const result = userSchema.safeParse(req.body);
        if(!result.success){
            return res.json({msg: "invalid credentials",a:0});
        }

        const user = await User.findOne({email});
        if(!user) return res.json({msg: "user not found",a:0});

        const passwordVerify = bcrypt.compareSync(password,user.password);

        if(!passwordVerify) return res.json({msg: "Incorrect password",a:0});

        const token = jwt.sign({username:user.username,email,id:user._id},process.env.JWT_SECRET_KEY);
        console.log("token is here:",token);

        if(!user.verify){
        const otp = `${Math.floor(1000 + Math.random()*9000)}`;

        const mailoption = {
             from:{
                name:"Revision Labs",
                address:process.env.EMAIL
            },
             to:email,
             subject:"Verify  your Email",
             html:`<p>Enter your otp <b>${otp}</b> to verify your email address and complete</p><p>This otp expires in 10min </p>`
        }
       
        const hasedotp = await bcrypt.hash(otp,salt);
        await userotp.deleteMany({userId:user._id});

        await userotp.create({
            userId:user._id,
            otp:hasedotp,
            createdAt:Date.now(),
            expireAt:Date.now()+600000,
        })

        await transporter.sendMail(mailoption);
        }

        return res.json({msg: "login successful",token:token,a:1,user:{id:user._id,name:user.username}});
    }
    catch(err){
        console.log("error while login", err);
        return res.json({msg:"error while login",err,a:0});
    }
} )

app.post('/add',authMiddleware, async function(req,res,next){
    try{
        const {title,url,tags,difficulty} = req.body;
        const question = zod.object({
               title:zod.string().min(1),
               url:zod.string().url(),
               tags:zod.string().min(1),
               difficulty:zod.string().min(4)
            })
        
        //if the user is authenticated add question
        if(!question.safeParse(req.body).success){
            return res.json({message:"Please fill envery column correctly and check url is correct",a:0})
        }
        const decodedData = req.user;
        console.log("decoded data:",decodedData);

        const addquestion = await Dsa.create({
            title,
            url,
            tags,
            difficulty,
            revisionCount: 0,
            author: decodedData.id,
        })

        return res.json({msg:"question added successfully",a:1,addquestion});
    }
    catch(err){
        console.log("error while adding question",err);
        return res.json({msg:"error while adding question",a:-1,err});
    }
});

app.get('/list',authMiddleware, async function(req,res,next){
    try{

        var filter = req.query.value;
        filter = filter.charAt(0).toUpperCase() + filter.slice(1);
        const decodedData = req.user;
        console.log("filter is "+filter);
        let list;

        if(filter.startsWith("Tags: ")){
            filter = filter.split(" ")[1].charAt(0).toUpperCase() + filter.split(" ")[1].slice(1);
            console.log("filter is "+filter);
             list = await Dsa.find({author: decodedData.id,tags:{"$regex": filter}}).sort({revisionCount:1});
        }
        else{
            console.log("hi")
           list = await Dsa.find({author: decodedData.id,title:{"$regex": filter}}).sort({revisionCount:1});
       // if(!list || list.length==0) return res.json({msg: "cant find question list",a:0});
        }

        return res.json({msg:"question list fetched successfully",a:1,list});
    }
    catch(err){
        console.log("error at /list endpoint",err);
        return res.json({msg:"error at /list endpoint",a:0});
    }
})

app.post('/countupdate/:id', authMiddleware, async (req, res) => {
    try{
        const {id} = req.params;
        const updateCount = await Dsa.updateOne(
            {_id:id},
            { $inc: { revisionCount: 1 }
        })
        if (!updateCount) {
            return res.status(404).json({ error: 'Question not found' ,a:0});
        }
        return res.status(200).json({ message: 'RevisionCount updated successfully' ,a:1});
    }
    catch(err){
        console.error('Error updating revision count:', err);
        return res.status(400).json({ msg: 'error while incresing count',a:0 ,error: err });
    }
    
})

app.delete("/delete/:id",authMiddleware, async(req,res)=>{
     try{
         const decodedData = req.user;
         const { id } = req.params;
         await Dsa.deleteOne({_id:id,author:decodedData.id});
         res.json({a:1});
     }
     catch(e){
        console.log(e);
        res.status(400).json({e});
     }
})

app.delete('/deleteAll',authMiddleware,async(req,res)=>{
     try{
        const decodedData = req.user;
        await Dsa.deleteMany({author:decodedData.id});
        res.json({a:1});        
     }
     catch(e){
        res.status(400).json({e})
     }
})

app.post('/profile',authMiddleware,async(req,res)=>{
         try{
            const decodedData = req.user;
            res.json({user:decodedData,a:1});
         }
         catch(e){
            console.log(e);
            res.status(400).json({e});
         }
})

app.post('/verify',authMiddleware,async(req,res)=>{
    console.log("id hai" + req.user.id);
    try{
     const userdoc = await User.find({email:req.user.email})
     console.log("verify kro "+ userdoc[0].verify);

     if(userdoc[0].verify){
         res.json({username:userdoc[0].username,a:1});
     }
     else{
        res.json({a:0})
     }
    }
    catch(e){

    }
})

app.post('/otpsend',authMiddleware,async(req,res)=>{
    try{
        console.log("verify "+req.user.email)
        const otp = `${Math.floor(1000 + Math.random()*9000)}`;

        const mailoption = {
             from:{
                name:"Revison Labs",
                address:process.env.EMAIL
            },
             to:req.user.email,
             subject:"Verify  your Email",
             html:`<p>Enter your otp <b>${otp}</b> to verify your email address and complete</p><p>This otp expires in 10min </p>`
        }
       
        const hasedotp = await bcrypt.hash(otp,salt);
        await userotp.deleteMany({userId:req.user.id});

        await userotp.create({
            userId:req.user.id,
            otp:hasedotp,
            createdAt:Date.now(),
            expireAt:Date.now()+600000,
        })

        await transporter.sendMail(mailoption);

        res.json({msg:"otp send check your mail ", a:1})
    }
    catch(e){
        console.log(e)
        res.status(400).json({msg:"some issue on server",e})
    }
    
})

app.post('/verifyotp',authMiddleware,async(req,res)=>{
     console.log("id" + req.user.id);
      try{
         const { otp } = req.body;
         if(!otp){
            return res.json({msg:"Plese fill the otp ",a:0});
         }
         
         const userotpdoc = await userotp.find({
            userId:req.user.id
         })

         if(userotpdoc.length <= 0){
             return res.json({msg:"Account record does not exist.plese go to sin up or login page",a:0})
         }
         
         const {expireAt} = userotpdoc[0];
         const hasedotp = userotpdoc[0].otp;

         if(expireAt < Date.now()){
              res.json({msg:"code expire click on resend",a:0});
         }
         else{
            const validotp = await bcrypt.compare(otp,hasedotp);
            if(!validotp){
                  return res.json({msg:"otp is not valid" , a:0});
            }
            else{
                const a = await User.updateOne({ _id:req.user.id,email:req.user.email},{ $set: { verify:true }});

                console.log(a);
                await userotp.deleteMany({userId:req.user.id});

                return res.json({msg:"verifed",a:1});
            }
         }
      }
      catch(e){
        console.log(e);
        res.status(400).json({e,msg:"server issue"});
      }
})

app.listen(4000);