const port = 4000;
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

app.use(express.json());
app.use(cors());

// Database connection with MongoDB
mongoose.connect('mongodb+srv://gregdevk:14Mongo02DB90Greg@cluster0.nqkvogs.mongodb.net/e-commerce', { useNewUrlParser: true, useUnifiedTopology: true });

// API Creation

app.get('/', (req, res)=>{
  res.send('Express App is Running') // This message you can see on web browser 'localhost:<port number>' when server is working good!
})

// Image Storage Engine

const storage = multer.diskStorage({
  destination: './upload/images',
  filename:(req, file, cb)=>{       // This function creates our storage for photos.
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
  }
})

const upload = multer({storage:storage}) // This constant permits us uploading photos

// Creating Upload Endpoint for images
app.use('/images',express.static('upload/images'))

// Update to handle multiple images
app.post('/upload', upload.array('productImages', 10), (req, res) => {
  const imageUrls = req.files.map(file => {
    return `http://localhost:${port}/images/${file.filename}`;
  });

  res.json({
    success: 1,
    image_urls: imageUrls
  });
});

// Schema for Creating Products with all data needed

const Product = mongoose.model('Product', {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  images: {
    type: [String], // Updated to an array of strings
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

app.post('/addproduct', async (req, res) => {
  // This code checks for the last known id, which is default 1 or a larger number, and increments its value by 1.
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1)
    let last_product = last_product_array[0]
    id = last_product.id + 1
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,    // Upper code is giving us posiblity to not send anymore id if not generte him automaticaly.
    name: req.body.name,
    images: req.body.images, // Changed to array of image URLs
    category: req.body.category,   // All req.body code we need to send by json file to our database
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  console.log(product);
  await product.save();
  console.log('Saved');     // Here we have our testing code to print in terminal if object was uploaded
  res.json({
    success: true,
    name: req.body.name
  });
})

// Creating API for Deleting Products

app.post('/removeproduct', async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log('Removed');
  res.json({
    success: true,
    name: req.body.name,
  });
})

// Creating API for Getting All Products

app.get('/allproducts', async (req, res) => {
  let products = await Product.find({});
  console.log('All Products Fetched');
  res.send(products);
})

// Schema Creating for user model

const Users = mongoose.model('users', {
  name: {
    type: String
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now
  }
})

// Creating Endpoint for registering the user
app.post('/signup', async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: false, errors: 'Existing User found with same email address' });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  })
  await user.save();

  const data = {
    user: {
      id: user.id,
    }
  }
  const token = jwt.sign(data, 'secret_ecom');
  res.json({ success: true, token })
})

// Creating endpoint for user login
app.post('/login', async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id
        }
      }
      const token = jwt.sign(data, 'secret_ecom');
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: 'Wrong Password!' })
    }
  } else {
    res.json({ success: false, errors: 'Wrong Email Id!' })
  }
})

//Creating endpoint for new collection data
app.get('/newcollections', async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log('New collections fetched');
  res.send(newcollection)
})

//Creating endpoint for popular in women section
app.get('/popularinwomen', async (req, res) => {
  let products = await Product.find({ category: 'women' });
  let popular_in_women = products.slice(0, 4);
  console.log('Popular in women fetched!');
  res.send(popular_in_women);
})

// Creating middleware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) {
    res.status(401).send({ errors: 'Please authenticate using valid token' });
  } else {
    try {
      const data = jwt.verify(token, 'secret_ecom');
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({ errors: 'Please authenticate using a valid token' })
    }
  }
}

// Creating endpoint for adding products in cartdata
app.post('/addtocart', fetchUser, async (req, res) => {
  console.log('Added!', req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send('Added!')
})

//Creating endpoint to remove product from cartdata
app.post('/removefromcart', fetchUser, async (req, res) => {
  console.log('Removed!', req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send('Removed!')
})

// Creating endpoint to get cartdata
app.post('/getcart', fetchUser, async (req, res) => {
  console.log('Get Cart');
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
})

app.listen(port, (error) => {
  if (!error) {
    console.log('Server running on Port: ' + port)  //This function will display one of two messages in the VSCode terminal depending on whether it is working correctly or not!
  } else {
    console.log('Error: ' + error)
  }
})