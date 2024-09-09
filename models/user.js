const mongoose = require('mongoose')
const passportLocalMongoose = require('passport-local-mongoose')

const DEFAULT_PROFILE_PICTURE = 'https://res.cloudinary.com/dnltrumxv/image/upload/v1725041443/Konnectus/tmvkfcg23qv8p5lckdkz.png'

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['Admin', 'Author', 'Reader'],
    },
    profilePicture: {
        type: String,
        default: DEFAULT_PROFILE_PICTURE
    }
})

userSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model('User', userSchema)