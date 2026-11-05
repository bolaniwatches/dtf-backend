const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large payload limit for base64 images

// MongoDB Atlas Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Atlas Connected Successfully!'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Product Mongoose Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  page: { type: String, default: 'dtf-design' },
  category: { type: String, required: true },
  filter: { type: String },
  mainImage: { type: String, required: true }, // Cloudinary URL
  mainImagePublicId: { type: String }, // For deleting from Cloudinary
  moreImages: [{ type: String }], // Array of Cloudinary URLs
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Category Mongoose Schema
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  page: { type: String, default: 'dtf-design' },
  createdAt: { type: Date, default: Date.now }
});

const Category = mongoose.model('Category', categorySchema);

// Filter Mongoose Schema
const filterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  page: { type: String, default: 'dtf-design' },
  createdAt: { type: Date, default: Date.now }
});

const Filter = mongoose.model('Filter', filterSchema);

// ================= API ROUTES ================= //

// 1. Add Product Endpoint
app.post('/api/products/add', async (req, res) => {
  try {
    const { name, description, price, page, category, filter, mainImage, moreImages } = req.body;

    // Upload Main Image to Cloudinary
    const mainUploadRes = await cloudinary.uploader.upload(mainImage, {
      folder: 'amin-dtf-designs/products'
    });

    // Upload More Images to Cloudinary (if any)
    const uploadedMoreImages = [];
    for (let imgBase64 of moreImages) {
      const resMore = await cloudinary.uploader.upload(imgBase64, {
        folder: 'amin-dtf-designs/products'
      });
      uploadedMoreImages.push(resMore.secure_url);
    }

    // Save Product to MongoDB Atlas
    const newProduct = new Product({
      name,
      description,
      price,
      page,
      category,
      filter,
      mainImage: mainUploadRes.secure_url,
      mainImagePublicId: mainUploadRes.public_id,
      moreImages: uploadedMoreImages
    });

    await newProduct.save();
    res.status(201).json({ success: true, message: 'Product uploaded successfully!', product: newProduct });

  } catch (error) {
    console.error('Error uploading product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get All Products
app.get('/api/products', async (req, res) => {
  try {
    const { page } = req.query;
    let query = page ? { page } : {};
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Get Single Product by ID
app.get('/api/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Delete Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.mainImagePublicId) {
      await cloudinary.uploader.destroy(product.mainImagePublicId);
    }

    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted completely from Database & Cloudinary!' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Add Category Endpoint
app.post('/api/categories/add', async (req, res) => {
  try {
    const { name, page } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists!' });
    }
    const newCat = new Category({ name, slug, page });
    await newCat.save();
    res.status(201).json({ success: true, category: newCat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get Categories Endpoint
app.get('/api/categories', async (req, res) => {
  try {
    const cats = await Category.find();
    res.status(200).json(cats);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Add Filter Endpoint
app.post('/api/filters/add', async (req, res) => {
  try {
    const { name, category, page } = req.body;
    const newFilter = new Filter({ name, category, page });
    await newFilter.save();
    res.status(201).json({ success: true, filter: newFilter });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Get Filters Endpoint
app.get('/api/filters', async (req, res) => {
  try {
    const filters = await Filter.find();
    res.status(200).json(filters);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 9. Delete Category Endpoint
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, message: 'Category deleted successfully from Database!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Delete Filter Endpoint
app.delete('/api/filters/:id', async (req, res) => {
  try {
    const filter = await Filter.findByIdAndDelete(req.params.id);
    if (!filter) {
      return res.status(404).json({ success: false, message: 'Filter not found' });
    }
    res.status(200).json({ success: true, message: 'Filter deleted successfully from Database!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 AMIN DTF Server is running live on port ${PORT}`);
});