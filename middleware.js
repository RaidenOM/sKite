const Admin = require('./models/admin')
const Reader = require('./models/reader')
const Author = require('./models/author')
const Comment = require('./models/comment')
const Post = require('./models/post')
const Joi = require('joi')
const ExpressError = require('./utilities/ExpressError')

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl
        req.flash('error', 'You must be signed in to complete this action')
        return res.redirect('/login')
    }
    next()
}

module.exports.isAuthorOrAdmin = (req, res, next) => {
    if (req.user.role === 'Admin') next()
    else {
        if (req.user.role !== 'Author') {
            req.flash('error', 'You do not have permissions to do this')
            res.redirect(req.originalUrl)
        }
        next()
    }
}

module.exports.isAuthor = (req, res, next) => {
    if (req.user.role !== 'Author') {
        req.flash('error', 'You do not have permissions to do this')
        return res.redirect(req.originalUrl)
    }
    next()
}

module.exports.isPostOwner = async (req, res, next) => {
    if (req.user.role === 'Admin') {
        return next()
    } else {
        const { id } = req.params
        const post = await Post.findById(id).populate('author')
        if (!post.author.userId.equals(req.user._id)) {
            req.flash('error', 'You do not own this post')
            return res.redirect(`/post/${id}`)
        }
        return next()
    }

}

module.exports.isCommentOwner = async (req, res, next) => {
    if (req.user.role === 'Admin') return next()
    else {
        const { id, commentId } = req.params
        const comment = await Comment.findById(commentId)
        if (!comment.userId.equals(req.user._id)) {
            req.flash('error', 'You do not own this comment')
            return res.redirect(`/posts/${id}`)
        }
        return next()
    }
}

module.exports.validatePost = (req, res, next) => {
    const postSchema = Joi.object({
        post: Joi.object({
            title: Joi.string().required(),
            content: Joi.string().required(),
            categories: Joi.array().items(Joi.string()).optional(),
            image: Joi.string().optional(),
            comments: Joi.array().items(Joi.string()).optional(),
            createdAt: Joi.date().optional()
        }).required()
    }).required()

    const { error } = postSchema.validate(req.body)

    if(error) {
        const message = error.details.map(e => e.message).join(',')
        throw new ExpressError(message, 400)
    }else {
        next()
    }
}

module.exports.validateComment = (req, res, next) => {
    const commentSchema = Joi.object({
        comment: Joi.object({
            comment: Joi.string().required()
        }).required()
    }).required()
}