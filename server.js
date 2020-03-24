const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const flash = require('express-flash');
const session = require('express-session');

const User = require('../models/user.model');
const passport = require('passport');
const initializePassport = require('./passport-config');
const bcrypt = require('bcrypt');

// manage APIs with express
const cors = require('cors');
// allows connection with our database
const mongoose = require('mongoose');

// manage environment variables
require('dotenv').config();

// our localhost port
const port = process.env.PORT || 5500;

const app = express();

// cors middleware that allow us to parse json because the server will be sending and receiving json
app.use(cors());
app.use(express.json());

// auth
app.use(flash());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

// database uri which enables connection with our database
const uri = process.env.ATLAS_URI;
mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true , autoIndex: false });
const connection = mongoose.connection;

// once the connection is open is gonna display the message
connection.once('open', () => {
  console.log('MongoDB database connection established successfully');
});

const questionaryRouter = require('./routes/questionaries');
const roomRouter = require('./routes/room')
const pollRouter = require('./routes/poll')
const userRouter = require('./routes/user');

app.use('/questionary', questionaryRouter);
app.use('/room', roomRouter);
app.use('/poll', pollRouter);
app.use('/user', userRouter);


// ----------- auth routes -------------
initializePassport(
  passport,
  email => {
    User.findOne({email: email}, function (err, myUser) {
      if (!err) return myUser;
      else return null;
    })
  },
  id => {
    User.findById(id)
    .then(myUser => {return myUser})
    .catch(err => {return null});
  }
)

app.post('/login', passport.authenticate('local', {
  successRedirect: '/home',
  failureRedirect: '/login',
  failureFlash: true
}))

app.post('/signup', async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10)
  const name = req.body.name;
  const email = req.body.email;
  const password = hashedPassword;
  const newUser = new User({
      name,
      email,
      password
  });
  //console.log(newUser)
  newUser.save()
  .then(() => res.json('New user created!'))
  .catch(err => res.status(400).json('Error: ' + err));
});

// our server instance
const server = http.createServer(app)

// This creates our socket using the instance of the server
const io = socketIO(server)

//const pickably = require('./socket-server')

// This is what the socket.io syntax is like, we will work this later
io.on('connection', socket => {

  socket.on('room', (room) => {
    socket.join(room);
    console.log('<<< Client connected in room: ' + room)
    //io.sockets.in(room).emit('message', 'what is going on, party people?');
  })

  socket.on('newPlayer', (room) => {
    console.log('<<< newPlayer: ' + room);
    io.sockets.in(room).emit('updatePlayersList', room);
  })

  socket.on('playerVotes', (data) => {
    console.log('<<< playerVotes: ' + data.room);
    io.sockets.in(data.room).emit('showButtons', data);
  })

  socket.on('timeCompleted', (data) => {
    console.log('<<< timeCompleted: ' + data.room);
    io.sockets.in(data.room).emit('startLoading', data);
  })

  socket.on('gameover', (room) => {
    console.log('<<< gameover: ' + room);
    io.sockets.in(room).emit('finishGame', room);
  })
})

// ... other imports 
const path = require("path")

// ... other app.use middleware 
app.use(express.static(path.join(__dirname, "socket-client", "build")))

// ...
// Right before your app.listen(), add this:
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "socket-client", "build", "index.html"));
});

server.listen(port, () => console.log(`Listening on port ${port}`))