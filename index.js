const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

// Cloudinary configuration
cloudinary.config({
    cloud_name: 'dyiuob93s',
    api_key: '292354667865257',
    api_secret: 'VEvPK79lAIhrjfYW71BwtClzgXM'
});

// Verify Cloudinary configuration
console.log('Cloudinary Configuration:', {
    cloud_name: cloudinary.config().cloud_name,
    api_key: cloudinary.config().api_key
});

const app = express();

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

const url = 'mongodb+srv://vaishnavpv29:vaishnav2005@cluster0.t66ej.mongodb.net/BlogApp';
;

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    profileImage: { type: String },
    interests: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

// Blog Schema
const BlogSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    blogUrl: { type: String, required: true },
    userEmail: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Blog = mongoose.model('Blog', BlogSchema);

app.post('/register', async(req, res) => {
    const { username, email, phone, password } = req.body;
    
    try {
        // Check if username already exists
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new user
        const newUser = new User({
            username,
            email,
            phone,
            password: hashedPassword
        });
        
        await newUser.save();
        res.status(200).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Registration failed' });
    }
})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Send user info (excluding password)
        res.json({
            id: user._id,
            email: user.email,
            username: user.username
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/blogs/create', upload.single('image'), async (req, res) => {
    try {
        const { name, description, blogUrl, userEmail } = req.body;
        
        if (!userEmail) {
            return res.status(400).json({ message: 'User email is required' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Image is required' });
        }

        const imageUrl = `http://localhost:4000/uploads/${req.file.filename}`;

        const newBlog = new Blog({
            name,
            description,
            imageUrl,
            blogUrl,
            userEmail
        });

        await newBlog.save();
        res.status(201).json({ message: 'Blog created successfully', blog: newBlog });
    } catch (error) {
        console.error('Error creating blog:', error);
        res.status(500).json({ message: 'Error creating blog' });
    }
});

app.get('/blogs/recent', async (req, res) => {
    try {
        const blogs = await Blog.find()
            .sort({ createdAt: -1 });
        res.json(blogs);
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({ message: 'Error fetching blogs' });
    }
});

app.get('/blogs/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const blogs = await Blog.find({ userEmail: email })
            .sort({ createdAt: -1 });
        res.json(blogs);
    } catch (error) {
        console.error('Error fetching user blogs:', error);
        res.status(500).json({ message: 'Error fetching user blogs' });
    }
});

app.put('/blogs/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, description, blogUrl, userEmail } = req.body;
        const blogId = req.params.id;

        // Check if blog exists and belongs to user
        const blog = await Blog.findOne({ _id: blogId, userEmail });
        if (!blog) {
            return res.status(404).json({ message: 'Blog not found or unauthorized' });
        }

        const updateData = {
            name,
            description,
            blogUrl
        };

        if (req.file) {
            updateData.imageUrl = `http://localhost:4000/uploads/${req.file.filename}`;
        }

        const updatedBlog = await Blog.findByIdAndUpdate(
            blogId,
            updateData,
            { new: true }
        );

        res.json({ message: 'Blog updated successfully', blog: updatedBlog });
    } catch (error) {
        console.error('Error updating blog:', error);
        res.status(500).json({ message: 'Error updating blog' });
    }
});

app.delete('/blogs/delete-multiple', async (req, res) => {
    try {
        const { blogIds, userEmail } = req.body;
        
        if (!blogIds || !Array.isArray(blogIds) || !userEmail) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        // Verify ownership of all blogs
        const blogs = await Blog.find({ _id: { $in: blogIds } });
        const unauthorized = blogs.some(blog => blog.userEmail !== userEmail);
        
        if (unauthorized) {
            return res.status(403).json({ message: 'Unauthorized to delete some blogs' });
        }

        await Blog.deleteMany({ _id: { $in: blogIds }, userEmail });
        res.json({ message: 'Blogs deleted successfully' });
    } catch (error) {
        console.error('Error deleting blogs:', error);
        res.status(500).json({ message: 'Error deleting blogs' });
    }
});

// Get user profile endpoint
app.get('/profile/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const user = await User.findOne({ email }).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        console.log(user);  
        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// Update user profile endpoint
app.put('/profile/update', upload.single('profileImage'), async (req, res) => {
    try {
        const { email, interests } = req.body;
        
        const updateData = {
            interests: interests ? JSON.parse(interests) : []
        };

        if (req.file) {
            try {
                // Ensure file exists and is readable
                await fs.promises.access(req.file.path);
                console.log('File exists and is readable:', req.file.path);
                
                // Log file details
                const stats = await fs.promises.stat(req.file.path);
                console.log('File size:', stats.size, 'bytes');
                
                // Upload to Cloudinary with explicit error handling
                const uploadOptions = {
                    folder: 'profile_images',
                    width: 500,
                    height: 500,
                    crop: 'fill',
                    gravity: 'face',
                    resource_type: 'auto'
                };
                
                console.log('Attempting Cloudinary upload with options:', uploadOptions);
                
                const result = await cloudinary.uploader.upload(req.file.path, uploadOptions);
                
                if (!result || !result.secure_url) {
                    throw new Error('Cloudinary upload failed to return secure URL');
                }

                console.log('Cloudinary upload successful:', {
                    url: result.secure_url,
                    public_id: result.public_id
                });

                // Add Cloudinary URL to updateData
                updateData.profileImage = result.secure_url;

                // Delete local file
                await unlinkAsync(req.file.path)
                    .then(() => console.log('Successfully deleted local file:', req.file.path))
                    .catch(err => console.error('Error deleting local file:', err));

            } catch (error) {
                console.error('Detailed upload error:', {
                    message: error.message,
                    code: error.http_code,
                    stack: error.stack
                });
                
                // Try to clean up the file even if upload failed
                try {
                    await unlinkAsync(req.file.path);
                } catch (unlinkError) {
                    console.error('Error cleaning up file after failed upload:', unlinkError);
                }
                
                return res.status(500).json({ 
                    message: 'Error uploading image',
                    details: error.message
                });
            }
        }

        const user = await User.findOneAndUpdate(
            { email },
            updateData,
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ 
            message: 'Error updating profile',
            details: error.message
        });
    }
});

mongoose.connect(url)
    .then(() => {
        console.log("Connected To MongoDB");
        app.listen(4000, () => {
            console.log("Server is running on port 4000");
        });
    })
    .catch((err) => {
        console.log("Failed To Connect", err);
    });