const mongoose = require('mongoose')

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Author',
        required: true
    },
    categories: {
        type: [String],
        required: true,
        default: ['Others']
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
    }],
    createdAt: {
        type: Date,
        default: Date.now()
    }
})

postSchema.statics.predefinedCategories = [
    'Technology',
    'Lifestyle',
    'Education',
    'Entertainment',
    'Travel',
    'Business',
    'Food',
    'Gaming',
    'Fashion',
    'Home and Garden'
];

module.exports = mongoose.model('Post', postSchema)