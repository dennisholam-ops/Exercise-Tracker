const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB 連接 (Vercel 環境變量)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exercise-tracker';

// 數據模型
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true }
});

const ExerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Exercise = mongoose.model('Exercise', ExerciseSchema);

// 連接數據庫
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

// 首頁
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 1. 創建新用戶 - POST /api/users
app.post('/api/users', async (req, res) => {
  await connectDB();
  
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // 創建新用戶
    const newUser = new User({ username });
    await newUser.save();
    
    res.json({
      username: newUser.username,
      _id: newUser._id.toString()
    });
  } catch (error) {
    if (error.code === 11000) {
      // 用戶名已存在，返回現有用戶
      const existingUser = await User.findOne({ username: req.body.username });
      return res.json({
        username: existingUser.username,
        _id: existingUser._id.toString()
      });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. 獲取所有用戶 - GET /api/users
app.get('/api/users', async (req, res) => {
  await connectDB();
  
  try {
    const users = await User.find({}, 'username _id');
    const formattedUsers = users.map(user => ({
      username: user.username,
      _id: user._id.toString()
    }));
    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. 添加運動記錄 - POST /api/users/:_id/exercises
app.post('/api/users/:_id/exercises', async (req, res) => {
  await connectDB();
  
  try {
    const userId = req.params._id;
    let { description, duration, date } = req.body;
    
    // 驗證必需字段
    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration are required' });
    }
    
    // 查找用戶
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 處理日期
    let exerciseDate;
    if (date) {
      exerciseDate = new Date(date);
      if (isNaN(exerciseDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
    } else {
      exerciseDate = new Date();
    }
    
    // 創建運動記錄
    const exercise = new Exercise({
      userId: user._id.toString(),
      description,
      duration: parseInt(duration),
      date: exerciseDate
    });
    
    await exercise.save();
    
    // 返回用戶對象加上運動字段
    res.json({
      _id: user._id.toString(),
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. 獲取用戶運動記錄 - GET /api/users/:_id/logs
app.get('/api/users/:_id/logs', async (req, res) => {
  await connectDB();
  
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;
    
    // 查找用戶
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 構建查詢條件
    let query = { userId: user._id.toString() };
    
    // 日期範圍過濾
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    
    // 執行查詢
    let exercisesQuery = Exercise.find(query)
      .select('description duration date -_id');
    
    // 限制結果數量
    if (limit) {
      exercisesQuery = exercisesQuery.limit(parseInt(limit));
    }
    
    // 排序由新到舊
    exercisesQuery = exercisesQuery.sort({ date: -1 });
    
    const exercises = await exercisesQuery.exec();
    
    // 格式化響應
    const log = exercises.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }));
    
    res.json({
      _id: user._id.toString(),
      username: user.username,
      count: log.length,
      log: log
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Vercel 需要 module.exports
module.exports = app;

// 本地開發用
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
