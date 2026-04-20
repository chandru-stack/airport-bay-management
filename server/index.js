const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);

// Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://airport-bay-management.vercel.app',
  'https://airport-bay-management-1.onrender.com'
];

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Handle preflight requests FIRST before any middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folder for uploaded files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/bays',          require('./routes/bays'));
app.use('/api/flights',       require('./routes/flights'));
app.use('/api/aircraft',      require('./routes/aircraft'));
app.use('/api/allocations',   require('./routes/allocations'));
app.use('/api/apron',         require('./routes/apron'));
app.use('/api/atc',           require('./routes/atc'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/uploads',       require('./routes/uploads'));
app.use('/api/logs',          require('./routes/logs'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: '✅ Airport Bay Management API is running',
    status: 'OK'
  });
});

// Socket.io connection handler
require('./socket/socketHandler')(io);

// Start delay monitor
const { startDelayMonitor } = require('./jobs/delayMonitor');
startDelayMonitor(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});