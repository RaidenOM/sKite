if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const express = require('express')
const mongoose = require('mongoose')
const path = require('path')
const User = require('./models/user')
const passport = require('passport')
const localStrategy = require('passport-local')
const ejsMate = require('ejs-mate')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const Post = require('./models/post')
const Author = require('./models/author')
const Reader = require('./models/reader')
const Admin = require('./models/admin')
const Comment = require('./models/comment')
const methodOverride = require('method-override')
const multer = require('multer')
const { storage } = require('./cloudinary/index')
const upload = multer({ storage })
const catchAsync = require('./utilities/catchAsync')
const ExpressError = require('./utilities/ExpressError')
const { isLoggedIn, isPostOwner, isCommentOwner, isAuthor, isAuthorOrAdmin, validatePost, validateComment } = require('./middleware')
const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/skite'
const PORT = process.env.PORT || 3000;




mongoose.connect(dbUrl)
.then(() => {
    console.log('Connected to database')
})
.catch(err => {
    console.log('Error connecting to database')
});


const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret: 'thisshouldbeabettersecret!'
    }
});

const sessionConfig = {
    store,
    secret: 'thisisasecret', 
    resave: false, 
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 1000*60*60*24*7,
        maxAge: 1000*60*60*24*7,
        httpOnly: true
    }
}


const app = express()

app.use(session(sessionConfig))
app.use(flash())
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))

app.use(passport.initialize())
app.use(passport.session())
passport.use(new localStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())
app.use((req, res, next)=>{
    res.locals.currentUser = req.user
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    next()
})

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.engine('ejs', ejsMate)

//USER ROUTES
app.get('/', async (req, res) => {
    const posts = await Post.find({}).populate('author').sort({createdAt: -1}).limit(3)
    res.render('home', { posts })
})

app.get('/login', (req, res) => {
    res.render('users/login')
})

app.get('/register', (req, res) => {
    res.render('users/register')
})

app.get('/logout', (req, res) => {
    req.logout(function(err) {
        if(err) {
            next(err)
        }
        req.flash('success', 'GoodBye!')
        res.redirect('/')
    })
})

app.post('/login', passport.authenticate('local', {failureFlash: true, failureRedirect: '/login',}), (req, res) => {
    req.flash('success', 'Welcome back!')
    res.redirect('/posts')
})

app.post('/register', upload.single('profilePicture'), catchAsync(async (req, res) => {
    console.log(req.body)
    const { username, email, password, author, admin, reader, role } = req.body
    const user = new User({username, email, role})
    const registeredUser = await User.register(user, password)

    const profilePicture = req.file ? req.file.path : null;

    if(profilePicture) {
        registeredUser.profilePicture = profilePicture
    }

    await registeredUser.save()

    if(registeredUser.role === 'Author') {
        const authorData = new Author({name: author.name, userId: registeredUser.id, bio: author.bio})
        await authorData.save()
    }

    if(registeredUser.role === 'Reader') {
        const readerData = new Reader({name: reader.name, userId: registeredUser.id})
        await readerData.save()
    }

    if(registeredUser.role === 'Admin') {
        const adminData = new Admin({name: admin.name, userId: registeredUser.id})
        await adminData.save()
    }

    req.login(registeredUser, err => {
        if (err) {
            return res.status(500).json({ message: "Login failed after registration." }); 
        }
        req.flash('success', 'Welcome to sKite')
        res.redirect('/'); 
    });
}))

app.get('/profile', isLoggedIn, catchAsync(async (req, res) => {
    const user = req.user; // Get the logged-in user
    let userDetails;

    if (user.role === 'Admin') {
        userDetails = await Admin.findOne({ userId: user._id }).populate('userId');
    } else if (user.role === 'Author') {
        userDetails = await Author.findOne({ userId: user._id }).populate('userId');
    } else if (user.role === 'Reader') {
        userDetails = await Reader.findOne({ userId: user._id }).populate('userId');
    }

    res.render('users/profile', { userDetails });
}))

app.delete('/profile', isLoggedIn, catchAsync(async (req, res) => {
    const user = req.user
    let profile

    if(user.role === 'Admin') {
        profile = await Admin.findOne({userId: user.id})
    }else if(user.role === 'Reader') {
        profile = await Reader.findOne({userId: user.id})
    }else if(user.role === 'Author') {
        profile = await Author.findOne({userId: user.id})
        await Post.deleteMany({author: profile.id})
    }

    await Comment.deleteMany({userId: user.id})
    await profile.deleteOne()
    await user.deleteOne()

    req.flash('success', 'Profile deleted successfully')
    res.redirect('/')
}))


//BLOG ROUTS
app.get('/posts', catchAsync(async (req, res) => {
    const { category, sort, publishedAt } = req.query;
    
    let query

    if(category) {
        query = Post.find({categories: category})
    }else {
        query = Post.find()
    }

    // Add date filtering
    if (publishedAt) {
        const dateLimit = new Date();
        dateLimit.setMonth(dateLimit.getMonth() - publishedAt);
        query = query.where('createdAt').gte(dateLimit);
    }

    // Add sorting
    if (sort) {
        if (sort === 'latest') {
            query = query.sort({ createdAt: -1 });
        } else if (sort === 'oldest') {
            query = query.sort({ createdAt: 1 });
        } else if (sort === 'most_comments') {
            query = query.sort({ comments: -1 });
        }
    } else {
        query = query.sort({ createdAt: -1 }); // Default to latest
    }

    const posts = await query.populate({
        path: 'author',
        populate: {
            path: 'userId'
        }
    });

    res.render('posts/listPosts', { posts, selectedCategory: category, selectedSort: sort, selectedPublishedAt: publishedAt });
}));


app.get('/posts/new', isLoggedIn, isAuthor, (req, res) => {
    res.render('posts/createPost')
})

app.get('/posts/:id/edit', isLoggedIn, isAuthor, isPostOwner, catchAsync(async (req, res) => {
    const { id } = req.params
    const post = await Post.findById(id)
    res.render('posts/editPost', { post })
}))

app.get('/posts/:id', catchAsync(async (req, res) => {
    const { id } = req.params
    const post = await Post.findById(id).populate('author').populate({
        path: 'comments',
        populate: {
            path: 'userId'
        }
    })
    
    for(const comment of post.comments) {
        if(comment.userId.role === 'Reader') {
            const reader = await Reader.findOne({userId: comment.userId.id})
            comment.name = reader.name
        }else if(comment.userId.role === 'Author') {
            const author = await Author.findOne({userId: comment.userId.id})
            comment.name = author.name
        }else if(comment.userId.role === 'Admin') {
            const admin = await Admin.findOne({userId: comment.userId.id})
            comment.name = admin.name
        }
    }

    

    res.render('posts/showPost', { post })
}))

app.post('/posts', isLoggedIn, isAuthor, upload.single('post[image]'), validatePost, catchAsync(async (req, res) => {
    const { title, content, categories } = req.body.post
    const author = await Author.findOne({userId: req.user.id})
    const post = new Post({title, content, author: author.id, categories})

    const image = req.file ? req.file.path : null
    if(image) {
        post.image = image
    }

    //Update the author model
    author.postsCount = author.postsCount + 1
    categories.forEach(category => {
        if (!author.genres.includes(category)) {
            author.genres.push(category);
        }
    });
    await author.save()

    await post.save()

    req.flash('success', 'Successfully created a Blog!')
    res.redirect('/posts')
}))

app.put('/posts/:id', isLoggedIn, isAuthorOrAdmin, isPostOwner, upload.single('post[image]'), validatePost, catchAsync(async (req, res) => {
    const { id } = req.params
    const { title, content, categories } = req.body.post
    const author = await Author.findOne({userId: req.user.id})

    const updatedData = {title, content, categories}


    const image = req.file ? req.file.path : null
    if(image) {
        updatedData.image = image
    }

    //Update the author model
    categories.forEach(category => {
        if (!author.genres.includes(category)) {
            author.genres.push(category);
        }
    });

    await author.save()

    await Post.findByIdAndUpdate(id, updatedData)
    
    req.flash('success', 'Blog updated!')
    res.redirect(`/posts/${id}`)
}))

app.delete('/posts/:id', isLoggedIn, isAuthorOrAdmin, isPostOwner, catchAsync(async (req, res) => {
    const { id } = req.params
    await Post.findByIdAndDelete(id)

    req.flash('success', 'Blog deleted successfully!')
    res.redirect('/posts')
}))

//COMMENTS ROUTES
app.post('/posts/:id/comments', isLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params
    const { comment } = req.body.comment

    const post = await Post.findById(id)
    const newComment = new Comment({comment, userId: req.user.id})

    post.comments.push(newComment)

    await post.save()
    await newComment.save()

    res.redirect(`/posts/${id}`)
}))

app.delete('/posts/:id/comments/:commentId', isLoggedIn, isCommentOwner, catchAsync(async (req, res) => {
    const { id, commentId } = req.params
    await Post.findByIdAndUpdate(id, {$pull: {comments: commentId}})
    await Comment.findByIdAndDelete(commentId)
    res.redirect(`/posts/${id}`)
}))


//ROUTE TO HANLDE ANY REQUEST
app.all('*', (req, res, next)=>{
    next(new ExpressError('Page not found', 404))
})

//ERROR HANDLER
app.use((err, req, res, next) => {
    const { message, status=500 } = err
    if(!err.message) err.message = 'Something went wrong'
    res.status(status).render('error', { err })
})

module.exports = app