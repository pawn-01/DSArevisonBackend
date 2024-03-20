const express = require('express');
const mongoose = require('mongoose');
const zod = require('zod');
const {Dsa, User} = require('./db');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const authMiddleware = require('./authMiddleware');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const userSchema = zod.object({
    username : zod.string().min(1),
    email : zod.string().email().min(1),
    password : zod.string().min(6)
})

const jwtSecretKey = "hggfdgffxfdgrs77888";
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

        const token = jwt.sign({username:user.username,id:user._id},process.env.JWT_SECRET_KEY);
        console.log("token is here:",token);

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


app.listen(3000);