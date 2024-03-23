const mongoose = require('mongoose');
const { boolean } = require('zod');
const {Schema} = mongoose;

const userSchema = new Schema({
    username : {
        type: String,
        required: true,
        min : 4,
    },
    email: {
        type: String,
        required: true,
        unique : true,
    },
    password : {
        type: String,
        required: true,
        min: 6
    },
    verify:Boolean
})

const dsaSchema = new Schema({
    title: String,
    url: String,
    tags: String,
    difficulty: String,
    revisionCount: Number,
    author:{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
})

const userotpschema = new Schema({
    userId:String,
    otp:String,
    createdAt:Date,
    expireAt:Date
})

const Dsa = mongoose.model('Dsa',dsaSchema);
const User = mongoose.model('DsaRevisionUser',userSchema);
const userotp = mongoose.model("UserOtp",userotpschema);

module.exports = {Dsa,User,userotp};