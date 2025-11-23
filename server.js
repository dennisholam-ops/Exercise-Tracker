const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// 簡單的內存數據庫
let users = [];
let exercises = [];
let userIdCounter = 1;
let exerciseIdCounter = 1;

// 首頁路由
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 1. 創建新用戶
app.post('/api/users', (req, res) => {
  try {
    console.log('Creating user with username:', req.body.username);
    
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // 檢查用戶名是否已存在
    const existingUser = users.find(user => user.username === username);
    if (existingUser) {
      return res.json({
        username: existingUser.username,
        _id: existingUser._id
      });
    }
    
    // 創建新用戶
    const newUser = {
      username: username,
      _id: userIdCounter.toString()
    };
    
    users.push(newUser);
    userIdCounter++;
    
    console.log('User created:', newUser);
    
    res.json({
      username: newUser.username,
      _id: newUser._id
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. 獲取所有用戶
app.get('/api/users', (req, res) => {
  try {
    console.log('Fetching all users');
    const userList = users.map(user => ({
      username: user.username,
      _id: user._id
    }));
    res.json(userList);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. 添加運動記錄
app.post('/api/users/:_id/exercises', (req, res) => {
  try {
    const userId = req.params._id;
    let { description, duration, date } = req.body;
    
    console.log('Adding exercise for user:', userId, description, duration, date);
    
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
    
    console.log('Exercise added:', exercise);
    
    // 返回用戶對象加上運動字段
    res.json({
      _id: user._id,
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    });
    
  } catch (error) {
    console.error('Error adding exercise:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. 獲取用戶運動記錄
app.get('/api/users/:_id/logs', (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;
    
    console.log('Fetching logs for user:', userId, { from, to, limit });
    
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
      date: new Date(exercise.date).toDateString()
    }));
    
    console.log('Returning log with', log.length, 'exercises');
    
    // 返回符合測試要求的格式
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log: log
    });
    
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 健康檢查端點
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 處理未找到的路由
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 錯誤處理中間件
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 導出給 Vercel - 必須是 module.exports
module.exports = app;

// 只有在直接運行時才啟動服務器
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
