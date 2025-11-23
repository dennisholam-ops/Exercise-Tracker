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

// 簡單的內存數據庫 (避免 MongoDB 連接問題)
let users = [];
let exercises = [];
let userIdCounter = 1;
let exerciseIdCounter = 1;

// 首頁
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 1. 創建新用戶 - POST /api/users
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  // 檢查用戶名是否已存在
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.json({
      username: existingUser.username,
      _id: existingUser._id.toString()
    });
  }
  
  // 創建新用戶
  const newUser = {
    username: username,
    _id: userIdCounter.toString()
  };
  
  users.push(newUser);
  userIdCounter++;
  
  res.json({
    username: newUser.username,
    _id: newUser._id
  });
});

// 2. 獲取所有用戶 - GET /api/users
app.get('/api/users', (req, res) => {
  res.json(users.map(user => ({
    username: user.username,
    _id: user._id
  })));
});

// 3. 添加運動記錄 - POST /api/users/:_id/exercises
app.post('/api/users/:_id/exercises', (req, res) => {
  const userId = req.params._id;
  let { description, duration, date } = req.body;
  
  // 驗證必需字段
  if (!description || !duration) {
    return res.status(400).json({ error: 'Description and duration are required' });
  }
  
  // 查找用戶
  const user = users.find(u => u._id === userId);
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
  const exercise = {
    _id: exerciseIdCounter.toString(),
    userId: user._id,
    description: description,
    duration: parseInt(duration),
    date: exerciseDate
  };
  
  exercises.push(exercise);
  exerciseIdCounter++;
  
  // 返回用戶對象加上運動字段 (必須符合測試要求的格式)
  res.json({
    _id: user._id,
    username: user.username,
    description: exercise.description,
    duration: exercise.duration,
    date: exercise.date.toDateString()  // 使用 toDateString() 格式
  });
});

// 4. 獲取用戶運動記錄 - GET /api/users/:_id/logs
app.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;
  
  // 查找用戶
  const user = users.find(u => u._id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // 獲取用戶的所有運動記錄
  let userExercises = exercises.filter(ex => ex.userId === userId);
  
  // 日期範圍過濾
  if (from) {
    const fromDate = new Date(from);
    userExercises = userExercises.filter(ex => new Date(ex.date) >= fromDate);
  }
  
  if (to) {
    const toDate = new Date(to);
    userExercises = userExercises.filter(ex => new Date(ex.date) <= toDate);
  }
  
  // 限制結果數量
  if (limit) {
    userExercises = userExercises.slice(0, parseInt(limit));
  }
  
  // 格式化運動記錄
  const log = userExercises.map(exercise => ({
    description: exercise.description,
    duration: exercise.duration,
    date: new Date(exercise.date).toDateString()  // 確保使用 toDateString()
  }));
  
  // 返回符合測試要求的格式
  res.json({
    _id: user._id,
    username: user.username,
    count: log.length,
    log: log
  });
});

// 導出給 Vercel
module.exports = app;

// 本地開發
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
