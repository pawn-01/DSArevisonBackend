const mongoose = require('mongoose');
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
    }
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

const Dsa = mongoose.model('Dsa',dsaSchema);
const User = mongoose.model('DsaRevisionUser',userSchema);

module.exports = {Dsa,User};