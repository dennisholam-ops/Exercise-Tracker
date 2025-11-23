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

// 連接 MongoDB (如果用 MongoDB Atlas，請設置 MONGODB_URI 環境變量)
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exercise-tracker';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 數據模型定義
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
});

const ExerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Exercise = mongoose.model('Exercise', ExerciseSchema);

// 路由定義

// 首頁
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// 1. 創建新用戶
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // 檢查用戶名是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json(existingUser);
    }
    
    // 創建新用戶
    const newUser = new User({ username });
    await newUser.save();
    
    res.json({
      username: newUser.username,
      _id: newUser._id
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. 獲取所有用戶
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. 添加運動記錄
app.post('/api/users/:_id/exercises', async (req, res) => {
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
      userId: user._id,
      description,
      duration: parseInt(duration),
      date: exerciseDate
    });
    
    await exercise.save();
    
    // 返回用戶對象加上運動字段
    res.json({
      _id: user._id,
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. 獲取用戶運動記錄
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;
    
    // 查找用戶
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 構建查詢條件
    let query = { userId: user._id };
    
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
    
    const exercises = await exercisesQuery.exec();
    
    // 格式化響應
    const log = exercises.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }));
    
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log: log
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
