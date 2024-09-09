const mongoose = require('mongoose')

const authorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    bio: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postsCount: {
        type: Number,
        default: 0,
    },
    genres: [{
        type: String,
        default: [],
    }],
})

module.exports = mongoose.model('Author', authorSchema)